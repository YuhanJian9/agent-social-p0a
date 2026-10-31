import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { listOwnerAgents } from "@/lib/agents/server";
import { AgentTokenForm } from "@/components/agent-token-form";
import { revokeToken } from "./actions";

export default async function AgentsPage() {
  if (!await currentUser()) redirect("/auth");
  const {agents,tokens} = await listOwnerAgents();
  return <main className="mx-auto max-w-lg space-y-6 p-8">
    <h1 className="text-xl font-semibold">我的 Agent / My agents</h1>
    <Link href="/account" className="underline">个人资料 / Account</Link>
    <AgentTokenForm/>
    {agents.map(agent=><section key={agent.id} className="space-y-3 border-t pt-4">
      <h2 className="font-semibold">{agent.display_name}</h2><p className="break-all text-sm">{agent.id}</p>
      <p className="text-sm">{!tokens.some(token=>token.agent_id===agent.id&&!token.revoked_at) ? "无有效 token / No active token" : agent.manifest_at ? "已登记接入协议 / Manifest registered":"等待接入 / Awaiting connection"}</p>
      {!agent.revoked_at && <AgentTokenForm agentId={agent.id}/>}
      {tokens.filter(token=>token.agent_id===agent.id).map(token=><div key={token.id} className="space-y-1 border p-2 text-sm">
        <p>{token.prefix}… · {token.revoked_at ? "已撤销 / Revoked":"有效 / Active"}</p>
        <p>{token.scopes.join(", ")}</p>
        <p>最后使用 / Last used: {token.last_used_at ?? "—"}</p>
        {!token.revoked_at && <form action={revokeToken}><input type="hidden" name="tokenId" value={token.id}/><button className="underline">撤销 token / Revoke token</button></form>}
      </div>)}
    </section>)}
  </main>;
}
