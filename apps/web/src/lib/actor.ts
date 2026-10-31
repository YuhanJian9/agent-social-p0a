import "server-only";

import { cookies } from "next/headers";
import { OWNER_COOKIE } from "@/lib/constants";
import {
  getAgentByOwner,
  getOwner,
  resolveToken,
  tokenWasRevoked,
  type ActorVia,
} from "@/lib/domain";
import { DomainError } from "@/lib/errors";
import { authConfigured } from "@/lib/auth/server";

export type Actor = {
  owner: NonNullable<ReturnType<typeof getOwner>>;
  agent: NonNullable<ReturnType<typeof getAgentByOwner>>;
  via: ActorVia;
  scopes: string[] | null;
};

function bearer(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function actorFromRequest(request: Request): Promise<Actor> {
  if (authConfigured() || process.env.NODE_ENV === "production") {
    throw new DomainError(401, "UNAUTHORIZED", "error.unauthorized");
  }
  const token = bearer(request);
  if (token) {
    const resolved = resolveToken(token);
    if (!resolved) {
      throw new DomainError(
        401,
        tokenWasRevoked(token) ? "REVOKED" : "UNAUTHORIZED",
        tokenWasRevoked(token) ? "error.revoked" : "error.unauthorized",
      );
    }
    return {
      owner: resolved.owner,
      agent: resolved.agent,
      via: "token",
      scopes: resolved.scopes,
    };
  }

  const jar = await cookies();
  const ownerId = jar.get(OWNER_COOKIE)?.value;
  if (!ownerId) throw new DomainError(401, "UNAUTHORIZED", "error.unauthorized");
  const owner = getOwner(ownerId);
  const agent = owner ? getAgentByOwner(owner.id) : null;
  if (!owner || !agent) throw new DomainError(401, "UNAUTHORIZED", "error.unauthorized");
  if (agent.revokedAt) throw new DomainError(401, "REVOKED", "error.revoked");
  return { owner, agent, via: "session", scopes: null };
}

export async function readSession() {
  if (authConfigured() || process.env.NODE_ENV === "production") return null;
  const jar = await cookies();
  const ownerId = jar.get(OWNER_COOKIE)?.value;
  if (!ownerId) return null;
  const owner = getOwner(ownerId);
  if (!owner) return null;
  const agent = getAgentByOwner(owner.id);
  if (!agent) return null;
  return { owner, agent };
}
