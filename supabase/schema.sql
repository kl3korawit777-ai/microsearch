-- Microsearch admin schema
-- รันใน Supabase Dashboard → SQL Editor → New query → Paste → Run

-- =========== TABLE ===========
create table if not exists public.microbes (
  id            text primary key,
  name          text not null,
  thai          text,
  kingdom       text not null check (kingdom in ('bacteria','virus','parasite')),
  icon          text default '🦠',
  image         text,
  categories    text[] default '{}',
  characteristics text,
  pathogenesis  text,
  vector        text,
  additional    text,
  refs          text[] default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists microbes_kingdom_idx on public.microbes(kingdom);
create index if not exists microbes_name_idx    on public.microbes using gin (to_tsvector('simple', name));

-- auto-update updated_at
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_microbes_updated on public.microbes;
create trigger trg_microbes_updated
before update on public.microbes
for each row execute function public.set_updated_at();

-- =========== RLS ===========
alter table public.microbes enable row level security;

-- ทุกคนอ่านได้ (public site อาจ fetch ตรงในอนาคต — ตอนนี้ snapshot ก็ยังต้องเปิด read ให้ admin)
drop policy if exists "read all" on public.microbes;
create policy "read all" on public.microbes
  for select using (true);

-- เฉพาะ authenticated เท่านั้นที่เขียนได้
drop policy if exists "auth insert" on public.microbes;
create policy "auth insert" on public.microbes
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "auth update" on public.microbes;
create policy "auth update" on public.microbes
  for update using (auth.role() = 'authenticated');

drop policy if exists "auth delete" on public.microbes;
create policy "auth delete" on public.microbes
  for delete using (auth.role() = 'authenticated');
