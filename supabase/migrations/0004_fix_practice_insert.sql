-- Fix: the practice_attempts INSERT policy joined public.questions directly, but students
-- have no SELECT policy on questions (they read them only through the security-definer RPC).
-- So the EXISTS check always evaluated empty and every practice attempt was blocked with
-- "new row violates row-level security policy". Move the membership check into a
-- security-definer helper, consistent with is_batch_student / is_test_live etc.

create or replace function public.can_practice_question(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.practice_sets ps
    join public.questions q on q.question_paper_id = ps.paper_id
    where q.id = p_question_id and public.is_batch_student(ps.batch_id)
  )
$$;

drop policy if exists "practice_attempts_insert_student" on public.practice_attempts;
create policy "practice_attempts_insert_student" on public.practice_attempts
for insert with check (
  student_id = auth.uid() and public.can_practice_question(question_id)
);
