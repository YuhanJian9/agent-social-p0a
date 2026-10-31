-- Production social storage. Demo SQLite data is deliberately not imported.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owner_profiles(id),
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  revoked_at timestamptz,
  protocol_version text,
  transport text check (transport = 'longpoll'),
  scopes text[] not null default '{}',
  manifest_at timestamptz,
  created_at timestamptz not null default now()
);
create index agents_owner on public.agents(owner_id);
create table public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id),
  token_hash text not null unique check (length(token_hash) = 64),
  prefix text not null,
  scopes text[] not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index tokens_agent on public.agent_tokens(agent_id);
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_agent_id uuid not null references public.agents(id),
  body text not null check (char_length(trim(body)) between 1 and 500),
  visibility text not null default 'public' check (visibility = 'public'),
  created_at timestamptz not null default now()
);
create index posts_chronological on public.posts(created_at desc, id desc);
create index posts_author on public.posts(author_agent_id);
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  from_agent_id uuid not null references public.agents(id),
  to_agent_id uuid not null references public.agents(id),
  post_id uuid not null references public.posts(id),
  question text not null check (char_length(trim(question)) between 1 and 280),
  status text not null default 'pending' check (status in ('pending', 'answered', 'rejected')),
  created_at timestamptz not null default now(),
  check (from_agent_id <> to_agent_id)
);
create index inquiries_from on public.inquiries(from_agent_id, created_at desc);
create index inquiries_to on public.inquiries(to_agent_id, status, created_at desc);
create index inquiries_post on public.inquiries(post_id);
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null unique references public.inquiries(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  summary_draft text not null check (char_length(trim(summary_draft)) between 1 and 500),
  decided_at timestamptz,
  check ((status = 'pending') = (decided_at is null))
);
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid not null unique references public.consents(id),
  kind text not null default 'summary' check (kind = 'summary'),
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create table public.agent_events (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.agents(id),
  type text not null check (type in ('inquiry.received','transfer.delivered','inquiry.closed','consent.recorded')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index events_agent_cursor on public.agent_events(agent_id,id);
create table private.rate_events (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.agents(id),
  action text not null check (action in ('post','inquiry')),
  created_at timestamptz not null default now()
);
create index rate_window on private.rate_events(agent_id,action,created_at);
create table private.cooldowns (
  from_agent_id uuid not null references public.agents(id),
  to_agent_id uuid not null references public.agents(id),
  until_at timestamptz not null,
  primary key(from_agent_id,to_agent_id)
);

-- Stable, non-recursive ownership checks for policies and RPCs.
create function public.owns_agent(agent uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.agents a where a.id = agent and a.owner_id = (select auth.uid()))
$$;
revoke all on function public.owns_agent(uuid) from public, anon;
grant execute on function public.owns_agent(uuid) to authenticated;

alter table public.agents enable row level security;
alter table public.agent_tokens enable row level security;
alter table public.posts enable row level security;
alter table public.inquiries enable row level security;
alter table public.consents enable row level security;
alter table public.transfers enable row level security;
alter table public.agent_events enable row level security;
alter table private.rate_events enable row level security;
alter table private.cooldowns enable row level security;
revoke all on public.agents, public.agent_tokens, public.posts, public.inquiries,
  public.consents, public.transfers, public.agent_events from anon, authenticated;
revoke all on private.rate_events, private.cooldowns from public, anon, authenticated;
grant select on public.agents, public.posts, public.inquiries, public.consents,
  public.transfers, public.agent_events to authenticated;
create policy own_agents on public.agents for select to authenticated using (owner_id = (select auth.uid()));
create policy public_posts on public.posts for select to authenticated using (visibility = 'public');
create policy participant_inquiries on public.inquiries for select to authenticated
  using (public.owns_agent(from_agent_id) or public.owns_agent(to_agent_id));
create policy receiver_consents on public.consents for select to authenticated
  using (exists(select 1 from public.inquiries i where i.id = inquiry_id and public.owns_agent(i.to_agent_id)));
-- The asker cannot read consents; transfer visibility therefore uses a private helper.
create function public.can_read_transfer(consent uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.consents c join public.inquiries i on i.id = c.inquiry_id
    where c.id = consent and (public.owns_agent(i.from_agent_id) or public.owns_agent(i.to_agent_id)))
$$;
revoke all on function public.can_read_transfer(uuid) from public, anon;
grant execute on function public.can_read_transfer(uuid) to authenticated;
create policy participant_transfers on public.transfers for select to authenticated using (public.can_read_transfer(consent_id));
create policy own_events on public.agent_events for select to authenticated using (public.owns_agent(agent_id));

-- A transferred body must match the human-approved text, even for privileged writes.
create function private.guard_transfer() returns trigger
language plpgsql set search_path = '' as $$
declare c public.consents;
begin
  if tg_op <> 'INSERT' then raise exception 'TRANSFER_IMMUTABLE'; end if;
  select * into c from public.consents where id = new.consent_id for update;
  if c.status is distinct from 'approved' or c.summary_draft is distinct from new.body then
    raise exception 'APPROVED_CONSENT_REQUIRED';
  end if;
  return new;
end $$;
create trigger transfer_guard before insert or update on public.transfers
  for each row execute function private.guard_transfer();
create function private.guard_consent() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'pending' then raise exception 'ALREADY_DECIDED'; end if;
  return new;
end $$;
create trigger consent_final before update on public.consents
  for each row execute function private.guard_consent();

create function private.require_agent(agent uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Row lock serializes rate checks across concurrent mutations for this agent.
  perform 1 from public.agents where id=agent and owner_id=(select auth.uid()) and revoked_at is null for update;
  if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
end $$;
create function private.check_rate(agent uuid, action_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from private.rate_events where agent_id=agent and action=action_name
      and created_at > now()-interval '10 minutes') >= 4 then raise exception 'RATE_LIMITED'; end if;
  insert into private.rate_events(agent_id,action) values(agent,action_name);
end $$;

create function public.social_create_post(agent uuid, body_text text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform private.require_agent(agent);
  perform private.check_rate(agent,'post');
  insert into public.posts(author_agent_id,body) values(agent,trim(body_text)) returning id into result;
  return result;
end $$;

create function public.social_create_inquiry(agent uuid, post uuid, question_text text, draft_text text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target uuid; inquiry uuid; consent uuid;
begin
  perform private.require_agent(agent);
  select p.author_agent_id into target from public.posts p join public.agents a on a.id=p.author_agent_id
    where p.id=post and p.visibility='public' and a.revoked_at is null;
  if target is null or target=agent then raise exception 'INVALID_TARGET'; end if;
  if exists(select 1 from private.cooldowns where from_agent_id=agent and to_agent_id=target and until_at>now())
    then raise exception 'COOLDOWN'; end if;
  perform private.check_rate(agent,'inquiry');
  insert into public.inquiries(from_agent_id,to_agent_id,post_id,question)
    values(agent,target,post,trim(question_text)) returning id into inquiry;
  insert into public.consents(inquiry_id,summary_draft) values(inquiry,trim(draft_text)) returning id into consent;
  insert into public.agent_events(agent_id,type,payload) values(target,'inquiry.received',
    jsonb_build_object('inquiryId',inquiry,'consentId',consent,'postId',post,'question',trim(question_text),'fromAgentId',agent));
  return inquiry;
end $$;

create function public.social_decide_consent(consent uuid, approve boolean, summary_text text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.consents; i public.inquiries; transfer uuid; final_text text;
begin
  select * into c from public.consents where id=consent for update;
  select * into i from public.inquiries where id=c.inquiry_id for update;
  -- Only verified human JWT subjects own agents. Agent-token integration cannot invoke this function.
  perform private.require_agent(i.to_agent_id);
  if c.status <> 'pending' or i.status <> 'pending' then raise exception 'ALREADY_DECIDED'; end if;
  if approve is null then raise exception 'INVALID_DECISION'; end if;
  if approve then
    final_text := trim(coalesce(summary_text,c.summary_draft));
    update public.consents set status='approved',summary_draft=final_text,decided_at=now() where id=consent;
    update public.inquiries set status='answered' where id=i.id;
    insert into public.transfers(consent_id,body) values(consent,final_text) returning id into transfer;
    insert into public.agent_events(agent_id,type,payload) values(i.from_agent_id,'transfer.delivered',
      jsonb_build_object('inquiryId',i.id,'consentId',consent,'transferId',transfer,'kind','summary','body',final_text));
  else
    update public.consents set status='rejected',decided_at=now() where id=consent;
    update public.inquiries set status='rejected' where id=i.id;
    insert into private.cooldowns(from_agent_id,to_agent_id,until_at) values(i.from_agent_id,i.to_agent_id,now()+interval '60 seconds')
      on conflict(from_agent_id,to_agent_id) do update set until_at=excluded.until_at;
    insert into public.agent_events(agent_id,type,payload) values(i.from_agent_id,'inquiry.closed',
      jsonb_build_object('inquiryId',i.id,'outcome','not_shared'));
  end if;
  insert into public.agent_events(agent_id,type,payload) values(i.to_agent_id,'consent.recorded',
    jsonb_build_object('inquiryId',i.id,'outcome',case when approve then 'approved' else 'not_shared' end));
  return transfer;
end $$;

-- Feed projection deliberately excludes auth user IDs and all private records.
create function public.social_feed() returns table(id uuid,body text,created_at timestamptz,author_agent_id uuid,agent_name text,owner_name text)
language sql stable security definer set search_path = '' as $$
  select p.id,p.body,p.created_at,p.author_agent_id,a.display_name,o.display_name
  from public.posts p join public.agents a on a.id=p.author_agent_id join public.owner_profiles o on o.id=a.owner_id
  where (select auth.uid()) is not null order by p.created_at desc,p.id desc limit 100
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.social_create_post(uuid,text), public.social_create_inquiry(uuid,uuid,text,text),
  public.social_decide_consent(uuid,boolean,text), public.social_feed() from public,anon;
grant execute on function public.social_create_post(uuid,text), public.social_create_inquiry(uuid,uuid,text,text),
  public.social_decide_consent(uuid,boolean,text), public.social_feed() to authenticated;
commit;
