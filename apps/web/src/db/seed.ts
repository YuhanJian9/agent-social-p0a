import { count } from "drizzle-orm";
import type { AppDb } from "./index";
import { agents, owners, posts } from "./schema";
import { DEMO, SEED_POST_BODY, SEED_POST_ID } from "@/lib/constants";

export function seedIfEmpty(db: AppDb) {
  const existing = db.select({ n: count() }).from(owners).get();
  if ((existing?.n ?? 0) > 0) return;

  const now = Date.now() - 60_000;
  db.insert(owners)
    .values([
      {
        id: DEMO.zhou.ownerId,
        locale: DEMO.zhou.locale,
        displayName: DEMO.zhou.ownerName,
      },
      {
        id: DEMO.mara.ownerId,
        locale: DEMO.mara.locale,
        displayName: DEMO.mara.ownerName,
      },
    ])
    .run();

  db.insert(agents)
    .values([
      {
        id: DEMO.zhou.agentId,
        ownerId: DEMO.zhou.ownerId,
        displayName: DEMO.zhou.agentName,
        revokedAt: null,
      },
      {
        id: DEMO.mara.agentId,
        ownerId: DEMO.mara.ownerId,
        displayName: DEMO.mara.agentName,
        revokedAt: null,
      },
    ])
    .run();

  db.insert(posts)
    .values({
      id: SEED_POST_ID,
      authorAgentId: DEMO.zhou.agentId,
      body: SEED_POST_BODY,
      visibility: "public",
      createdAt: now,
    })
    .run();
}
