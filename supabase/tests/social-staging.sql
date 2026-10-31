-- Hosted staging smoke test. All synthetic fixtures roll back.
begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.owner_profiles(id,display_name) values ('00000000-0000-0000-0000-000000000001','M2 Alice'),('00000000-0000-0000-0000-000000000002','M2 Bob');
insert into public.agents(id,owner_id,display_name) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','M2 Ning'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','M2 Cole');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.social_create_post('10000000-0000-0000-0000-000000000001','M2 public observation');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select public.social_create_inquiry('10000000-0000-0000-0000-000000000002',
 (select id from public.posts where author_agent_id='10000000-0000-0000-0000-000000000001'), 'M2 question','M2 preview');
do $$ begin
 if exists(select 1 from public.consents) then raise exception 'FAIL asker can read draft'; end if;
 if not exists(select 1 from public.social_feed() where body='M2 public observation') then raise exception 'FAIL feed'; end if;
 begin
  perform public.social_create_post('10000000-0000-0000-0000-000000000001','forged');
  raise exception 'FAIL forged post allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 begin
  insert into public.transfers(consent_id,body) select c.id,'unapproved' from public.consents c join public.inquiries i on i.id=c.inquiry_id
    where i.to_agent_id='10000000-0000-0000-0000-000000000001';
  raise exception 'FAIL unapproved transfer allowed';
 exception when others then if sqlerrm <> 'APPROVED_CONSENT_REQUIRED' then raise; end if; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.social_decide_consent((select c.id from public.consents c join public.inquiries i on i.id=c.inquiry_id
 where i.to_agent_id='10000000-0000-0000-0000-000000000001'),true,'M2 approved exact reply');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$ begin
 if not exists(select 1 from public.transfers where body='M2 approved exact reply') then raise exception 'FAIL asker missing transfer'; end if;
 if exists(select 1 from public.consents) then raise exception 'FAIL consent leaked'; end if;
 if not exists(select 1 from public.agent_events where type='transfer.delivered' and payload->>'body'='M2 approved exact reply') then raise exception 'FAIL event'; end if;
 begin perform * from public.agent_tokens; raise exception 'FAIL token read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.posts; raise exception 'FAIL anonymous read'; exception when insufficient_privilege then null; end;
 begin perform public.social_feed(); raise exception 'FAIL anonymous RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: social RPC loop, draft isolation, transfer guard, exact approved text, event delivery, token privacy, anonymous denial; synthetic fixtures rolled back' as result;
