alter table public.exhibition_records
  add column if not exists note_type text not null default 'exhibition';

alter table public.exhibition_records
  add column if not exists route text;

alter table public.exhibition_records
  drop constraint if exists exhibition_records_note_type_check;

alter table public.exhibition_records
  add constraint exhibition_records_note_type_check
  check (note_type in ('exhibition', 'photographic'));
