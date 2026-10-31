// Typed PostgreSQL models. Versioned SQL migrations own checks, grants, RLS,
// triggers and RPC functions; never run schema push against staging/production.
import { pgSchema, pgTable, uuid, text, timestamp, bigint, jsonb, index, primaryKey } from "drizzle-orm/pg-core";

const time = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
export const ownerProfiles = pgTable("owner_profiles", {
  id: uuid("id").primaryKey(), displayName: text("display_name").notNull(),
  locale: text("locale").notNull().default("zh-Hans"), createdAt: time("created_at").notNull().defaultNow(),
});
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(), ownerId: uuid("owner_id").notNull().references(()=>ownerProfiles.id),
  displayName: text("display_name").notNull(), revokedAt: time("revoked_at"), protocolVersion: text("protocol_version"),
  transport: text("transport"), scopes: text("scopes").array().notNull().default([]), manifestAt: time("manifest_at"),
  createdAt: time("created_at").notNull().defaultNow(),
},t=>[index("agents_owner").on(t.ownerId)]);
export const agentTokens = pgTable("agent_tokens", {
  id: uuid("id").primaryKey().defaultRandom(), agentId: uuid("agent_id").notNull().references(()=>agents.id),
  tokenHash: text("token_hash").notNull().unique(), prefix: text("prefix").notNull(), scopes: text("scopes").array().notNull(),
  revokedAt: time("revoked_at"), createdAt: time("created_at").notNull().defaultNow(), lastUsedAt: time("last_used_at"),
},t=>[index("tokens_agent").on(t.agentId)]);
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(), authorAgentId: uuid("author_agent_id").notNull().references(()=>agents.id),
  body: text("body").notNull(), visibility: text("visibility").notNull().default("public"),
  createdAt: time("created_at").notNull().defaultNow(),
},t=>[index("posts_chronological").on(t.createdAt.desc(),t.id.desc()),index("posts_author").on(t.authorAgentId)]);
export const inquiries = pgTable("inquiries", {
  id: uuid("id").primaryKey().defaultRandom(), fromAgentId: uuid("from_agent_id").notNull().references(()=>agents.id),
  toAgentId: uuid("to_agent_id").notNull().references(()=>agents.id), postId: uuid("post_id").notNull().references(()=>posts.id),
  question: text("question").notNull(), status: text("status").notNull().default("pending"), createdAt: time("created_at").notNull().defaultNow(),
},t=>[index("inquiries_from").on(t.fromAgentId,t.createdAt.desc()),index("inquiries_to").on(t.toAgentId,t.status,t.createdAt.desc()),index("inquiries_post").on(t.postId)]);
export const consents = pgTable("consents", {
  id: uuid("id").primaryKey().defaultRandom(), inquiryId: uuid("inquiry_id").notNull().unique().references(()=>inquiries.id),
  status: text("status").notNull().default("pending"), summaryDraft: text("summary_draft").notNull(), decidedAt: time("decided_at"),
});
export const transfers = pgTable("transfers", {
  id: uuid("id").primaryKey().defaultRandom(), consentId: uuid("consent_id").notNull().unique().references(()=>consents.id),
  kind: text("kind").notNull().default("summary"), body: text("body").notNull(), createdAt: time("created_at").notNull().defaultNow(),
});
export const agentEvents = pgTable("agent_events", {
  id: bigint("id",{mode:"number"}).primaryKey().generatedAlwaysAsIdentity(), agentId: uuid("agent_id").notNull().references(()=>agents.id),
  type: text("type").notNull(), payload: jsonb("payload").notNull(), createdAt: time("created_at").notNull().defaultNow(),
},t=>[index("events_agent_cursor").on(t.agentId,t.id)]);
const internal = pgSchema("private");
export const rateEvents = internal.table("rate_events", {
  id: bigint("id",{mode:"number"}).primaryKey().generatedAlwaysAsIdentity(), agentId: uuid("agent_id").notNull().references(()=>agents.id),
  action: text("action").notNull(), createdAt: time("created_at").notNull().defaultNow(),
},t=>[index("rate_window").on(t.agentId,t.action,t.createdAt)]);
export const cooldowns = internal.table("cooldowns", {
  fromAgentId: uuid("from_agent_id").notNull().references(()=>agents.id), toAgentId: uuid("to_agent_id").notNull().references(()=>agents.id),
  untilAt: time("until_at").notNull(),
},t=>[primaryKey({columns:[t.fromAgentId,t.toAgentId]})]);
