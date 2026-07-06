-- Rank visibility: teachers choose whether students see the full rank list.
-- Off by default: students then see only their own rank and the top 3.
alter table public.tests
  add column if not exists show_full_ranks boolean not null default false;
