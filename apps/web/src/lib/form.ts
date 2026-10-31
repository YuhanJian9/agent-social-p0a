import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { DomainError } from "@/lib/errors";

export async function readPayload(request: Request): Promise<{
  form: boolean;
  data: Record<string, unknown>;
}> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    try {
      const data = (await request.json()) as Record<string, unknown> | null;
      return { form: false, data: data ?? {} };
    } catch {
      return { form: false, data: {} };
    }
  }
  if (type.includes("form")) {
    const form = await request.formData();
    const data: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") data[key] = value;
    }
    return { form: true, data };
  }
  return { form: false, data: {} };
}

export function safePath(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

function pathFromRequest(request: Request, data: Record<string, unknown>, fallback: string) {
  const explicit = safePath(data.next, "");
  if (explicit) return explicit;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      return safePath(`${url.pathname}${url.search}`, fallback);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(path, "http://local");
  url.searchParams.delete("error");
  url.searchParams.delete("seconds");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

export function redirectTo(request: Request, path: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  return NextResponse.redirect(new URL(path, origin), 303);
}

export function withoutStatus(path: string) {
  const url = new URL(path, "http://local");
  url.searchParams.delete("error");
  url.searchParams.delete("seconds");
  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

export function formErrorRedirect(
  request: Request,
  data: Record<string, unknown>,
  fallback: string,
  error: DomainError,
) {
  const seconds = error.extra?.retry_after_sec;
  const path = withQuery(pathFromRequest(request, data, fallback), {
    error: error.messageKey.replace(/^error\./, ""),
    seconds: typeof seconds === "number" ? seconds : undefined,
  });
  return redirectTo(request, path);
}

export async function messageFromSearch(params: { error?: string; seconds?: string }) {
  if (!params.error) return null;
  const t = await getTranslations("error");
  const seconds = Number(params.seconds ?? 0);
  return t(params.error as "generic", {
    seconds: Number.isFinite(seconds) ? seconds : 0,
  });
}
