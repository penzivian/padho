-- CBT test-taking: resumable attempts, mark-for-review, and teacher close/reschedule.
--
-- Two deliberate modelling choices, both to avoid `alter type ... add value` (Postgres
-- forbids *using* a new enum value in the transaction that adds it, which would force a
-- two-step deploy):
--   * "attempt in progress" is `test_submissions.submitted_at is null` — the column already
--     existed and was always written at insert time. Every read that means "a finished
--     attempt" must now filter `submitted_at is not null`.
--   * "closed by the teacher" is `tests.closed_at`, which also records *when* it happened.

alter table public.tests
  add column if not exists closed_at timestamptz;

-- Per-question flag driving the CBT palette's "marked for review" state.
alter table public.answers
  add column if not exists marked_for_review boolean not null default false;

-- Resuming an attempt reads the student's own answers for one submission.
create index if not exists answers_submission_question_idx
  on public.answers(submission_id, question_id);

-- Finding a student's in-progress attempt on every question save.
create index if not exists submissions_test_student_idx
  on public.test_submissions(test_id, student_id);

-- is_test_live now means "open for taking right now", which is what every caller already
-- wanted. Two real fixes beyond the closed_at check:
--   * it was NOT end-bounded, so questions stayed fetchable forever after the window shut;
--   * the `status = 'completed'` branch let a finished test serve questions again.
-- Callers unchanged: get_student_test_questions and submissions_insert_student.
create or replace function public.is_test_live(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tests
    where id = p_test_id
      and status = 'scheduled'
      and closed_at is null
      and scheduled_at <= now()
      and now() < scheduled_at + make_interval(mins => duration_minutes)
  )
$$;

-- A student may amend their own answers while the attempt is unsubmitted and the test is
-- open. Server actions still do the writing with the admin client after a visibility gate;
-- this is the defense-in-depth floor, and it can never touch teacher-owned grading columns.
drop policy if exists "answers_update_student" on public.answers;
create policy "answers_update_student" on public.answers
for update using (
  exists (
    select 1 from public.test_submissions ts
    where ts.id = submission_id
      and ts.student_id = auth.uid()
      and ts.submitted_at is null
      and public.is_test_live(ts.test_id)
  )
) with check (
  ai_suggested_marks is null
  and awarded_marks is null
  and ai_feedback is null
  and teacher_feedback is null
  and approved_at is null
);
