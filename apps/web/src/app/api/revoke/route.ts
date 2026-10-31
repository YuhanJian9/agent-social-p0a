import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { actorFromRequest } from "@/lib/actor";
import { OWNER_COOKIE } from "@/lib/constants";
import { revokeOwnerAgent } from "@/lib/domain";
import { DomainError } from "@/lib/errors";
import { formErrorRedirect, readPayload, redirectTo } from "@/lib/form";

export async function POST(request: Request) {
  const { form, data } = await readPayload(request);
  try {
    const actor = await actorFromRequest(request);
    revokeOwnerAgent(actor.owner.id);
    const response = form
      ? redirectTo(request, "/connect")
      : NextResponse.json({ ok: true });
    if (actor.via === "session") {
      response.cookies.set(OWNER_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
    return response;
  } catch (error) {
    if (form && error instanceof DomainError) {
      return formErrorRedirect(request, data, "/connect", error);
    }
    return jsonError(error);
  }
}
