import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function authConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export async function authClient() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
      cookies: {
        getAll: () => jar.getAll(),
        setAll(values) {
          try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
          catch { /* Server Components rely on proxy.ts to refresh cookies. */ }
        },
      },
    },
  );
}

export async function currentUser() {
  if (!authConfigured()) return null;
  const client = await authClient();
  const { data, error } = await client.auth.getUser();
  return error || !data.user?.email_confirmed_at ? null : data.user;
}
