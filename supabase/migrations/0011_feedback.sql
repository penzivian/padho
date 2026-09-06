-- Feedback from the landing page.
--
-- The only table in this schema that accepts writes from a LOGGED-OUT visitor, which is the
-- whole point: the people whose answers matter most have not signed up yet. Two consequences
-- follow, and both are handled below rather than in app code.
--
-- 1. Anyone can insert, so every field is length-capped by a constraint. An unbounded text
--    column reachable by anon is an invitation to fill the database.
-- 2. There is deliberately NO select, update or delete policy. RLS denies by default, so
--    nobody — anon or signed-in teacher — can read anyone's feedback through the API. The
--    owner reads it with the admin client after the PLATFORM_OWNER_EMAILS gate, the same
--    shape the shared library uses. Responses can contain a name and a phone number, so
--    "everyone with an account can read them" would be the wrong default.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  -- "What should we build or fix first?" — the only required answer.
  suggestion text not null,
  -- "Would you like to be one of our first institutes?" Empty means they skipped it.
  interest text not null default '',
  -- Name or institute, optional.
  name text not null default '',
  -- Optional email or phone, so an interested institute is actually reachable.
  contact text not null default '',
  created_at timestamptz not null default now(),

  constraint feedback_suggestion_length
    check (char_length(suggestion) between 1 and 4000),
  constraint feedback_name_length check (char_length(name) <= 200),
  constraint feedback_contact_length check (char_length(contact) <= 200),
  constraint feedback_interest_allowed
    check (interest in ('', 'yes', 'maybe', 'not_now'))
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Anyone may leave feedback, including a visitor who has never signed in.
drop policy if exists "feedback_insert_anyone" on public.feedback;
create policy "feedback_insert_anyone" on public.feedback
for insert to anon, authenticated with check (true);

-- No select/update/delete policy on purpose. See the note at the top of this file.
