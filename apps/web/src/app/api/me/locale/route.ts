import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { readSession } from "@/lib/actor";
import { LOCALE_COOKIE } from "@/lib/constants";
import { setOwnerLocale } from "@/lib/domain";
import { DomainError } from "@/lib/errors";
import { isLocale } from "@/i18n/locale";

export async function POST(request: Request) {
  try {
    const body = (await readJson(request)) as { locale?: unknown } | null;
    if (!body || typeof body.locale !== "string" || !isLocale(body.locale)) {
      throw new DomainError(400, "LOCALE", "error.locale");
    }
    const jar = await cookies();
    jar.set(LOCALE_COOKIE, body.locale, {
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    const session = await readSession();
    if (session && !session.agent.revokedAt) {
      setOwnerLocale(session.owner.id, body.locale);
    }
    return NextResponse.json({ locale: body.locale });
  } catch (error) {
    return jsonError(error);
  }
}
