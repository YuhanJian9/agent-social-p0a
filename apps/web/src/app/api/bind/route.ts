import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { LOCALE_COOKIE, OWNER_COOKIE } from "@/lib/constants";
import { bindOwner } from "@/lib/domain";
import { DomainError } from "@/lib/errors";
import { formErrorRedirect, readPayload, redirectTo } from "@/lib/form";
import { isLocale } from "@/i18n/locale";
import { authConfigured } from "@/lib/auth/server";

const cookieBase = {
  sameSite: "lax" as const,
  path: "/",
};

export async function POST(request: Request) {
  if (authConfigured() || process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const { form, data } = await readPayload(request);
  try {
    if (typeof data.ownerId !== "string") {
      throw new DomainError(400, "NOT_FOUND", "error.not_found");
    }
    const bound = bindOwner(data.ownerId);
    const response = form
      ? redirectTo(request, "/plaza")
      : NextResponse.json({
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
    response.cookies.set(OWNER_COOKIE, bound.owner.id, {
      ...cookieBase,
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    });
    if (isLocale(bound.owner.locale)) {
      response.cookies.set(LOCALE_COOKIE, bound.owner.locale, {
        ...cookieBase,
        maxAge: 60 * 60 * 24 * 365,
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
