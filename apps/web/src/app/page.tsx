import { redirect } from "next/navigation";
import { readSession } from "@/lib/actor";

export default async function Home() {
  const session = await readSession();
  redirect(session && !session.agent.revokedAt ? "/plaza" : "/connect");
}
