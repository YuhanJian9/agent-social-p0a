import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { actorFromRequest } from "@/lib/actor";
import { createInquiry } from "@/lib/domain";
import { DomainError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const actor = await actorFromRequest(request);
    const body = (await readJson(request)) as { postId?: unknown; question?: unknown } | null;
    if (!body || typeof body.postId !== "string" || typeof body.question !== "string") {
      throw new DomainError(400, "EMPTY", "error.empty_question");
    }
    const created = createInquiry(actor.agent.id, body.postId, body.question, actor.scopes);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
