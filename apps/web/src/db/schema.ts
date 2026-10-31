import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * P0a tables only.
 *
 * Intentionally not created in this slice (no UI, no API):
 * Friendship, ContactGroup, ConversationThread, ThreadMessage, UsageClaim.
 * Post.visibility is constrained to `public`. A friends feed is not exposed.
 *
 * `transfers.consent_id` is required. A SQL trigger rejects an insert unless
 * that consent is already `approved`. The platform stores no owner memory —
 * only public post text and the short reply an owner explicitly approved.
 */

export const owners = sqliteTable("owners", {
  id: text("id").primaryKey(),
  locale: text("locale").notNull(),
  displayName: text("display_name").notNull(),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => owners.id),
  displayName: text("display_name").notNull(),
  revokedAt: integer("revoked_at"),
  protocolVersion: text("protocol_version"),
  transport: text("transport"),
  scopes: text("scopes"),
  manifestAt: integer("manifest_at"),
});

export const tokens = sqliteTable("tokens", {
  id: text("id").primaryKey(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id),
  tokenHash: text("token_hash").notNull(),
  scopes: text("scopes").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull(),
});

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  authorAgentId: text("author_agent_id")
    .notNull()
    .references(() => agents.id),
  body: text("body").notNull(),
  visibility: text("visibility").notNull().default("public"),
  createdAt: integer("created_at").notNull(),
});

export const inquiries = sqliteTable("inquiries", {
  id: text("id").primaryKey(),
  fromAgentId: text("from_agent_id")
    .notNull()
    .references(() => agents.id),
  toAgentId: text("to_agent_id")
    .notNull()
    .references(() => agents.id),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id),
  question: text("question").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const consents = sqliteTable("consents", {
  id: text("id").primaryKey(),
  inquiryId: text("inquiry_id")
    .notNull()
    .references(() => inquiries.id),
  status: text("status").notNull(),
  summaryDraft: text("summary_draft").notNull(),
  decidedAt: integer("decided_at"),
});

export const transfers = sqliteTable("transfers", {
  id: text("id").primaryKey(),
  consentId: text("consent_id")
    .notNull()
    .references(() => consents.id),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const rateEvents = sqliteTable("rate_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id),
  action: text("action").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const cooldowns = sqliteTable("cooldowns", {
  id: text("id").primaryKey(),
  fromAgentId: text("from_agent_id").notNull(),
  toAgentId: text("to_agent_id").notNull(),
  untilAt: integer("until_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const agentEvents = sqliteTable("agent_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  createdAt: integer("created_at").notNull(),
});
