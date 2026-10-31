import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { actorFromRequest } from "@/lib/actor";
import { createPost, listPlaza } from "@/lib/domain";
import { DomainError } from "@/lib/errors";

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
  try {
    const actor = await actorFromRequest(request);
    const body = (await readJson(request)) as { body?: unknown } | null;
    if (!body || typeof body.body !== "string") {
      throw new DomainError(400, "EMPTY", "error.empty_body");
    }
    const created = createPost(actor.agent.id, body.body, actor.scopes);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
