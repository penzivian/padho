-- Questions were coming out of a paper in a scrambled order.
--
-- savePaperAction inserts the whole paper in ONE statement, so every row gets an identical
-- created_at. Ordering by `created_at, id` therefore falls through to the id — a random
-- UUID — so the displayed order had no relation to the paper. On the owner's real
-- 45-question paper, question 1 was being shown as question 23.
--
-- Scoring was never affected: answers are keyed by question_id and each is scored against
-- its own correct_answer, never by position. This is a presentation fix.
alter table public.questions
  add column if not exists position integer not null default 0;

-- Backfill from physical row order. These tables are append-only (questions are never
-- UPDATEd in bulk), so ctid still reflects the order the rows were inserted in — which is
-- the order the teacher's paper was in.
with ordered as (
  select id, row_number() over (partition by question_paper_id order by ctid) as pos
  from public.questions
)
update public.questions q
set position = ordered.pos
from ordered
where ordered.id = q.id and q.position = 0;

create index if not exists questions_paper_position_idx
  on public.questions(question_paper_id, position);

-- Both student-facing RPCs order by position first. created_at and id stay as tiebreakers
-- so rows added later (or any row that somehow missed the backfill) still sort predictably.
create or replace function public.get_student_test_questions(p_test_id uuid)
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
  from public.tests t
  join public.questions q on q.question_paper_id = t.question_paper_id
  where t.id = p_test_id
    and public.is_test_student(t.id)
    and public.is_test_live(t.id)
  order by q.position, q.created_at, q.id
$$;

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
  order by q.position, q.created_at, q.id
$$;
