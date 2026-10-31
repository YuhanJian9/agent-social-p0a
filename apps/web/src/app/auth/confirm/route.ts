import { NextResponse } from "next/server";
import { authClient, authConfigured } from "@/lib/auth/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!authConfigured()) return NextResponse.redirect(new URL("/auth", url));
  const code = url.searchParams.get("code");
  if (code) {
    const client = await authClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/account", url));
  }
  return NextResponse.redirect(new URL("/auth?message=error", url));
}
