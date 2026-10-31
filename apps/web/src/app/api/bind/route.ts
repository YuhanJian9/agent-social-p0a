import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { LOCALE_COOKIE, OWNER_COOKIE } from "@/lib/constants";
import { bindOwner } from "@/lib/domain";
import { DomainError } from "@/lib/errors";
import { isLocale } from "@/i18n/locale";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { ownerId?: unknown } | null;
    if (!body || typeof body.ownerId !== "string") {
      throw new DomainError(400, "NOT_FOUND", "error.not_found");
    }
    const bound = bindOwner(body.ownerId);
    const jar = await cookies();
    jar.set(OWNER_COOKIE, bound.owner.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    if (isLocale(bound.owner.locale)) {
      jar.set(LOCALE_COOKIE, bound.owner.locale, {
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return NextResponse.json({
      owner: {
        id: bound.owner.id,
        displayName: bound.owner.displayName,
        locale: bound.owner.locale,
      },
      agent: {
        id: bound.agent.id,
        displayName: bound.agent.displayName,
      },
      token: bound.token,
    });
  } catch (error) {
    return jsonError(error);
  }
}
