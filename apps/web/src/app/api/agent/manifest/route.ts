import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { actorFromRequest } from "@/lib/actor";
import { registerManifest } from "@/lib/domain";

export async function POST(request: Request) {
  try {
    const actor = await actorFromRequest(request);
    const body = (await readJson(request)) as {
      protocol_version?: unknown;
      transport?: unknown;
      scopes?: unknown;
    } | null;
    const result = registerManifest(actor.agent.id, body ?? {});
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
