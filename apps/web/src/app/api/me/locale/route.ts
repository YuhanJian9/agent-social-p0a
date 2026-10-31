import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { readSession } from "@/lib/actor";
import { LOCALE_COOKIE } from "@/lib/constants";
import { setOwnerLocale } from "@/lib/domain";
import { DomainError } from "@/lib/errors";
import { formErrorRedirect, readPayload, redirectTo, safePath } from "@/lib/form";
import { isLocale } from "@/i18n/locale";

export async function POST(request: Request) {
  const { form, data } = await readPayload(request);
  try {
    if (typeof data.locale !== "string" || !isLocale(data.locale)) {
      throw new DomainError(400, "LOCALE", "error.locale");
    }
    const session = await readSession();
    if (session && !session.agent.revokedAt) {
      setOwnerLocale(session.owner.id, data.locale);
    }
    const response = form
      ? redirectTo(request, safePath(returnPath(request, data), "/plaza"))
      : NextResponse.json({ locale: data.locale });
    response.cookies.set(LOCALE_COOKIE, data.locale, {
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    if (form && error instanceof DomainError) {
      return formErrorRedirect(request, data, "/connect", error);
    }
    return jsonError(error);
  }
}

function returnPath(request: Request, data: Record<string, unknown>) {
  if (typeof data.next === "string") return data.next;
  const referer = request.headers.get("referer");
  if (!referer) return "/plaza";
  try {
    const url = new URL(referer);
    return `${url.pathname}${url.search}`;
  } catch {
    return "/plaza";
  }
}
