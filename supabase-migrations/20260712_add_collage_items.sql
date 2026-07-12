create table if not exists public.collage_items (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text not null,
  anchor_date date not null,
  x_ratio numeric not null default 0.82,
  offset_y numeric not null default 120,
  width numeric not null default 210,
  rotation numeric not null default 0,
  z_index integer not null default 1,
  related_note_id text null,
  alt_text text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collage_items enable row level security;

drop policy if exists "Collage items are publicly readable" on public.collage_items;
drop policy if exists "Owner can maintain collage items" on public.collage_items;

create policy "Collage items are publicly readable"
  on public.collage_items for select using (true);

create policy "Owner can maintain collage items"
  on public.collage_items for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
