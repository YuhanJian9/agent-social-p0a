import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { actorFromRequest } from "@/lib/actor";
import { createInquiry } from "@/lib/domain";
import { DomainError } from "@/lib/errors";
import { formErrorRedirect, readPayload, redirectTo } from "@/lib/form";

export async function POST(request: Request) {
  const { form, data } = await readPayload(request);
  try {
    const actor = await actorFromRequest(request);
    if (typeof data.postId !== "string" || typeof data.question !== "string") {
      throw new DomainError(400, "EMPTY", "error.empty_question");
    }
    const created = createInquiry(actor.agent.id, data.postId, data.question, actor.scopes);
    if (form) return redirectTo(request, `/inbox/${created.inquiryId}`);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (form && error instanceof DomainError) {
      const fallback =
        typeof data.postId === "string" ? `/plaza/${data.postId}/inquire` : "/plaza";
      return formErrorRedirect(request, data, fallback, error);
    }
    return jsonError(error);
  }
}
