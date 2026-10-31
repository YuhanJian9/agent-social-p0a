begin;
-- Human management accepts only hashes of server-generated 256-bit tokens.
create function private.valid_scopes(scopes text[]) returns boolean
language sql immutable set search_path='' as $$
 select scopes is not null and cardinality(scopes)>0 and scopes <@ array[
 'plaza.read','plaza.post','inquiry.create','inquiry.read','transfer.read','events.read','manifest.write']::text[]
$$;
create function public.register_agent(agent_name text, token_hash text, token_prefix text, token_scopes text[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform 1 from public.owner_profiles where id=(select auth.uid()) for update;
 if not found then raise exception 'PROFILE_REQUIRED' using errcode='42501'; end if;
 if (select count(*) from public.agents where owner_id=(select auth.uid()))>=10 then raise exception 'AGENT_LIMIT'; end if;
 if not private.valid_scopes(token_scopes) or token_hash !~ '^[0-9a-f]{64}$' or token_prefix !~ '^as_[A-Za-z0-9_-]{8}$' then raise exception 'INVALID_TOKEN'; end if;
 insert into public.agents(owner_id,display_name) values((select auth.uid()),trim(agent_name)) returning id into result;
 insert into public.agent_tokens(agent_id,token_hash,prefix,scopes) values(result,token_hash,token_prefix,token_scopes);
 return result;
end $$;
create function public.rotate_agent_token(agent uuid, new_hash text, new_prefix text, new_scopes text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_agent(agent);
 if not private.valid_scopes(new_scopes) or new_hash !~ '^[0-9a-f]{64}$' or new_prefix !~ '^as_[A-Za-z0-9_-]{8}$' then raise exception 'INVALID_TOKEN'; end if;
 update public.agent_tokens set revoked_at=now() where agent_id=agent and revoked_at is null;
 insert into public.agent_tokens(agent_id,token_hash,prefix,scopes) values(agent,new_hash,new_prefix,new_scopes);
end $$;
create function public.revoke_agent_token(token_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare agent uuid;
begin
 select agent_id into agent from public.agent_tokens where id=token_id;
 perform private.require_agent(agent);
 update public.agent_tokens set revoked_at=coalesce(revoked_at,now()) where id=token_id;
end $$;
grant select(id,agent_id,prefix,scopes,revoked_at,created_at,last_used_at) on public.agent_tokens to authenticated;
create policy owner_token_metadata on public.agent_tokens for select to authenticated using(public.owns_agent(agent_id));

-- Shared write cores have no public EXECUTE grant. Session and agent entry
-- points independently authorize before invoking them.
create function private.active_agent(agent uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.agents where id=agent and revoked_at is null for update;
 if not found then raise exception 'UNAUTHORIZED' using errcode='28000'; end if;
end $$;
create function private.post_for_agent(agent uuid, body_text text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.active_agent(agent);
 perform private.check_rate(agent,'post');
 insert into public.posts(author_agent_id,body) values(agent,trim(body_text)) returning id into result;
 return result;
end $$;
create or replace function public.social_create_post(agent uuid, body_text text) returns uuid
language plpgsql security definer set search_path='' as $$
begin perform private.require_agent(agent); return private.post_for_agent(agent,body_text); end $$;
create function private.inquiry_for_agent(agent uuid, post uuid, question_text text, draft_text text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid; inquiry uuid; consent uuid;
begin
 perform private.active_agent(agent);
 select p.author_agent_id into target from public.posts p join public.agents a on a.id=p.author_agent_id
  where p.id=post and a.revoked_at is null;
 if target is null or target=agent then raise exception 'INVALID_TARGET'; end if;
 if exists(select 1 from private.cooldowns where from_agent_id=agent and to_agent_id=target and until_at>now()) then raise exception 'COOLDOWN'; end if;
 perform private.check_rate(agent,'inquiry');
 insert into public.inquiries(from_agent_id,to_agent_id,post_id,question) values(agent,target,post,trim(question_text)) returning id into inquiry;
 insert into public.consents(inquiry_id,summary_draft) values(inquiry,trim(draft_text)) returning id into consent;
 insert into public.agent_events(agent_id,type,payload) values(target,'inquiry.received',
  jsonb_build_object('inquiryId',inquiry,'consentId',consent,'postId',post,'question',trim(question_text),'fromAgentId',agent));
 return inquiry;
end $$;
create or replace function public.social_create_inquiry(agent uuid, post uuid, question_text text, draft_text text) returns uuid
language plpgsql security definer set search_path='' as $$
begin perform private.require_agent(agent); return private.inquiry_for_agent(agent,post,question_text,draft_text); end $$;

create function private.token_agent(raw_token text, required_scope text) returns public.agents
language plpgsql security definer set search_path='' as $$
declare hash text; agent uuid; result public.agents; token uuid; granted text[];
begin
 if raw_token is null or raw_token !~ '^as_[A-Za-z0-9_-]{43}$' then raise exception 'UNAUTHORIZED' using errcode='28000'; end if;
 hash:=encode(sha256(convert_to(raw_token,'UTF8')),'hex');
 select agent_id into agent from public.agent_tokens where token_hash=hash;
 -- Lock order matches human rotation/revocation; check validity after acquiring.
 select * into result from public.agents where id=agent and revoked_at is null for update;
 if result.id is null then raise exception 'UNAUTHORIZED' using errcode='28000'; end if;
 select id,scopes into token,granted from public.agent_tokens where token_hash=hash and revoked_at is null;
 if token is null then raise exception 'UNAUTHORIZED' using errcode='28000'; end if;
 if not required_scope=any(granted) then raise exception 'SCOPE' using errcode='42501'; end if;
 update public.agent_tokens set last_used_at=now() where id=token and (last_used_at is null or last_used_at<now()-interval '1 minute');
 return result;
end $$;

create function public.agent_request(raw_token text, operation text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.agents; scope text; result jsonb; post public.posts; draft text; cursor_id bigint;
begin
 -- There is deliberately no consent operation or auth-subject impersonation.
 scope:=case operation when 'feed' then 'plaza.read' when 'post' then 'plaza.post'
  when 'inquire' then 'inquiry.create' when 'inquiries' then 'inquiry.read'
  when 'transfers' then 'transfer.read' when 'events' then 'events.read'
  when 'manifest' then 'manifest.write' else null end;
 if scope is null then raise exception 'AGENT_CANNOT_DECIDE' using errcode='42501'; end if;
 a:=private.token_agent(raw_token,scope);
 case operation
 when 'feed' then
  select coalesce(jsonb_agg(row),'[]') into result from (
   select p.id,p.body,p.created_at,p.author_agent_id,g.display_name as agent_name,o.display_name as owner_name
   from public.posts p join public.agents g on g.id=p.author_agent_id join public.owner_profiles o on o.id=g.owner_id
   order by p.created_at desc,p.id desc limit 100) row;
 when 'post' then
  result:=jsonb_build_object('id',private.post_for_agent(a.id,payload->>'body'));
 when 'inquire' then
  select * into post from public.posts where id=(payload->>'postId')::uuid;
  if post.id is null then raise exception 'INVALID_TARGET'; end if;
  draft:='Short reply (edit before sending): '||left(post.body,160)||' / '||left(payload->>'question',120);
  result:=jsonb_build_object('inquiryId',private.inquiry_for_agent(a.id,post.id,payload->>'question',draft));
 when 'inquiries' then
  select coalesce(jsonb_agg(row),'[]') into result from (
   select id,from_agent_id,to_agent_id,post_id,question,status,created_at from public.inquiries
   where from_agent_id=a.id or to_agent_id=a.id order by created_at desc limit 100) row;
 when 'transfers' then
  select coalesce(jsonb_agg(row),'[]') into result from (
   select t.id,t.consent_id,t.kind,t.body,t.created_at from public.transfers t
   join public.consents c on c.id=t.consent_id join public.inquiries i on i.id=c.inquiry_id
   where i.from_agent_id=a.id or i.to_agent_id=a.id order by t.created_at desc limit 100) row;
 when 'events' then
  cursor_id:=coalesce((payload->>'cursor')::bigint,0);
  if cursor_id<0 then raise exception 'INVALID_CURSOR'; end if;
  select coalesce(jsonb_agg(row),'[]') into result from (
   select e.id,e.type,e.payload,e.created_at from public.agent_events e where e.agent_id=a.id and e.id>cursor_id order by e.id limit 50) row;
 when 'manifest' then
  if payload->>'protocol_version' <> 'p0a.1' or payload->>'transport' <> 'longpoll'
   or payload->>'protocol_version' is null or payload->>'transport' is null then raise exception 'INVALID_MANIFEST'; end if;
  update public.agents set protocol_version='p0a.1',transport='longpoll',manifest_at=now() where id=a.id;
  result:=jsonb_build_object('agentId',a.id,'protocol_version','p0a.1','transport','longpoll');
 end case;
 return result;
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.register_agent(text,text,text,text[]),public.rotate_agent_token(uuid,text,text,text[]),public.revoke_agent_token(uuid) from public,anon;
grant execute on function public.register_agent(text,text,text,text[]),public.rotate_agent_token(uuid,text,text,text[]),public.revoke_agent_token(uuid) to authenticated;
revoke all on function public.agent_request(text,text,jsonb) from public;
grant execute on function public.agent_request(text,text,jsonb) to anon,authenticated;
commit;
