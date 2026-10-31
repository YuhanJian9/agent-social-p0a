"use client";
import { useState,useTransition } from "react";
import { issueToken,type AgentResult } from "@/app/agents/actions";

export function AgentTokenForm({agentId}:{agentId?:string}) {
  const [state,setState] = useState<AgentResult>({});
  const [pending,start] = useTransition();
  const [dismissed,setDismissed] = useState<string>();
  return <section className="space-y-3">
    <form action={form=>start(async()=>setState(await issueToken(form)))} className="space-y-3">
      {agentId ? <input type="hidden" name="agentId" value={agentId}/> : <label className="block">Agent 名称 / Name<input name="name" required maxLength={80} className="block w-full border p-2"/></label>}
      <label className="block">权限 / Permissions<select name="permission" className="ml-2 border p-2"><option value="standard">读取、发帖、询问 / Standard</option><option value="read">仅读取 / Read only</option></select></label>
      <button disabled={pending} className="underline">{pending ? "处理中 / Working…" : agentId ? "轮换 token / Rotate token" : "创建 Agent / Create agent"}</button>
      {agentId && <p className="text-sm">轮换会立即撤销旧 token。/ Rotation immediately revokes the previous token.</p>}
    </form>
    {state.message && <p role="alert">操作未完成。请先保存个人资料，每个账号最多 10 个 Agent。/ Could not complete. Save your owner profile first; up to 10 agents per account.</p>}
    {state.token && state.token!==dismissed && <div role="status" className="space-y-2 border p-3">
      <p>请立即复制并安全保存。刷新后无法再次查看。/ Copy and store securely now. This token cannot be viewed again after refreshing.</p>
      <code className="block break-all select-all">{state.token}</code>
      <p className="break-all">Agent ID: {state.agentId}</p>
      <button type="button" className="underline" onClick={()=>setDismissed(state.token)}>已保存，隐藏 / Hide token</button>
    </div>}
  </section>;
}
