-- Practice mode: consequence-free question practice.
-- Papers are reused (never cloned); attempts are a lightweight effort log that
-- never touches progress_snapshots, ranks, or test statistics.

create table if not exists public.practice_sets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  title text not null,
  published_at timestamptz not null default now(),
  unique (batch_id, paper_id)
);

create table if not exists public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  given_answer text not null default '',
  is_correct boolean,
  created_at timestamptz not null default now()
);

create index if not exists practice_sets_batch_id_idx on public.practice_sets(batch_id);
create index if not exists practice_attempts_student_created_idx
  on public.practice_attempts(student_id, created_at);
create index if not exists practice_attempts_question_id_idx
  on public.practice_attempts(question_id);

-- Safe question fetch for practice: never exposes correct_answer or rubric.
create or replace function public.get_student_practice_questions(p_set_id uuid)
returns table (
  id uuid,
  question_text text,
  question_type public.question_type,
  topic text,
  options jsonb,
  max_marks numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.question_text, q.question_type, q.topic, q.options, q.max_marks
  from public.practice_sets ps
  join public.questions q on q.question_paper_id = ps.paper_id
  where ps.id = p_set_id
    and public.is_batch_student(ps.batch_id)
  order by q.created_at, q.id
$$;

alter table public.practice_sets enable row level security;
alter table public.practice_attempts enable row level security;

drop policy if exists "practice_sets_select_visible" on public.practice_sets;
create policy "practice_sets_select_visible" on public.practice_sets
for select using (public.is_batch_teacher(batch_id) or public.is_batch_student(batch_id));

drop policy if exists "practice_sets_insert_teacher" on public.practice_sets;
create policy "practice_sets_insert_teacher" on public.practice_sets
for insert with check (teacher_id = auth.uid() and public.is_batch_teacher(batch_id));

drop policy if exists "practice_sets_delete_teacher" on public.practice_sets;
create policy "practice_sets_delete_teacher" on public.practice_sets
for delete using (teacher_id = auth.uid());

-- Students may log attempts only against questions that belong to a practice set
-- published to a batch they are a member of.
drop policy if exists "practice_attempts_insert_student" on public.practice_attempts;
create policy "practice_attempts_insert_student" on public.practice_attempts
for insert with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.practice_sets ps
    join public.questions q on q.question_paper_id = ps.paper_id
    where q.id = question_id and public.is_batch_student(ps.batch_id)
  )
);

-- Students read their own attempts; the set's teacher reads attempts for effort stats.
drop policy if exists "practice_attempts_select_visible" on public.practice_attempts;
create policy "practice_attempts_select_visible" on public.practice_attempts
for select using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.practice_sets ps
    join public.questions q on q.question_paper_id = ps.paper_id
    where q.id = question_id and ps.teacher_id = auth.uid()
  )
);

-- Students may adjust their own self-mark (subjective "got it" / "review again").
drop policy if exists "practice_attempts_update_student" on public.practice_attempts;
create policy "practice_attempts_update_student" on public.practice_attempts
for update using (student_id = auth.uid()) with check (student_id = auth.uid());
