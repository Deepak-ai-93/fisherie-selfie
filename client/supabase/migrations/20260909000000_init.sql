-- ============================================================
-- I Support Blue Economy — Gujarat Fisheries
-- Supabase schema (Postgres)
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── 1. Tables ──────────────────────────────────────────────

-- Visit tracking (one row per page load)
create table if not exists public.visits (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  ip          text,
  device      text,
  browser     text,
  language    text,
  referer     text default 'direct'
);

-- Consent + photo metadata (one row per captured selfie)
create table if not exists public.consents (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  photo_id       text,
  consent        boolean default true,
  consent_text   text,
  campaign       text not null default 'I Support Blue Economy — Gujarat Fisheries',
  ip             text,
  device         text,
  browser        text,
  language       text,
  referer        text,
  user_agent     text,
  storage_path   text,          -- file name inside the 'selfies' bucket
  file_size_kb   numeric
);

-- ── 2. Row Level Security ──────────────────────────────────
-- anon (public booth): can INSERT visits + consents
-- authenticated (admin): can SELECT everything

alter table public.visits   enable row level security;
alter table public.consents enable row level security;

create policy "public can insert visits"   on public.visits
  for insert to anon, authenticated with check (true);

create policy "public can insert consents" on public.consents
  for insert to anon, authenticated with check (true);

create policy "admin can read visits"   on public.visits
  for select to authenticated using (true);

create policy "admin can read consents" on public.consents
  for select to authenticated using (true);

-- ── 3. Storage bucket (private — selfies) ──────────────────
insert into storage.buckets (id, name, public)
values ('selfies', 'selfies', false)
on conflict (id) do nothing;

-- anon can upload into 'selfies' (the booth saves the photo)
create policy "public can upload selfies" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'selfies');

-- only authenticated admins can read / delete selfies
create policy "authed can read selfies" on storage.objects
  for select to authenticated
  using (bucket_id = 'selfies');

create policy "authed can delete selfies" on storage.objects
  for delete to authenticated
  using (bucket_id = 'selfies');

-- ── 4. Admin users ─────────────────────────────────────────
-- Create team logins in: Supabase Dashboard → Authentication → Users
-- (Add user → email + password). Those accounts can then open
-- /gallery and /logs in the app.