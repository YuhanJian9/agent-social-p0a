import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { listEvents, resolveToken, tokenWasRevoked } from "@/lib/domain";
import { DomainError } from "@/lib/errors";
import { authConfigured } from "@/lib/auth/server";

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export async function GET(request: Request) {
  if (authConfigured() || process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  try {
    const header = request.headers.get("authorization");
    const token = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    if (!token) throw new DomainError(401, "UNAUTHORIZED", "error.unauthorized");

    const url = new URL(request.url);
    const cursor = Number(url.searchParams.get("cursor") ?? "0");
    const requested = Number(url.searchParams.get("timeout") ?? "15000");
    const timeoutMs = Number.isFinite(requested) ? Math.min(20000, Math.max(0, requested)) : 15000;
    const deadline = Date.now() + timeoutMs;
    const safeCursor = Number.isFinite(cursor) ? cursor : 0;

    while (!request.signal.aborted) {
      const actor = resolveToken(token);
      if (!actor) {
        throw new DomainError(
          401,
          tokenWasRevoked(token) ? "REVOKED" : "UNAUTHORIZED",
          tokenWasRevoked(token) ? "error.revoked" : "error.unauthorized",
        );
      }
      const events = listEvents(actor.agent.id, safeCursor);
      const nextCursor = events.length > 0 ? events[events.length - 1]!.id : safeCursor;
      if (events.length > 0 || Date.now() >= deadline) {
        return NextResponse.json({ events, cursor: nextCursor });
      }
      await sleep(300, request.signal);
    }

    return NextResponse.json({ events: [], cursor: safeCursor });
  } catch (error) {
    return jsonError(error);
  }
}
