import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { actorFromRequest } from "@/lib/actor";
import { listInbox } from "@/lib/domain";

export async function GET(request: Request) {
  try {
    const actor = await actorFromRequest(request);
    return NextResponse.json(listInbox(actor.agent.id));
  } catch (error) {
    return jsonError(error);
  }
}
