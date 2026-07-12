-- Field Notes Supabase schema.
-- Public visitors can read published records and images.
-- Authenticated owners can create and update records, links, notes, covers, and images.

create table if not exists public.exhibition_records (
  id text primary key,
  title text not null,
  title_zh text,
  institution text,
  city text,
  country text,
  visit_date date not null,
  exhibition_dates text,
  summary text,
  notes jsonb default '[]'::jsonb,
  related_links jsonb default '[]'::jsonb,
  note_type text not null default 'exhibition',
  route text,
  photographic_cover_image_ids jsonb not null default '[]'::jsonb,
  archive_order integer not null default 0,
  cover_src text,
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.exhibition_images (
  id uuid primary key default gen_random_uuid(),
  record_id text not null references public.exhibition_records(id) on delete cascade,
  storage_path text not null,
  src text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.exhibition_records
  add column if not exists cover_src text;

alter table public.exhibition_records
  add column if not exists note_type text not null default 'exhibition';

alter table public.exhibition_records
  add column if not exists route text;

alter table public.exhibition_records
  add column if not exists photographic_cover_image_ids jsonb not null default '[]'::jsonb;

alter table public.exhibition_records
  add column if not exists archive_order integer not null default 0;

alter table public.exhibition_records
  drop constraint if exists exhibition_records_note_type_check;

alter table public.exhibition_records
  add constraint exhibition_records_note_type_check
  check (note_type in ('exhibition', 'photographic', 'field'));

alter table public.exhibition_images
  add column if not exists src text;

alter table public.exhibition_images
  alter column storage_path drop not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exhibition_images'
      and column_name = 'alt'
  ) then
    alter table public.exhibition_images alter column alt drop not null;
  end if;
end $$;

alter table public.exhibition_records enable row level security;
alter table public.exhibition_images enable row level security;

drop policy if exists "Published records are readable" on public.exhibition_records;
drop policy if exists "Published record images are readable" on public.exhibition_images;
drop policy if exists "Owner can maintain records" on public.exhibition_records;
drop policy if exists "Owner can maintain images" on public.exhibition_images;

create policy "Published records are readable"
  on public.exhibition_records
  for select
  using (published = true);

create policy "Published record images are readable"
  on public.exhibition_images
  for select
  using (
    exists (
      select 1
      from public.exhibition_records
      where exhibition_records.id = exhibition_images.record_id
        and exhibition_records.published = true
    )
  );

create policy "Owner can maintain records"
  on public.exhibition_records
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "Owner can maintain images"
  on public.exhibition_images
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

insert into storage.buckets (id, name, public)
values ('field-notes', 'field-notes', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Field Notes images are publicly readable" on storage.objects;
drop policy if exists "Owner can upload Field Notes images" on storage.objects;
drop policy if exists "Owner can update Field Notes images" on storage.objects;
drop policy if exists "Owner can delete Field Notes images" on storage.objects;

create policy "Field Notes images are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'field-notes');

create policy "Owner can upload Field Notes images"
  on storage.objects
  for insert
  with check (bucket_id = 'field-notes' and auth.uid() is not null);

create policy "Owner can update Field Notes images"
  on storage.objects
  for update
  using (bucket_id = 'field-notes' and auth.uid() is not null)
  with check (bucket_id = 'field-notes' and auth.uid() is not null);

create policy "Owner can delete Field Notes images"
  on storage.objects
  for delete
  using (bucket_id = 'field-notes' and auth.uid() is not null);
