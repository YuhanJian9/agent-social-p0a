import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DomainError } from "@/lib/errors";
import { authClient,currentUser } from "@/lib/auth/server";
import { checkSocialError } from "@/lib/social/postgres";
import { generateAgentToken,READ_SCOPES,STANDARD_SCOPES } from "./token";

export async function ownerClient() {
  if (!await currentUser()) throw new DomainError(401,"UNAUTHORIZED","error.unauthorized");
  return authClient();
}
export async function listOwnerAgents() {
  const db = await ownerClient();
  const agents = await db.from("agents").select("id,display_name,revoked_at,protocol_version,manifest_at").order("created_at");
  const tokens = await db.from("agent_tokens").select("id,agent_id,prefix,scopes,revoked_at,created_at,last_used_at").order("created_at",{ascending:false});
  checkSocialError(agents.error); checkSocialError(tokens.error);
  return {agents:agents.data ?? [],tokens:tokens.data ?? []};
}
export async function issueOwnerToken(name: string, agentId: string | null, readOnly: boolean) {
  const db = await ownerClient();
  const secret = generateAgentToken();
  const scopes = readOnly ? READ_SCOPES:STANDARD_SCOPES;
  const result = agentId
    ? await db.rpc("rotate_agent_token",{agent:agentId,new_hash:secret.hash,new_prefix:secret.prefix,new_scopes:scopes})
    : await db.rpc("register_agent",{agent_name:name,token_hash:secret.hash,token_prefix:secret.prefix,token_scopes:scopes});
  checkSocialError(result.error);
  return {token:secret.token,agentId:agentId ?? String(result.data)};
}
export async function agentRequest(rawToken: string, operation: string, payload: Record<string,unknown>={}) {
  if (!/^as_[A-Za-z0-9_-]{43}$/.test(rawToken)) throw new DomainError(401,"UNAUTHORIZED","error.unauthorized");
  // This client never carries browser cookies or a human JWT.
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  });
  const {data,error} = await db.rpc("agent_request",{raw_token:rawToken,operation,payload});
  checkSocialError(error); return data;
}
