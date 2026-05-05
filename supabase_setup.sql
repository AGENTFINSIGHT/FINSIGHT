-- ══════════════════════════════════════════════════════════════
-- FinSight AI — Supabase Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════

-- 1. Create analyses table
create table if not exists public.analyses (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references auth.users(id) on delete cascade not null,
  created_at   timestamptz default now(),
  file_name    text        not null,
  file_type    text        not null check (file_type in ('pdf', 'image', 'text')),
  file_url     text,
  currency     text        default '$',
  total_debit  numeric     default 0,
  total_credit numeric     default 0,
  txn_count    integer     default 0,
  result_json  jsonb       not null
);

-- 2. Enable Row Level Security
alter table public.analyses enable row level security;

-- 3. Policy: users can only access their own records
create policy "Users manage own analyses"
  on public.analyses
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════
-- Storage Buckets (run these via Storage UI or SQL below)
-- ══════════════════════════════════════════════════════════════

-- Create 'statements' bucket for PDF files
insert into storage.buckets (id, name, public)
values ('statements', 'statements', false)
on conflict (id) do nothing;

-- Create 'snapshots' bucket for image files
insert into storage.buckets (id, name, public)
values ('snapshots', 'snapshots', false)
on conflict (id) do nothing;

-- Storage RLS: users can read/write only their own folder
create policy "Users own statement files"
  on storage.objects for all
  using  (bucket_id = 'statements' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'statements' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users own snapshot files"
  on storage.objects for all
  using  (bucket_id = 'snapshots' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'snapshots' and auth.uid()::text = (storage.foldername(name))[1]);
