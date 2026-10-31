import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";
import { before, after, test } from "node:test";
import pg from "pg";
import { createHash } from "node:crypto";
import { generateAgentToken } from "../../../apps/web/src/lib/agents/token.js";

const connectionString = process.env.TEST_DATABASE_URL;
if (connectionString && !["localhost","127.0.0.1"].includes(new URL(connectionString).hostname)) {
  throw new Error("Tests create auth fixtures: use a disposable localhost database only");
}
const native = connectionString ? new pg.Client({connectionString}) : null;
const embedded = native ? null : new PGlite();
const db = {
  async exec(sql: string) { if(native) await native.query(sql); else await embedded!.exec(sql); },
  async query<T>(sql: string,params: unknown[] = []) {
    if(native) return {rows:(await native.query(sql,params)).rows as T[]};
    return embedded!.query<T>(sql,params);
  },
  async close() { if(native) await native.end(); else await embedded!.close(); },
};
const alice = "00000000-0000-0000-0000-000000000001";
const bob = "00000000-0000-0000-0000-000000000002";
const outsider = "00000000-0000-0000-0000-000000000003";
const ning = "10000000-0000-0000-0000-000000000001";
const cole = "10000000-0000-0000-0000-000000000002";
before(async () => {
  if(native) await native.connect();
  // Only the Supabase-owned auth schema is stubbed; social SQL runs unchanged.
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  for (const name of ["202610310001_owner_profiles.sql", "202610310002_social.sql", "202610310003_agent_access.sql"]) {
    await db.exec(await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8"));
  }
});
after(async () => { await db.close(); });

async function as(user: string) {
  await db.exec(`reset role; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`);
}
async function value(sql: string, params: unknown[] = []) {
  const result = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(result.rows[0] ?? {})[0];
}
async function fixture() {
  await db.exec(`begin;
    insert into auth.users values('${alice}'),('${bob}'),('${outsider}');
    insert into public.owner_profiles(id,display_name) values('${alice}','Alice'),('${bob}','Bob'),('${outsider}','Other');
    insert into public.agents(id,owner_id,display_name) values('${ning}','${alice}','Ning'),('${cole}','${bob}','Cole');`);
}
async function probe(sql: string, pattern: RegExp, params: unknown[] = []) {
  await db.exec("savepoint denial");
  await assert.rejects(db.query(sql, params), pattern);
  await db.exec("rollback to savepoint denial");
}

test("PostgreSQL feed projection and private ownership policies", async () => {
  await fixture();
  try {
    await as(alice);
    await value("select public.social_create_post($1,'A public post')", [ning]);
    await as(bob);
    assert.equal(await value("select count(*)::int from public.social_feed()"), 1);
    assert.equal(await value("select count(*)::int from public.agents"), 1);
    await probe("select * from public.agent_tokens", /permission denied/);
    await probe("insert into public.posts(author_agent_id,body) values($1,'forged')", /permission denied/, [ning]);
    await probe("select public.social_create_post($1,'forged')", /FORBIDDEN/, [ning]);
    await db.exec("reset role; set local role anon");
    await probe("select * from public.posts", /permission denied/);
    await probe("select public.social_feed()", /permission denied/);
    await probe("select public.social_create_post($1,'anonymous')", /permission denied/, [ning]);
  } finally { await db.exec("rollback"); }
});

test("approved transfer is atomic, exact, private to participants, and final", async () => {
  await fixture();
  try {
    await as(alice);
    const post = await value("select public.social_create_post($1,'Public observation')", [ning]);
    await as(bob);
    const inquiry = await value("select public.social_create_inquiry($1,$2,'Question?','Preview')", [cole,post]);
    assert.equal(await value("select count(*)::int from public.consents"), 0);
    assert.equal(await value("select count(*)::int from public.transfers"), 0);
    await as(alice);
    const consent = await value("select id from public.consents where inquiry_id=$1", [inquiry]);
    await as(bob);
    await probe("select public.social_decide_consent($1,true,'not my choice')", /FORBIDDEN/, [consent]);
    await as(outsider);
    assert.equal(await value("select count(*)::int from public.inquiries"), 0);
    assert.equal(await value("select count(*)::int from public.agent_events"), 0);
    await probe("select public.social_decide_consent($1,true,'intrusion')", /FORBIDDEN/, [consent]);
    await as(alice);
    await probe("select public.social_decide_consent($1,true,'')", /check constraint/, [consent]);
    assert.equal(await value("select status from public.consents where id=$1", [consent]), "pending");
    await value("select public.social_decide_consent($1,true,'Approved exact text')", [consent]);
    await probe("select public.social_decide_consent($1,false)", /ALREADY_DECIDED/, [consent]);
    await as(bob);
    assert.equal(await value("select body from public.transfers"), "Approved exact text");
    assert.equal(await value("select payload->>'body' from public.agent_events where type='transfer.delivered'"), "Approved exact text");
    assert.equal(await value("select count(*)::int from public.consents"), 0);
    await as(outsider);
    assert.equal(await value("select count(*)::int from public.transfers"), 0);
    await db.exec("reset role");
    await probe("update public.transfers set body='tampered'", /TRANSFER_IMMUTABLE/);
    await probe("update public.consents set summary_draft='tampered' where id=$1", /ALREADY_DECIDED/, [consent]);
  } finally { await db.exec("rollback"); }
});

test("unapproved and mismatched transfers blocked by PostgreSQL trigger", async () => {
  await fixture();
  try {
    await as(alice);
    const post = await value("select public.social_create_post($1,'Post')", [ning]);
    await as(bob);
    const inquiry = await value("select public.social_create_inquiry($1,$2,'Question','Draft')", [cole,post]);
    await db.exec("reset role");
    const consent = await value("select id from public.consents where inquiry_id=$1", [inquiry]);
    await probe("insert into public.transfers(consent_id,body) values($1,'leak')", /APPROVED_CONSENT_REQUIRED/, [consent]);
    await db.query("update public.consents set status='approved',decided_at=now() where id=$1",[consent]);
    await probe("insert into public.transfers(consent_id,body) values($1,'different')", /APPROVED_CONSENT_REQUIRED/, [consent]);
  } finally { await db.exec("rollback"); }
});

test("decline reveals no draft or reason and enforces directional cooldown", async () => {
  await fixture();
  try {
    await as(alice);
    const post = await value("select public.social_create_post($1,'Post')",[ning]);
    await as(bob);
    const inquiry = await value("select public.social_create_inquiry($1,$2,'Question','Private preview')",[cole,post]);
    await as(alice);
    const consent = await value("select id from public.consents where inquiry_id=$1",[inquiry]);
    await value("select public.social_decide_consent($1,false,'secret reason')",[consent]);
    await as(bob);
    const payload = await value("select payload from public.agent_events where type='inquiry.closed'");
    assert.deepEqual(payload,{inquiryId:inquiry,outcome:"not_shared"});
    assert.equal(await value("select count(*)::int from public.transfers"),0);
    assert.equal(await value("select count(*)::int from public.consents"),0);
    await probe("select public.social_create_inquiry($1,$2,'Again?','Draft')",/COOLDOWN/,[cole,post]);
  } finally { await db.exec("rollback"); }
});

test("rate limit and revoked agent rejection leave no partial rows", async () => {
  await fixture();
  try {
    await as(alice);
    for(let n=0;n<4;n++) await value("select public.social_create_post($1,'Post')",[ning]);
    await probe("select public.social_create_post($1,'Fifth')",/RATE_LIMITED/,[ning]);
    assert.equal(await value("select count(*)::int from public.posts"),4);
    await db.exec("reset role");
    await db.query("update public.agents set revoked_at=now() where id=$1",[cole]);
    await as(bob);
    await probe("select public.social_create_post($1,'Revoked')",/FORBIDDEN/,[cole]);
  } finally { await db.exec("rollback"); }
});

test("hosted staging smoke script runs unchanged and rolls back fixtures", async () => {
  await db.exec(await readFile(new URL("../../../supabase/tests/social-staging.sql",import.meta.url),"utf8"));
  assert.equal(await value("select count(*)::int from public.agents"),0);
});

test("server token generation uses 256 random bits and separates raw secret from stored hash",()=>{
  const first=generateAgentToken(),second=generateAgentToken();
  assert.match(first.token,/^as_[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(first.token.slice(3),'base64url').length,32);
  assert.equal(first.hash,createHash('sha256').update(first.token).digest('hex'));
  assert.equal(first.prefix,first.token.slice(0,11));
  assert.notEqual(first.token,second.token);
});

test("hosted token lifecycle smoke script rolls back synthetic fixtures",async()=>{
  await db.exec(await readFile(new URL("../../../supabase/tests/agent-staging.sql",import.meta.url),"utf8"));
  assert.equal(await value("select count(*)::int from public.agent_tokens"),0);
});

const rawToken = `as_${"A".repeat(43)}`;
const tokenHash = createHash("sha256").update(rawToken).digest("hex");
test("owner registration, one-way token storage, rotation, revocation and scopes",async()=>{
  await fixture();
  try {
    await as(alice);
    const agent=await value("select public.register_agent('Real agent',$1,$2,array['plaza.read','events.read'])",[tokenHash,rawToken.slice(0,11)]);
    assert.equal(await value("select prefix from public.agent_tokens"),rawToken.slice(0,11));
    await probe("select token_hash from public.agent_tokens",/permission denied/);
    await as(bob);
    assert.equal(await value("select count(*)::int from public.agent_tokens"),0);
    await probe("select public.rotate_agent_token($1,$2,$3,array['plaza.read'])",/FORBIDDEN/,[agent,tokenHash,rawToken.slice(0,11)]);
    await db.exec("reset role; set local role anon");
    assert.deepEqual(await value("select public.agent_request($1,'feed')",[rawToken]),[]);
    await probe("select public.agent_request($1,'post','{\"body\":\"forbidden\"}')",/SCOPE/,[rawToken]);
    await probe("select public.agent_request($1,'decide')",/AGENT_CANNOT_DECIDE/,[rawToken]);
    await probe("select public.social_decide_consent(gen_random_uuid(),true,'forged')",/permission denied/);
    await probe("select public.agent_request('invalid','feed')",/UNAUTHORIZED/);
    await as(alice);
    const second=`as_${"B".repeat(43)}`;
    await db.query("select public.rotate_agent_token($1,$2,$3,array['plaza.read','plaza.post','manifest.write'])",[agent,createHash('sha256').update(second).digest('hex'),second.slice(0,11)]);
    await db.exec("reset role; set local role anon");
    await probe("select public.agent_request($1,'feed')",/UNAUTHORIZED/,[rawToken]);
    await value("select public.agent_request($1,'post','{\"body\":\"Real token post\"}')",[second]);
    const manifest=await value("select public.agent_request($1,'manifest','{\"protocol_version\":\"p0a.1\",\"transport\":\"longpoll\"}')",[second]) as Record<string,unknown>;
    assert.equal(manifest.agentId,agent);
    await as(alice);
    const token=await value("select id from public.agent_tokens where revoked_at is null");
    await value("select public.revoke_agent_token($1)",[token]);
    await db.exec("reset role; set local role anon");
    await probe("select public.agent_request($1,'feed')",/UNAUTHORIZED/,[second]);
    await db.exec("reset role");
    assert.equal(await value("select count(*)::int from public.agent_tokens where token_hash=$1",[rawToken]),0);
  } finally{await db.exec("rollback");}
});

test("agent tokens deliver approved events but never pending drafts or other agents' events",async()=>{
  await fixture();
  try{
    await db.query("insert into public.agent_tokens(agent_id,token_hash,prefix,scopes) values($1,$2,$3,array['plaza.post','inquiry.create','inquiry.read','transfer.read','events.read'])",[cole,tokenHash,rawToken.slice(0,11)]);
    await as(alice);
    const post=await value("select public.social_create_post($1,'Owner post')",[ning]);
    await db.exec("reset role; set local role anon");
    const inquiry=await value("select public.agent_request($1,'inquire',jsonb_build_object('postId',$2::text,'question','A question'))",[rawToken,post]) as {inquiryId:string};
    const before=await value("select public.agent_request($1,'inquiries')",[rawToken]);
    assert.ok(!JSON.stringify(before).includes('summary_draft'));
    assert.deepEqual(await value("select public.agent_request($1,'transfers')",[rawToken]),[]);
    assert.deepEqual(await value("select public.agent_request($1,'events')",[rawToken]),[]);
    await as(alice);
    const consent=await value("select id from public.consents where inquiry_id=$1",[inquiry.inquiryId]);
    await value("select public.social_decide_consent($1,true,'Approved response')",[consent]);
    await db.exec("reset role; set local role anon");
    const events=await value("select public.agent_request($1,'events')",[rawToken]) as Array<{id:number;type:string;payload:Record<string,unknown>}>;
    assert.equal(events.length,1);assert.equal(events[0].type,'transfer.delivered');
    assert.equal(events[0].payload.body,'Approved response');
    assert.deepEqual(await value("select public.agent_request($1,'events',jsonb_build_object('cursor',$2::bigint))",[rawToken,events[0].id]),[]);
    const transfers=await value("select public.agent_request($1,'transfers')",[rawToken]) as Array<{body:string}>;
    assert.equal(transfers[0].body,'Approved response');
  }finally{await db.exec("rollback");}
});

test("native PostgreSQL serializes competing rate checks and consent decisions", {skip:!native}, async () => {
  await fixture();
  await db.exec("commit");
  async function concurrent(user: string, sql: string, params: unknown[]) {
    const connection = new pg.Client({connectionString});
    await connection.connect();
    try {
      await connection.query("begin");
      await connection.query("set local role authenticated");
      await connection.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
      const result = await connection.query(sql,params);
      await connection.query("commit");
      return result.rows;
    } catch(error) { await connection.query("rollback"); throw error; }
    finally { await connection.end(); }
  }
  const posts = await Promise.allSettled(Array.from({length:6},()=>concurrent(alice,
    "select public.social_create_post($1,'Concurrent post') as id",[ning])));
  assert.equal(posts.filter(r=>r.status==='fulfilled').length,4);
  for(const result of posts) if(result.status==='rejected') assert.match(String(result.reason),/RATE_LIMITED/);
  const post = (posts.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<Array<{id:string}>>).value[0].id;
  const inquiryRows = await concurrent(bob,"select public.social_create_inquiry($1,$2,'Question','Draft') as id",[cole,post]);
  const consent = await value("select id from public.consents where inquiry_id=$1",[inquiryRows[0].id]);
  const decisions = await Promise.allSettled([true,false].map(approve=>concurrent(alice,
    "select public.social_decide_consent($1,$2,'Approved')",[consent,approve])));
  assert.equal(decisions.filter(r=>r.status==='fulfilled').length,1);
  const rejected = decisions.find(r=>r.status==='rejected') as PromiseRejectedResult;
  assert.match(String(rejected.reason),/ALREADY_DECIDED/);
  assert.equal(await value("select count(*)::int from public.agent_events where type='consent.recorded'"),1);
});
