-- Diagram-based questions (circuit diagrams, ray diagrams, graphs to read).
--
-- Stores a storage PATH, not a URL. The bucket is private and has no student-facing read
-- policy at all; the app mints short-lived signed URLs server-side *after* the same gate
-- that already protects question text. A stored public URL would leak a diagram to anyone
-- who had the link, including before the test opens.
alter table public.questions
  add column if not exists image_path text;

alter table public.bank_questions
  add column if not exists image_path text;

-- Separate from question-paper-uploads: that bucket holds source PDFs and is readable only
-- inside the uploading teacher's own folder, which students can never reach.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-images',
  'question-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Teachers manage diagrams inside their own folder. There is deliberately NO student read
-- policy: students only ever receive signed URLs, minted after the live-test check.
drop policy if exists "question_images_insert_own_folder" on storage.objects;
create policy "question_images_insert_own_folder" on storage.objects
for insert with check (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "question_images_select_own_folder" on storage.objects;
create policy "question_images_select_own_folder" on storage.objects
for select using (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "question_images_delete_own_folder" on storage.objects;
create policy "question_images_delete_own_folder" on storage.objects
for delete using (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- The student RPC carries the diagram path alongside the stem. Return type changes, so the
-- function must be dropped and recreated rather than replaced.
drop function if exists public.get_student_test_questions(uuid);
create function public.get_student_test_questions(p_test_id uuid)
returns table (
  id uuid,
  question_text text,
  question_type public.question_type,
  topic text,
  options jsonb,
  max_marks numeric,
  negative_marks numeric,
  image_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.question_text, q.question_type, q.topic, q.options,
         q.max_marks, q.negative_marks, q.image_path
  from public.tests t
  join public.questions q on q.question_paper_id = t.question_paper_id
  where t.id = p_test_id
    and public.is_test_student(t.id)
    and public.is_test_live(t.id)
  order by q.position, q.created_at, q.id
$$;
