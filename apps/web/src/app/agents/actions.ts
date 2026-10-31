"use server";
import { revalidatePath } from "next/cache";
import { issueOwnerToken,ownerClient } from "@/lib/agents/server";
import { checkSocialError } from "@/lib/social/postgres";

export type AgentResult = {token?:string;agentId?:string;message?:string};
export async function issueToken(form:FormData):Promise<AgentResult> {
  const name = String(form.get("name") ?? "").trim();
  const agentId = form.get("agentId");
  if (agentId && (typeof agentId !== "string" || !/^[0-9a-f-]{36}$/i.test(agentId))) return {message:"error"};
  if (!agentId && (!name || name.length>80)) return {message:"error"};
  try {
    const result = await issueOwnerToken(name,typeof agentId === "string" ? agentId:null,form.get("permission")==="read");
    revalidatePath("/agents"); return result;
  } catch { return {message:"error"}; }
}
export async function revokeToken(form:FormData) {
  const db = await ownerClient();
  const id = String(form.get("tokenId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const {error} = await db.rpc("revoke_agent_token",{token_id:id}); checkSocialError(error);
  revalidatePath("/agents");
}
