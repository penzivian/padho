-- Negative marking (JEE/NEET style: +4 correct, -1 wrong, 0 unattempted).
--
-- Stored as a POSITIVE magnitude — the penalty to deduct — so nothing in the codebase has to
-- reason about a double negative. scoreMcqAnswer turns it into the actual negative award.
alter table public.questions
  add column if not exists negative_marks numeric(6,2) not null default 0;

-- Capped at max_marks so a paper can never drive a student below -100%, which keeps the
-- relaxed progress_score_range bound below meaningful.
alter table public.questions
  drop constraint if exists questions_negative_marks_range;
alter table public.questions
  add constraint questions_negative_marks_range
  check (negative_marks >= 0 and negative_marks <= max_marks);

-- A wrong answer under negative marking awards a negative number. This constraint would
-- reject the row outright, so it has to go.
alter table public.answers
  drop constraint if exists answers_non_negative_awarded_marks;

-- A student can now finish net-negative. Allowing -100 is enough because negative_marks is
-- capped at max_marks above: the worst possible paper is every question wrong, which is
-- exactly -100%.
alter table public.progress_snapshots
  drop constraint if exists progress_score_range;
alter table public.progress_snapshots
  add constraint progress_score_range
  check (score_percent >= -100 and score_percent <= 100);

-- Students must be told the penalty before they answer, so the safe RPC carries it. The
-- return type changes, so the function has to be dropped rather than replaced.
drop function if exists public.get_student_test_questions(uuid);
create function public.get_student_test_questions(p_test_id uuid)
returns table (
  id uuid,
  question_text text,
  question_type public.question_type,
  topic text,
  options jsonb,
  max_marks numeric,
  negative_marks numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.question_text, q.question_type, q.topic, q.options, q.max_marks, q.negative_marks
  from public.tests t
  join public.questions q on q.question_paper_id = t.question_paper_id
  where t.id = p_test_id
    and public.is_test_student(t.id)
    and public.is_test_live(t.id)
  order by q.position, q.created_at, q.id
$$;
