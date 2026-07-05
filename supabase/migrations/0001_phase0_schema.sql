create extension if not exists pgcrypto;

do $$ begin
  create type public.profile_role as enum ('teacher', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.paper_source as enum ('uploaded', 'ai_generated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_type as enum ('mcq', 'subjective');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.test_status as enum ('draft', 'scheduled', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.submission_status as enum ('pending', 'graded');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.profile_role not null,
  full_name text not null default '',
  phone text unique,
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  subject text not null,
  exam_target text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  constraint batches_invite_code_format check (invite_code ~ '^[A-Z0-9]{6,10}$')
);

create table if not exists public.batch_students (
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (batch_id, student_id)
);

create table if not exists public.question_papers (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  title text not null,
  source public.paper_source not null,
  file_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_paper_id uuid not null references public.question_papers(id) on delete cascade,
  question_text text not null,
  question_type public.question_type not null,
  topic text not null default 'General',
  options jsonb,
  correct_answer text,
  max_marks numeric(6,2) not null default 1,
  rubric text,
  created_at timestamptz not null default now(),
  constraint questions_positive_marks check (max_marks > 0),
  constraint questions_mcq_shape check (
    (question_type = 'mcq' and jsonb_typeof(options) = 'array')
    or
    (question_type = 'subjective')
  )
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  question_paper_id uuid not null references public.question_papers(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null,
  status public.test_status not null default 'draft',
  created_at timestamptz not null default now(),
  constraint tests_positive_duration check (duration_minutes > 0)
);

create table if not exists public.test_submissions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz,
  status public.submission_status not null default 'pending',
  unique (test_id, student_id)
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.test_submissions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  student_answer text not null default '',
  ai_suggested_marks numeric(6,2),
  awarded_marks numeric(6,2),
  ai_feedback text,
  teacher_feedback text,
  approved_at timestamptz,
  unique (submission_id, question_id),
  constraint answers_non_negative_ai_marks check (ai_suggested_marks is null or ai_suggested_marks >= 0),
  constraint answers_non_negative_awarded_marks check (awarded_marks is null or awarded_marks >= 0)
);

create table if not exists public.progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  score_percent numeric(6,2) not null,
  topic_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (student_id, test_id),
  constraint progress_score_range check (score_percent >= 0 and score_percent <= 100)
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_teacher_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now(),
  constraint ai_usage_non_negative_tokens check (input_tokens >= 0 and output_tokens >= 0)
);

create index if not exists batches_teacher_id_idx on public.batches(teacher_id);
create index if not exists batch_students_student_id_idx on public.batch_students(student_id);
create index if not exists question_papers_batch_id_idx on public.question_papers(batch_id);
create index if not exists questions_paper_id_idx on public.questions(question_paper_id);
create index if not exists tests_batch_id_idx on public.tests(batch_id);
create index if not exists test_submissions_student_id_idx on public.test_submissions(student_id);
create index if not exists answers_submission_id_idx on public.answers(submission_id);
create index if not exists progress_student_batch_idx on public.progress_snapshots(student_id, batch_id);
create index if not exists ai_usage_owner_created_idx on public.ai_usage_events(owner_teacher_id, created_at);

create or replace function public.current_profile_role()
returns public.profile_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_batch_teacher(p_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.batches
    where id = p_batch_id and teacher_id = auth.uid()
  )
$$;

create or replace function public.is_batch_student(p_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.batch_students
    where batch_id = p_batch_id and student_id = auth.uid()
  )
$$;

create or replace function public.is_test_teacher(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tests t
    join public.batches b on b.id = t.batch_id
    where t.id = p_test_id and b.teacher_id = auth.uid()
  )
$$;

create or replace function public.is_test_student(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tests t
    join public.batch_students bs on bs.batch_id = t.batch_id
    where t.id = p_test_id and bs.student_id = auth.uid()
  )
$$;

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
      and (status = 'completed' or (status = 'scheduled' and scheduled_at <= now()))
  )
$$;

create or replace function public.join_batch_by_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.current_profile_role() <> 'student' then
    raise exception 'Only students can join batches';
  end if;

  select id into v_batch_id
  from public.batches
  where invite_code = upper(trim(p_invite_code));

  if v_batch_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.batch_students (batch_id, student_id)
  values (v_batch_id, auth.uid())
  on conflict do nothing;

  return v_batch_id;
end
$$;

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
  order by q.created_at, q.id
$$;

alter table public.profiles enable row level security;
alter table public.batches enable row level security;
alter table public.batch_students enable row level security;
alter table public.question_papers enable row level security;
alter table public.questions enable row level security;
alter table public.tests enable row level security;
alter table public.test_submissions enable row level security;
alter table public.answers enable row level security;
alter table public.progress_snapshots enable row level security;
alter table public.ai_usage_events enable row level security;

drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible" on public.profiles
for select using (
  id = auth.uid()
  or exists (
    select 1
    from public.batch_students bs
    join public.batches b on b.id = bs.batch_id
    where b.teacher_id = auth.uid() and bs.student_id = profiles.id
  )
  or exists (
    select 1
    from public.batch_students bs
    join public.batches b on b.id = bs.batch_id
    where bs.student_id = auth.uid() and b.teacher_id = profiles.id
  )
);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
for insert with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "batches_select_visible" on public.batches;
create policy "batches_select_visible" on public.batches
for select using (teacher_id = auth.uid() or public.is_batch_student(id));

drop policy if exists "batches_insert_teacher" on public.batches;
create policy "batches_insert_teacher" on public.batches
for insert with check (teacher_id = auth.uid() and public.current_profile_role() = 'teacher');

drop policy if exists "batches_update_teacher" on public.batches;
create policy "batches_update_teacher" on public.batches
for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

drop policy if exists "batches_delete_teacher" on public.batches;
create policy "batches_delete_teacher" on public.batches
for delete using (teacher_id = auth.uid());

drop policy if exists "batch_students_select_visible" on public.batch_students;
create policy "batch_students_select_visible" on public.batch_students
for select using (student_id = auth.uid() or public.is_batch_teacher(batch_id));

drop policy if exists "batch_students_insert_teacher" on public.batch_students;
create policy "batch_students_insert_teacher" on public.batch_students
for insert with check (public.is_batch_teacher(batch_id));

drop policy if exists "batch_students_delete_teacher_or_self" on public.batch_students;
create policy "batch_students_delete_teacher_or_self" on public.batch_students
for delete using (student_id = auth.uid() or public.is_batch_teacher(batch_id));

drop policy if exists "question_papers_select_visible" on public.question_papers;
create policy "question_papers_select_visible" on public.question_papers
for select using (teacher_id = auth.uid() or public.is_batch_student(batch_id));

drop policy if exists "question_papers_insert_teacher" on public.question_papers;
create policy "question_papers_insert_teacher" on public.question_papers
for insert with check (teacher_id = auth.uid() and public.is_batch_teacher(batch_id));

drop policy if exists "question_papers_update_teacher" on public.question_papers;
create policy "question_papers_update_teacher" on public.question_papers
for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

drop policy if exists "question_papers_delete_teacher" on public.question_papers;
create policy "question_papers_delete_teacher" on public.question_papers
for delete using (teacher_id = auth.uid());

drop policy if exists "questions_select_teacher" on public.questions;
create policy "questions_select_teacher" on public.questions
for select using (
  exists (
    select 1 from public.question_papers qp
    where qp.id = question_paper_id and qp.teacher_id = auth.uid()
  )
);

drop policy if exists "questions_insert_teacher" on public.questions;
create policy "questions_insert_teacher" on public.questions
for insert with check (
  exists (
    select 1 from public.question_papers qp
    where qp.id = question_paper_id and qp.teacher_id = auth.uid()
  )
);

drop policy if exists "questions_update_teacher" on public.questions;
create policy "questions_update_teacher" on public.questions
for update using (
  exists (
    select 1 from public.question_papers qp
    where qp.id = question_paper_id and qp.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.question_papers qp
    where qp.id = question_paper_id and qp.teacher_id = auth.uid()
  )
);

drop policy if exists "questions_delete_teacher" on public.questions;
create policy "questions_delete_teacher" on public.questions
for delete using (
  exists (
    select 1 from public.question_papers qp
    where qp.id = question_paper_id and qp.teacher_id = auth.uid()
  )
);

drop policy if exists "tests_select_visible" on public.tests;
create policy "tests_select_visible" on public.tests
for select using (
  public.is_test_teacher(id)
  or (public.is_test_student(id) and public.is_test_live(id))
);

drop policy if exists "tests_insert_teacher" on public.tests;
create policy "tests_insert_teacher" on public.tests
for insert with check (public.is_batch_teacher(batch_id));

drop policy if exists "tests_update_teacher" on public.tests;
create policy "tests_update_teacher" on public.tests
for update using (public.is_test_teacher(id)) with check (public.is_batch_teacher(batch_id));

drop policy if exists "tests_delete_teacher" on public.tests;
create policy "tests_delete_teacher" on public.tests
for delete using (public.is_test_teacher(id));

drop policy if exists "submissions_select_visible" on public.test_submissions;
create policy "submissions_select_visible" on public.test_submissions
for select using (student_id = auth.uid() or public.is_test_teacher(test_id));

drop policy if exists "submissions_insert_student" on public.test_submissions;
create policy "submissions_insert_student" on public.test_submissions
for insert with check (
  student_id = auth.uid()
  and public.is_test_student(test_id)
  and public.is_test_live(test_id)
);

drop policy if exists "submissions_update_teacher" on public.test_submissions;
create policy "submissions_update_teacher" on public.test_submissions
for update using (public.is_test_teacher(test_id)) with check (public.is_test_teacher(test_id));

drop policy if exists "answers_select_visible" on public.answers;
create policy "answers_select_visible" on public.answers
for select using (
  exists (
    select 1 from public.test_submissions ts
    where ts.id = submission_id
      and (ts.student_id = auth.uid() or public.is_test_teacher(ts.test_id))
  )
);

drop policy if exists "answers_insert_student" on public.answers;
create policy "answers_insert_student" on public.answers
for insert with check (
  exists (
    select 1 from public.test_submissions ts
    where ts.id = submission_id and ts.student_id = auth.uid()
  )
  and ai_suggested_marks is null
  and awarded_marks is null
  and ai_feedback is null
  and teacher_feedback is null
  and approved_at is null
);

drop policy if exists "answers_update_teacher" on public.answers;
create policy "answers_update_teacher" on public.answers
for update using (
  exists (
    select 1 from public.test_submissions ts
    where ts.id = submission_id and public.is_test_teacher(ts.test_id)
  )
) with check (
  exists (
    select 1 from public.test_submissions ts
    where ts.id = submission_id and public.is_test_teacher(ts.test_id)
  )
);

drop policy if exists "progress_select_visible" on public.progress_snapshots;
create policy "progress_select_visible" on public.progress_snapshots
for select using (student_id = auth.uid() or public.is_batch_teacher(batch_id));

drop policy if exists "progress_insert_teacher" on public.progress_snapshots;
create policy "progress_insert_teacher" on public.progress_snapshots
for insert with check (public.is_batch_teacher(batch_id));

drop policy if exists "progress_update_teacher" on public.progress_snapshots;
create policy "progress_update_teacher" on public.progress_snapshots
for update using (public.is_batch_teacher(batch_id)) with check (public.is_batch_teacher(batch_id));

drop policy if exists "ai_usage_select_visible" on public.ai_usage_events;
create policy "ai_usage_select_visible" on public.ai_usage_events
for select using (actor_id = auth.uid() or owner_teacher_id = auth.uid());

drop policy if exists "ai_usage_insert_actor" on public.ai_usage_events;
create policy "ai_usage_insert_actor" on public.ai_usage_events
for insert with check (actor_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-paper-uploads',
  'question-paper-uploads',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "question_paper_uploads_select_own_folder" on storage.objects;
create policy "question_paper_uploads_select_own_folder" on storage.objects
for select using (
  bucket_id = 'question-paper-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "question_paper_uploads_insert_own_folder" on storage.objects;
create policy "question_paper_uploads_insert_own_folder" on storage.objects
for insert with check (
  bucket_id = 'question-paper-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "question_paper_uploads_update_own_folder" on storage.objects;
create policy "question_paper_uploads_update_own_folder" on storage.objects
for update using (
  bucket_id = 'question-paper-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'question-paper-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "question_paper_uploads_delete_own_folder" on storage.objects;
create policy "question_paper_uploads_delete_own_folder" on storage.objects
for delete using (
  bucket_id = 'question-paper-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);
