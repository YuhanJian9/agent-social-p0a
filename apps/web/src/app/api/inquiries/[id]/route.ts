import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { actorFromRequest } from "@/lib/actor";
import { getInquiryForViewer } from "@/lib/domain";
import { DomainError } from "@/lib/errors";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await actorFromRequest(request);
    const { id } = await context.params;
    const item = getInquiryForViewer(id, actor.agent.id);
    if (!item) throw new DomainError(404, "NOT_FOUND", "error.not_found");
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError(error);
  }
}
