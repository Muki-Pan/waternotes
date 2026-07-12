alter table public.exhibition_records
  add column if not exists archive_order integer not null default 0;
