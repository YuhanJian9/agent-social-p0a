"use server";

import { redirect } from "next/navigation";
import { authClient, authConfigured, currentUser } from "@/lib/auth/server";
import { authFeedback } from "@/lib/auth/feedback";

function fail() { redirect("/auth?message=error"); }

export async function authenticate(form: FormData) {
  if (!authConfigured()) fail();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const mode = form.get("mode");
  if (!email || email.length > 254 || password.length < 12 || password.length > 128) fail();
  const client = await authClient();
  if (mode === "signup") {
    const { error } = await client.auth.signUp({ email, password,
      options: { emailRedirectTo: `${process.env.APP_URL}/auth/confirm` } });
    if (error) redirect(`/auth?message=${authFeedback(error.code, error.status)}`);
    redirect("/auth?message=verify");
  }
  if (mode !== "login") fail();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) redirect(`/auth?message=${authFeedback(error.code, error.status)}`);
  redirect("/account");
}

export async function signOut() {
  const client = await authClient();
  const { error } = await client.auth.signOut();
  if (error) redirect("/account?message=error");
  redirect("/auth");
}

export async function saveProfile(form: FormData) {
  const user = await currentUser();
  if (!user) redirect("/auth");
  const displayName = String(form.get("displayName") ?? "").trim();
  const locale = form.get("locale");
  if (!displayName || displayName.length > 80 || (locale !== "en" && locale !== "zh-Hans")) {
    redirect("/account?message=error");
  }
  const client = await authClient();
  const { error } = await client.from("owner_profiles").upsert({ id: user.id, display_name: displayName, locale });
  if (error) redirect("/account?message=error");
  redirect("/account?message=saved");
}
