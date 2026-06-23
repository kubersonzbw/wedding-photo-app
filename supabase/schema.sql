create extension if not exists "pgcrypto";

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  access_code_hash text not null,
  gallery_code_hash text not null,
  created_at timestamptz not null default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  storage_path text not null unique,
  original_filename text,
  mime_type text not null,
  size_bytes bigint not null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index photos_event_id_idx on public.photos(event_id);
create index photos_status_idx on public.photos(status);
create index photos_created_at_idx on public.photos(created_at desc);
create index guests_event_id_idx on public.guests(event_id);

alter table public.events enable row level security;
alter table public.guests enable row level security;
alter table public.photos enable row level security;

create policy "Admins can read events" on public.events for select to authenticated using (true);
create policy "Admins can manage guests" on public.guests for all to authenticated using (true) with check (true);
create policy "Admins can manage photos" on public.photos for all to authenticated using (true) with check (true);
-- Public users do not receive direct SELECT/INSERT/UPDATE/DELETE policies; public flows use trusted server endpoints with the service role key.

-- MVP flow: new uploads should appear in the gallery immediately.
alter table public.photos alter column status set default 'approved';

-- Optional backfill for old test uploads that were waiting for approval.
-- update public.photos set status = 'approved' where status = 'pending';
