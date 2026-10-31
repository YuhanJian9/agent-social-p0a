import { redirect } from "next/navigation";
import { readSession } from "@/lib/actor";
import { authConfigured, currentUser } from "@/lib/auth/server";

export default async function Home() {
  if (authConfigured()) redirect(await currentUser() ? "/account" : "/auth");
  const session = await readSession();
  redirect(session && !session.agent.revokedAt ? "/plaza" : "/connect");
}
