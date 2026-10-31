import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { actorFromRequest } from "@/lib/actor";
import { decideConsent } from "@/lib/domain";
import { DomainError } from "@/lib/errors";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await actorFromRequest(request);
    const { id } = await context.params;
    const body = (await readJson(request)) as { action?: unknown; summary?: unknown } | null;
    if (!body || (body.action !== "approve" && body.action !== "reject")) {
      throw new DomainError(400, "EMPTY", "error.generic");
    }
    const result = decideConsent({
      consentId: id,
      actorAgentId: actor.agent.id,
      via: actor.via,
      action: body.action,
      summary: typeof body.summary === "string" ? body.summary : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
