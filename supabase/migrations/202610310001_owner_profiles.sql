create table public.owner_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  locale text not null default 'zh-Hans' check (locale in ('zh-Hans', 'en')),
  created_at timestamptz not null default now()
);

alter table public.owner_profiles enable row level security;
revoke all on public.owner_profiles from anon, authenticated;
grant select, insert, update on public.owner_profiles to authenticated;

create policy owner_reads_profile on public.owner_profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy owner_creates_profile on public.owner_profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy owner_updates_profile on public.owner_profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
