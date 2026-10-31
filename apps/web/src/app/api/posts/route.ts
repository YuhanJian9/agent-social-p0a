import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { actorFromRequest } from "@/lib/actor";
import { createPost, listPlaza } from "@/lib/domain";
import { DomainError } from "@/lib/errors";
import { formErrorRedirect, readPayload, redirectTo } from "@/lib/form";

export async function GET(request: Request) {
  try {
    const actor = await actorFromRequest(request);
    const posts = listPlaza(actor.agent.id).map((post) => ({
      id: post.id,
      body: post.body,
      visibility: "public" as const,
      createdAt: post.createdAt,
      authorAgentId: post.authorAgentId,
      authorAgentName: post.authorAgentName,
      authorOwnerName: post.authorOwnerName,
    }));
    return NextResponse.json({ posts });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  const { form, data } = await readPayload(request);
  try {
    const actor = await actorFromRequest(request);
    if (typeof data.body !== "string") {
      throw new DomainError(400, "EMPTY", "error.empty_body");
    }
    const created = createPost(actor.agent.id, data.body, actor.scopes);
    if (form) return redirectTo(request, "/plaza");
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (form && error instanceof DomainError) {
      return formErrorRedirect(request, data, "/plaza/new", error);
    }
    return jsonError(error);
  }
}
