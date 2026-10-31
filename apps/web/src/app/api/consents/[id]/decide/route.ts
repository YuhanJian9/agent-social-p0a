import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { actorFromRequest } from "@/lib/actor";
import { decideConsent } from "@/lib/domain";
import { DomainError } from "@/lib/errors";
import { formErrorRedirect, readPayload, redirectTo, safePath } from "@/lib/form";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { form, data } = await readPayload(request);
  const { id } = await context.params;
  try {
    const actor = await actorFromRequest(request);
    if (data.action !== "approve" && data.action !== "reject") {
      throw new DomainError(400, "EMPTY", "error.generic");
    }
    const result = decideConsent({
      consentId: id,
      actorAgentId: actor.agent.id,
      via: actor.via,
      action: data.action,
      summary: typeof data.summary === "string" ? data.summary : undefined,
    });
    if (form) return redirectTo(request, safePath(data.next, "/inbox"));
    return NextResponse.json(result);
  } catch (error) {
    if (form && error instanceof DomainError) {
      return formErrorRedirect(request, data, safePath(data.next, "/inbox"), error);
    }
    return jsonError(error);
  }
}
