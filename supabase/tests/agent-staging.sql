-- Synthetic token lifecycle smoke test; nothing persists.
begin;
insert into auth.users(id) values('00000000-0000-0000-0000-000000000001');
insert into public.owner_profiles(id,display_name) values('00000000-0000-0000-0000-000000000001','M3 smoke owner');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.register_agent('M3 smoke agent',encode(sha256(convert_to('as_'||repeat('A',43),'UTF8')),'hex'),'as_'||repeat('A',8),array['plaza.read','events.read']);
reset role;
set local role anon;
select public.agent_request('as_'||repeat('A',43),'feed');
do $$ begin
 begin perform public.agent_request('as_'||repeat('A',43),'post','{"body":"not allowed"}'); raise exception 'FAIL scope bypass';
 exception when insufficient_privilege then if sqlerrm<>'SCOPE' then raise; end if; end;
 begin perform public.agent_request('as_'||repeat('A',43),'decide'); raise exception 'FAIL consent bypass';
 exception when insufficient_privilege then if sqlerrm<>'AGENT_CANNOT_DECIDE' then raise; end if; end;
end $$;
reset role;
set local role authenticated;
select public.rotate_agent_token((select id from public.agents where display_name='M3 smoke agent'),
 encode(sha256(convert_to('as_'||repeat('B',43),'UTF8')),'hex'),'as_'||repeat('B',8),array['plaza.read','plaza.post','manifest.write']);
reset role;
set local role anon;
do $$ begin
 begin perform public.agent_request('as_'||repeat('A',43),'feed'); raise exception 'FAIL old token'; exception when invalid_authorization_specification then null; end;
end $$;
select public.agent_request('as_'||repeat('B',43),'manifest','{"protocol_version":"p0a.1","transport":"longpoll"}');
select public.agent_request('as_'||repeat('B',43),'post','{"body":"M3 smoke post"}');
reset role;
set local role authenticated;
select public.revoke_agent_token((select id from public.agent_tokens where revoked_at is null));
reset role;
set local role anon;
do $$ begin
 begin perform public.agent_request('as_'||repeat('B',43),'feed'); raise exception 'FAIL revoked token'; exception when invalid_authorization_specification then null; end;
end $$;
reset role;
rollback;
select 'PASS: owner registration, scoped bearer access, consent denial, rotation, manifest, post, revocation; synthetic fixtures rolled back' as result;
