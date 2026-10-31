-- Run against an isolated Supabase database after the migration.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);
insert into auth.users (id) values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
insert into public.owner_profiles (id, display_name) values
 ('00000000-0000-0000-0000-000000000001', 'Alice'),
 ('00000000-0000-0000-0000-000000000002', 'Bob');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.owner_profiles), 1, 'only own profile is readable');
select is((select display_name from public.owner_profiles), 'Alice', 'correct owner is returned');
update public.owner_profiles set display_name = 'Changed' where id = '00000000-0000-0000-0000-000000000002';
select throws_ok($$insert into public.owner_profiles(id, display_name) values ('00000000-0000-0000-0000-000000000003', 'Forged')$$, '42501', null, 'cannot create another owner profile');
reset role;
select is((select display_name from public.owner_profiles where id = '00000000-0000-0000-0000-000000000002'), 'Bob', 'cross-owner update has no effect');
set local role anon;
select throws_ok('select * from public.owner_profiles', '42501', null, 'anonymous access denied');
reset role;
select * from finish();
rollback;
