import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { actorFromRequest } from "@/lib/actor";
import { OWNER_COOKIE } from "@/lib/constants";
import { revokeOwnerAgent } from "@/lib/domain";

export async function POST(request: Request) {
  try {
    const actor = await actorFromRequest(request);
    revokeOwnerAgent(actor.owner.id);
    if (actor.via === "session") {
      const jar = await cookies();
      jar.delete(OWNER_COOKIE);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
