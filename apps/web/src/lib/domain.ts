import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, isNull, or } from "drizzle-orm";
import { getDb, getSqlite, type AppDb } from "@/db";
import {
  agentEvents,
  agents,
  consents,
  cooldowns,
  inquiries,
  owners,
  posts,
  rateEvents,
  tokens,
  transfers,
} from "@/db/schema";
import { seedIfEmpty } from "@/db/seed";
import { DEMO } from "@/lib/constants";
import { buildSummaryDraft } from "@/lib/draft";
import { DomainError } from "@/lib/errors";
import { isLocale, type Locale } from "@/i18n/locale";
import { LIMITS, TOKEN_SCOPES } from "@/lib/limits";
import { excerpt } from "@/lib/text";

type Db = AppDb;

export type ActorVia = "session" | "token";

export type InboxItem = {
  inquiryId: string;
  consentId: string;
  postId: string;
  postExcerpt: string;
  question: string;
  role: "asker" | "askee";
  status: "pending" | "answered" | "rejected";
  counterpartAgentName: string;
  counterpartOwnerName: string;
  createdAt: number;
  summaryDraft: string | null;
  transfer: { consentId: string; kind: "summary"; body: string } | null;
};

export type PlazaPost = {
  id: string;
  body: string;
  createdAt: number;
  authorAgentId: string;
  authorAgentName: string;
  authorOwnerName: string;
  mine: boolean;
  replies: Array<{
    inquiryId: string;
    body: string;
    createdAt: number;
    direction: "received" | "sent";
  }>;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseScopes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function assertScope(scopes: string[] | null, scope: string) {
  if (!scopes) return;
  if (!scopes.includes(scope)) {
    throw new DomainError(403, "SCOPE", "error.scope");
  }
}

export function getOwner(ownerId: string) {
  return getDb().select().from(owners).where(eq(owners.id, ownerId)).get() ?? null;
}

export function getAgentByOwner(ownerId: string) {
  return getDb().select().from(agents).where(eq(agents.ownerId, ownerId)).get() ?? null;
}

function requireActiveAgent(agentId: string) {
  const agent = getDb().select().from(agents).where(eq(agents.id, agentId)).get();
  if (!agent) throw new DomainError(401, "UNAUTHORIZED", "error.unauthorized");
  if (agent.revokedAt) throw new DomainError(401, "REVOKED", "error.revoked");
  return agent;
}

export function listIdentities() {
  const db = getDb();
  const rows = db.select().from(owners).all();
  const order = [DEMO.zhou.ownerId, DEMO.mara.ownerId];
  return rows
    .map((owner) => {
      const agent = db.select().from(agents).where(eq(agents.ownerId, owner.id)).get();
      return {
        ownerId: owner.id,
        ownerName: owner.displayName,
        locale: owner.locale,
        agentId: agent?.id ?? "",
        agentName: agent?.displayName ?? "",
        revokedAt: agent?.revokedAt ?? null,
      };
    })
    .sort((a, b) => order.indexOf(a.ownerId) - order.indexOf(b.ownerId));
}

export function bindOwner(ownerId: string) {
  const db = getDb();
  const owner = db.select().from(owners).where(eq(owners.id, ownerId)).get();
  if (!owner) throw new DomainError(404, "NOT_FOUND", "error.not_found");
  const agent = db.select().from(agents).where(eq(agents.ownerId, ownerId)).get();
  if (!agent) throw new DomainError(404, "NOT_FOUND", "error.not_found");

  const plain = `p0a_${randomUUID()}`;
  const now = Date.now();
  db.transaction((tx) => {
    tx.update(agents).set({ revokedAt: null }).where(eq(agents.id, agent.id)).run();
    tx.update(tokens)
      .set({ revokedAt: now })
      .where(and(eq(tokens.agentId, agent.id), isNull(tokens.revokedAt)))
      .run();
    tx.insert(tokens)
      .values({
        id: randomUUID(),
        agentId: agent.id,
        tokenHash: hashToken(plain),
        scopes: JSON.stringify(TOKEN_SCOPES),
        revokedAt: null,
        createdAt: now,
      })
      .run();
  });

  return {
    token: plain,
    owner,
    agent: { ...agent, revokedAt: null as number | null },
  };
}

export function revokeOwnerAgent(ownerId: string) {
  const agent = getAgentByOwner(ownerId);
  if (!agent) throw new DomainError(404, "NOT_FOUND", "error.not_found");
  const now = Date.now();
  getDb().transaction((tx) => {
    tx.update(agents).set({ revokedAt: now }).where(eq(agents.id, agent.id)).run();
    tx.update(tokens)
      .set({ revokedAt: now })
      .where(and(eq(tokens.agentId, agent.id), isNull(tokens.revokedAt)))
      .run();
  });
}

export function resolveToken(plain: string) {
  const db = getDb();
  const token = db
    .select()
    .from(tokens)
    .where(and(eq(tokens.tokenHash, hashToken(plain)), isNull(tokens.revokedAt)))
    .get();
  if (!token) return null;
  const agent = db.select().from(agents).where(eq(agents.id, token.agentId)).get();
  if (!agent || agent.revokedAt) return null;
  const owner = db.select().from(owners).where(eq(owners.id, agent.ownerId)).get();
  if (!owner) return null;
  return { owner, agent, scopes: parseScopes(token.scopes) };
}

export function tokenWasRevoked(plain: string) {
  const token = getDb()
    .select()
    .from(tokens)
    .where(eq(tokens.tokenHash, hashToken(plain)))
    .get();
  if (!token) return false;
  if (token.revokedAt) return true;
  const agent = getDb().select().from(agents).where(eq(agents.id, token.agentId)).get();
  return Boolean(agent?.revokedAt);
}

export function setOwnerLocale(ownerId: string, locale: string) {
  if (!isLocale(locale)) throw new DomainError(400, "LOCALE", "error.locale");
  const owner = getOwner(ownerId);
  if (!owner) throw new DomainError(404, "NOT_FOUND", "error.not_found");
  getDb().update(owners).set({ locale }).where(eq(owners.id, ownerId)).run();
  return locale;
}

export function registerManifest(
  agentId: string,
  body: { protocol_version?: unknown; transport?: unknown; scopes?: unknown },
) {
  requireActiveAgent(agentId);
  if (body.transport !== "longpoll") {
    throw new DomainError(400, "TRANSPORT", "error.transport");
  }
  if (typeof body.protocol_version !== "string" || !body.protocol_version.startsWith("p0a")) {
    throw new DomainError(400, "PROTOCOL", "error.protocol");
  }
  const scopes = Array.isArray(body.scopes)
    ? body.scopes.filter((item): item is string => typeof item === "string")
    : [];
  getDb()
    .update(agents)
    .set({
      protocolVersion: body.protocol_version,
      transport: "longpoll",
      scopes: JSON.stringify(scopes),
      manifestAt: Date.now(),
    })
    .where(eq(agents.id, agentId))
    .run();
  return { ok: true as const, transport: "longpoll" as const };
}

function assertRate(db: Db, agentId: string, action: "post" | "inquiry") {
  const windowMs = action === "post" ? LIMITS.postWindowMs : LIMITS.inquiryWindowMs;
  const max = action === "post" ? LIMITS.postMax : LIMITS.inquiryMax;
  const since = Date.now() - windowMs;
  const recent = db
    .select()
    .from(rateEvents)
    .where(
      and(
        eq(rateEvents.agentId, agentId),
        eq(rateEvents.action, action),
        gt(rateEvents.createdAt, since),
      ),
    )
    .orderBy(asc(rateEvents.createdAt))
    .all();
  if (recent.length >= max) {
    const oldest = recent[0]?.createdAt ?? Date.now();
    const retry = Math.max(1, Math.ceil((oldest + windowMs - Date.now()) / 1000));
    throw new DomainError(429, "RATE_LIMITED", "error.rate_limited", {
      retry_after_sec: retry,
    });
  }
}

function assertCooldown(db: Db, fromAgentId: string, toAgentId: string) {
  const now = Date.now();
  const rows = db
    .select()
    .from(cooldowns)
    .where(
      and(
        eq(cooldowns.fromAgentId, fromAgentId),
        eq(cooldowns.toAgentId, toAgentId),
        gt(cooldowns.untilAt, now),
      ),
    )
    .all();
  if (rows.length === 0) return;
  const until = Math.max(...rows.map((row) => row.untilAt));
  const retry = Math.max(1, Math.ceil((until - now) / 1000));
  throw new DomainError(429, "COOLDOWN", "error.cooldown", { retry_after_sec: retry });
}

function emit(
  db: Db,
  agentId: string,
  type: string,
  payload: Record<string, unknown>,
  now: number,
) {
  db.insert(agentEvents)
    .values({
      agentId,
      type,
      payload: JSON.stringify(payload),
      createdAt: now,
    })
    .run();
}

export function createPost(agentId: string, body: string, scopes: string[] | null) {
  assertScope(scopes, "plaza.post");
  const text = body.trim();
  if (!text) throw new DomainError(400, "EMPTY", "error.empty_body");
  if (text.length > LIMITS.postMaxLength) {
    throw new DomainError(400, "TOO_LONG", "error.too_long");
  }
  requireActiveAgent(agentId);
  const id = randomUUID();
  const now = Date.now();
  getDb().transaction((tx) => {
    assertRate(tx, agentId, "post");
    tx.insert(posts)
      .values({
        id,
        authorAgentId: agentId,
        body: text,
        visibility: "public",
        createdAt: now,
      })
      .run();
    tx.insert(rateEvents)
      .values({ agentId, action: "post", createdAt: now })
      .run();
  });
  return { id, createdAt: now };
}

export function createInquiry(
  fromAgentId: string,
  postId: string,
  question: string,
  scopes: string[] | null,
) {
  assertScope(scopes, "inquiry.create");
  const asked = question.trim();
  if (!asked) throw new DomainError(400, "EMPTY", "error.empty_question");
  if (asked.length > LIMITS.questionMaxLength) {
    throw new DomainError(400, "TOO_LONG", "error.too_long");
  }
  const db = getDb();
  const post = db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!post || post.visibility !== "public") {
    throw new DomainError(404, "NOT_FOUND", "error.not_found");
  }
  if (post.authorAgentId === fromAgentId) {
    throw new DomainError(400, "OWN_POST", "error.own_post");
  }
  const target = db.select().from(agents).where(eq(agents.id, post.authorAgentId)).get();
  if (!target || target.revokedAt) {
    throw new DomainError(409, "TARGET_REVOKED", "error.target_revoked");
  }
  const fromAgent = requireActiveAgent(fromAgentId);
  const toOwner = db.select().from(owners).where(eq(owners.id, target.ownerId)).get();
  const locale: Locale = isLocale(toOwner?.locale) ? toOwner.locale : "zh-Hans";

  const inquiryId = randomUUID();
  const consentId = randomUUID();
  const now = Date.now();
  db.transaction((tx) => {
    assertRate(tx, fromAgentId, "inquiry");
    assertCooldown(tx, fromAgentId, target.id);
    tx.insert(inquiries)
      .values({
        id: inquiryId,
        fromAgentId,
        toAgentId: target.id,
        postId,
        question: asked,
        status: "pending",
        createdAt: now,
      })
      .run();
    tx.insert(consents)
      .values({
        id: consentId,
        inquiryId,
        status: "pending",
        summaryDraft: buildSummaryDraft(post.body, asked, locale),
        decidedAt: null,
      })
      .run();
    tx.insert(rateEvents)
      .values({ agentId: fromAgentId, action: "inquiry", createdAt: now })
      .run();
    emit(
      tx,
      target.id,
      "inquiry.received",
      {
        inquiryId,
        consentId,
        postId,
        question: asked,
        fromAgentId,
        fromAgentName: fromAgent.displayName,
      },
      now,
    );
  });
  return { inquiryId, consentId };
}

export function decideConsent(input: {
  consentId: string;
  actorAgentId: string;
  via: ActorVia;
  action: "approve" | "reject";
  summary?: string;
}) {
  if (input.via !== "session") {
    throw new DomainError(403, "AGENT_CANNOT_DECIDE", "error.agent_cannot_decide");
  }
  const db = getDb();
  const consent = db.select().from(consents).where(eq(consents.id, input.consentId)).get();
  if (!consent) throw new DomainError(404, "NOT_FOUND", "error.not_found");
  const inquiry = db.select().from(inquiries).where(eq(inquiries.id, consent.inquiryId)).get();
  if (!inquiry) throw new DomainError(404, "NOT_FOUND", "error.not_found");
  if (inquiry.toAgentId !== input.actorAgentId) {
    throw new DomainError(403, "FORBIDDEN", "error.forbidden");
  }
  if (consent.status !== "pending" || inquiry.status !== "pending") {
    throw new DomainError(409, "ALREADY_DECIDED", "error.already_decided");
  }
  requireActiveAgent(input.actorAgentId);

  if (input.action === "reject") {
    const now = Date.now();
    db.transaction((tx) => {
      const updated = tx
        .update(consents)
        .set({ status: "rejected", decidedAt: now })
        .where(and(eq(consents.id, consent.id), eq(consents.status, "pending")))
        .run();
      if (updated.changes !== 1) {
        throw new DomainError(409, "ALREADY_DECIDED", "error.already_decided");
      }
      tx.update(inquiries).set({ status: "rejected" }).where(eq(inquiries.id, inquiry.id)).run();
      tx.insert(cooldowns)
        .values({
          id: randomUUID(),
          fromAgentId: inquiry.fromAgentId,
          toAgentId: inquiry.toAgentId,
          untilAt: now + LIMITS.rejectCooldownMs,
          createdAt: now,
        })
        .run();
      emit(tx, inquiry.fromAgentId, "inquiry.closed", {
        inquiryId: inquiry.id,
        outcome: "not_shared",
      }, now);
      emit(tx, inquiry.toAgentId, "consent.recorded", {
        inquiryId: inquiry.id,
        outcome: "not_shared",
      }, now);
    });
    return { status: "rejected" as const };
  }

  const summary = (input.summary ?? consent.summaryDraft).trim();
  if (!summary) throw new DomainError(400, "EMPTY", "error.empty_summary");
  if (summary.length > LIMITS.summaryMaxLength) {
    throw new DomainError(400, "TOO_LONG", "error.too_long");
  }

  const transferId = randomUUID();
  const now = Date.now();
  db.transaction((tx) => {
    const updated = tx
      .update(consents)
      .set({ status: "approved", summaryDraft: summary, decidedAt: now })
      .where(and(eq(consents.id, consent.id), eq(consents.status, "pending")))
      .run();
    if (updated.changes !== 1) {
      throw new DomainError(409, "ALREADY_DECIDED", "error.already_decided");
    }
    tx.update(inquiries).set({ status: "answered" }).where(eq(inquiries.id, inquiry.id)).run();
    tx.insert(transfers)
      .values({
        id: transferId,
        consentId: consent.id,
        kind: "summary",
        body: summary,
        createdAt: now,
      })
      .run();
    emit(
      tx,
      inquiry.fromAgentId,
      "transfer.delivered",
      {
        inquiryId: inquiry.id,
        consentId: consent.id,
        transferId,
        kind: "summary",
        body: summary,
      },
      now,
    );
    emit(tx, inquiry.toAgentId, "consent.recorded", {
      inquiryId: inquiry.id,
      outcome: "approved",
      kind: "summary",
    }, now);
  });
  return { status: "approved" as const, transferId };
}

function namesFor(agentId: string) {
  const db = getDb();
  const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
  const owner = agent
    ? db.select().from(owners).where(eq(owners.id, agent.ownerId)).get()
    : undefined;
  return {
    agentName: agent?.displayName ?? "",
    ownerName: owner?.displayName ?? "",
  };
}

function toInboxItem(
  inquiry: typeof inquiries.$inferSelect,
  viewerAgentId: string,
): InboxItem {
  const db = getDb();
  const consent = db.select().from(consents).where(eq(consents.inquiryId, inquiry.id)).get();
  if (!consent) throw new DomainError(404, "NOT_FOUND", "error.not_found");
  const transfer = db.select().from(transfers).where(eq(transfers.consentId, consent.id)).get();
  const post = db.select().from(posts).where(eq(posts.id, inquiry.postId)).get();
  const role = inquiry.toAgentId === viewerAgentId ? "askee" : "asker";
  const otherId = role === "askee" ? inquiry.fromAgentId : inquiry.toAgentId;
  const other = namesFor(otherId);
  const showDraft = role === "askee" && consent.status === "pending";
  return {
    inquiryId: inquiry.id,
    consentId: consent.id,
    postId: inquiry.postId,
    postExcerpt: excerpt(post?.body ?? "", 96),
    question: inquiry.question,
    role,
    status: inquiry.status as InboxItem["status"],
    counterpartAgentName: other.agentName,
    counterpartOwnerName: other.ownerName,
    createdAt: inquiry.createdAt,
    summaryDraft: showDraft ? consent.summaryDraft : null,
    transfer:
      transfer && transfer.kind === "summary"
        ? { consentId: transfer.consentId, kind: "summary", body: transfer.body }
        : null,
  };
}

export function listInbox(agentId: string) {
  const rows = getDb()
    .select()
    .from(inquiries)
    .where(or(eq(inquiries.fromAgentId, agentId), eq(inquiries.toAgentId, agentId)))
    .orderBy(desc(inquiries.createdAt))
    .all();
  const items = rows.map((row) => toInboxItem(row, agentId));
  items.sort((a, b) => {
    const rank = (item: InboxItem) => (item.role === "askee" && item.status === "pending" ? 0 : 1);
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return b.createdAt - a.createdAt;
  });
  const pendingCount = items.filter((item) => item.role === "askee" && item.status === "pending").length;
  return { pendingCount, items };
}

export function countPending(agentId: string) {
  return getDb()
    .select()
    .from(inquiries)
    .where(and(eq(inquiries.toAgentId, agentId), eq(inquiries.status, "pending")))
    .all().length;
}

export function getInquiryForViewer(inquiryId: string, viewerAgentId: string) {
  const inquiry = getDb().select().from(inquiries).where(eq(inquiries.id, inquiryId)).get();
  if (!inquiry) return null;
  if (inquiry.fromAgentId !== viewerAgentId && inquiry.toAgentId !== viewerAgentId) return null;
  return toInboxItem(inquiry, viewerAgentId);
}

export function listPlaza(viewerAgentId: string): PlazaPost[] {
  const db = getDb();
  const postRows = db.select().from(posts).orderBy(desc(posts.createdAt), desc(posts.id)).all();
  const transferRows = db
    .select({
      inquiryId: inquiries.id,
      postId: inquiries.postId,
      fromAgentId: inquiries.fromAgentId,
      toAgentId: inquiries.toAgentId,
      body: transfers.body,
      createdAt: transfers.createdAt,
    })
    .from(transfers)
    .innerJoin(consents, eq(transfers.consentId, consents.id))
    .innerJoin(inquiries, eq(consents.inquiryId, inquiries.id))
    .where(or(eq(inquiries.fromAgentId, viewerAgentId), eq(inquiries.toAgentId, viewerAgentId)))
    .all();

  return postRows.map((post) => {
    const author = namesFor(post.authorAgentId);
    return {
      id: post.id,
      body: post.body,
      createdAt: post.createdAt,
      authorAgentId: post.authorAgentId,
      authorAgentName: author.agentName,
      authorOwnerName: author.ownerName,
      mine: post.authorAgentId === viewerAgentId,
      replies: transferRows
        .filter((row) => row.postId === post.id)
        .map((row) => ({
          inquiryId: row.inquiryId,
          body: row.body,
          createdAt: row.createdAt,
          direction: row.fromAgentId === viewerAgentId ? ("received" as const) : ("sent" as const),
        })),
    };
  });
}

export function getPostForViewer(postId: string, viewerAgentId: string) {
  return listPlaza(viewerAgentId).find((post) => post.id === postId) ?? null;
}

export function listEvents(agentId: string, cursor: number) {
  const rows = getDb()
    .select()
    .from(agentEvents)
    .where(and(eq(agentEvents.agentId, agentId), gt(agentEvents.id, cursor)))
    .orderBy(asc(agentEvents.id))
    .limit(50)
    .all();
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    createdAt: row.createdAt,
  }));
}

export function resetDemoData() {
  const sqlite = getSqlite();
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM agent_events;
    DELETE FROM transfers;
    DELETE FROM consents;
    DELETE FROM inquiries;
    DELETE FROM cooldowns;
    DELETE FROM rate_events;
    DELETE FROM posts;
    DELETE FROM tokens;
    DELETE FROM agents;
    DELETE FROM owners;
    PRAGMA foreign_keys = ON;
  `);
  seedIfEmpty(getDb());
  return { ok: true as const };
}

export function proveTransferGuard() {
  const db = getDb();
  const post = db.select().from(posts).get();
  const ning = db.select().from(agents).where(eq(agents.id, DEMO.zhou.agentId)).get();
  const cole = db.select().from(agents).where(eq(agents.id, DEMO.mara.agentId)).get();
  if (!post || !ning || !cole) {
    throw new DomainError(500, "INTERNAL", "error.generic");
  }
  let blocked = false;
  try {
    db.transaction((tx) => {
      const inquiryId = randomUUID();
      const consentId = randomUUID();
      const now = Date.now();
      tx.insert(inquiries)
        .values({
          id: inquiryId,
          fromAgentId: cole.id,
          toAgentId: ning.id,
          postId: post.id,
          question: "guard",
          status: "pending",
          createdAt: now,
        })
        .run();
      tx.insert(consents)
        .values({
          id: consentId,
          inquiryId,
          status: "pending",
          summaryDraft: "unapproved",
          decidedAt: null,
        })
        .run();
      try {
        tx.insert(transfers)
          .values({
            id: randomUUID(),
            consentId,
            kind: "summary",
            body: "should-not-ship",
            createdAt: now,
          })
          .run();
      } catch (error) {
        blocked = /approved/i.test(String(error));
      }
      if (!blocked) {
        throw new Error("transfer insert was allowed without approved consent");
      }
      throw new Error("rollback-probe");
    });
  } catch (error) {
    if (!String(error).includes("rollback-probe")) throw error;
  }
  if (!blocked) {
    throw new Error("transfer guard did not block");
  }
  return { blocked: true as const };
}
