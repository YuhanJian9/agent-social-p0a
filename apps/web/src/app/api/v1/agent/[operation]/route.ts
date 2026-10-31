import { NextResponse } from "next/server";
import { setTimeout as delay } from "node:timers/promises";
import { agentRequest } from "@/lib/agents/server";
import { DomainError } from "@/lib/errors";
import { jsonError } from "@/lib/api";

export const runtime="nodejs";
export const maxDuration=30;
const response=(data:unknown)=>NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
function token(request:Request) {
  const header=request.headers.get("authorization") ?? "";
  if(!header.toLowerCase().startsWith("bearer ")) throw new DomainError(401,"UNAUTHORIZED","error.unauthorized");
  return header.slice(7).trim();
}
export async function GET(request:Request,{params}:{params:Promise<{operation:string}>}) {
  try {
    const raw=token(request); const {operation}=await params;
    if(!["feed","inquiries","transfers","events"].includes(operation)) throw new DomainError(403,"AGENT_CANNOT_DECIDE","error.agent_cannot_decide");
    if(operation!=="events") return response(await agentRequest(raw,operation));
    const query=new URL(request.url).searchParams;
    const cursor=Number(query.get("cursor") ?? 0), timeout=Number(query.get("timeout") ?? 15000);
    if(!Number.isSafeInteger(cursor)||cursor<0||!Number.isFinite(timeout)||timeout<0) throw new DomainError(400,"INVALID","error.generic");
    const deadline=Date.now()+Math.min(timeout,20000);
    while(!request.signal.aborted) {
      const events=await agentRequest(raw,"events",{cursor}) as Array<{id:number}>;
      if(events.length||Date.now()>=deadline) return response({events,cursor:events.at(-1)?.id ?? cursor});
      await delay(Math.min(1000,Math.max(1,deadline-Date.now())),undefined,{signal:request.signal}).catch(()=>{});
    }
    return response({events:[],cursor});
  } catch(error) {return jsonError(error);}
}
export async function POST(request:Request,{params}:{params:Promise<{operation:string}>}) {
  try {
    const raw=token(request); const {operation}=await params;
    if(!["post","inquire","manifest"].includes(operation)) throw new DomainError(403,"AGENT_CANNOT_DECIDE","error.agent_cannot_decide");
    if(!request.headers.get("content-type")?.startsWith("application/json")) throw new DomainError(400,"INVALID","error.generic");
    const reader=request.body?.getReader(); let body=""; let size=0;
    if(!reader) throw new DomainError(400,"INVALID","error.generic");
    const decoder=new TextDecoder();
    while(true) {const part=await reader.read(); if(part.done)break; size+=part.value.byteLength;
      if(size>4096){await reader.cancel(); throw new DomainError(413,"TOO_LONG","error.too_long");} body+=decoder.decode(part.value,{stream:true});}
    body+=decoder.decode();
    let payload:unknown; try{payload=JSON.parse(body);}catch{throw new DomainError(400,"INVALID","error.generic");}
    if(!payload||typeof payload!=="object"||Array.isArray(payload)) throw new DomainError(400,"INVALID","error.generic");
    return response(await agentRequest(raw,operation,payload as Record<string,unknown>));
  } catch(error) {return jsonError(error);}
}
