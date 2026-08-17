-- Question bank: a reusable pool a teacher builds up and assembles papers from.
--
-- Deliberately separate from `questions`. A paper's questions must be a COPY, never a
-- reference: if a paper pointed at a bank row and someone later fixed a typo in it, that
-- would retroactively change a paper students had already sat.
--
-- No pgvector here. At this size Postgres full-text search is the right tool; embeddings
-- earn their place for cross-source dedupe and "more like this", neither of which matters
-- until the bank is large.
create table if not exists public.bank_questions (
  id uuid primary key default gen_random_uuid(),
  owner_teacher_id uuid not null references public.profiles(id) on delete cascade,
  question_text text not null,
  question_type public.question_type not null,
  topic text not null default 'General',
  subject text not null default '',
  options jsonb,
  correct_answer text,
  max_marks numeric(6,2) not null default 1,
  negative_marks numeric(6,2) not null default 0,
  rubric text,
  -- Where it came from, for the teacher's own recall: "PSAT 1", "NCERT Class 12", "JEE 2024".
  source_label text not null default '',
  source_paper_id uuid references public.question_papers(id) on delete set null,
  difficulty text,
  -- Every other table here is teacher-scoped. This is the first that could be shared, so the
  -- door is left open without opening it: today everything is private to its owner.
  is_public boolean not null default false,
  -- Normalized question text + options, hashed. Backs the "already in your bank" check so
  -- saving the same paper twice is idempotent rather than duplicating it.
  fingerprint text not null,
  created_at timestamptz not null default now(),

  constraint bank_questions_positive_marks check (max_marks > 0),
  constraint bank_questions_negative_range
    check (negative_marks >= 0 and negative_marks <= max_marks),
  constraint bank_questions_difficulty
    check (difficulty is null or difficulty in ('easy', 'medium', 'hard')),
  -- Mirrors questions_mcq_shape: an MCQ carries options, a written answer does not.
  constraint bank_questions_mcq_shape check (
    (question_type = 'mcq' and options is not null and jsonb_array_length(options) >= 2)
    or (question_type = 'subjective')
  )
);

-- Idempotent re-import: the same question saved twice by the same teacher is one row.
create unique index if not exists bank_questions_owner_fingerprint_idx
  on public.bank_questions(owner_teacher_id, fingerprint);

-- `topic` drives every analytic in the app (progress snapshots, reteach radar, topic bars)
-- and is free text, so "Kinematics" / "kinematics" would fragment it. topic_key exists to
-- group and filter case-insensitively WITHOUT rewriting the teacher's own label, which is
-- what the paper actually carries.
alter table public.bank_questions
  drop column if exists topic_key;
alter table public.bank_questions
  add column topic_key text generated always as (lower(btrim(topic))) stored;

create index if not exists bank_questions_owner_topic_idx
  on public.bank_questions(owner_teacher_id, topic_key);

-- Full-text search over the stem, topic and subject. to_tsvector with a literal config is
-- immutable, so this can be a stored generated column.
alter table public.bank_questions
  drop column if exists search_vector;
alter table public.bank_questions
  add column search_vector tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(question_text, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(subject, '')
    )
  ) stored;

create index if not exists bank_questions_search_idx
  on public.bank_questions using gin(search_vector);

alter table public.bank_questions enable row level security;

-- Private to its owner, with is_public reserved for a future shared corpus.
drop policy if exists "bank_questions_select_visible" on public.bank_questions;
create policy "bank_questions_select_visible" on public.bank_questions
for select using (owner_teacher_id = auth.uid() or is_public);

drop policy if exists "bank_questions_insert_owner" on public.bank_questions;
create policy "bank_questions_insert_owner" on public.bank_questions
for insert with check (
  owner_teacher_id = auth.uid() and public.current_profile_role() = 'teacher'
);

drop policy if exists "bank_questions_update_owner" on public.bank_questions;
create policy "bank_questions_update_owner" on public.bank_questions
for update using (owner_teacher_id = auth.uid()) with check (owner_teacher_id = auth.uid());

drop policy if exists "bank_questions_delete_owner" on public.bank_questions;
create policy "bank_questions_delete_owner" on public.bank_questions
for delete using (owner_teacher_id = auth.uid());
