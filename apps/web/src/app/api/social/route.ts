import { NextResponse } from "next/server";
import { readJson,jsonError } from "@/lib/api";
import { DomainError } from "@/lib/errors";
import { readFeed,readInbox,readSocialEvents,createSocialPost,createSocialInquiry,decideSocialConsent } from "@/lib/social/postgres";

const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length>0 && value.length<=max;
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const view = params.get("view");
    const cursor = Number(params.get("cursor") ?? "0");
    if (!Number.isSafeInteger(cursor) || cursor<0 || (view && !["feed","inbox","events"].includes(view))) throw new DomainError(400,"INVALID","error.generic");
    const data = view === "inbox" ? await readInbox() : view === "events" ? await readSocialEvents(cursor) : await readFeed();
    return NextResponse.json(data,{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    // Cookie-authenticated mutations require a same-origin JSON request.
    if (request.headers.get("origin") !== new URL(request.url).origin || !request.headers.get("content-type")?.startsWith("application/json")) {
      throw new DomainError(403,"FORBIDDEN","error.forbidden");
    }
    if (Number(request.headers.get("content-length"))>8192) throw new DomainError(413,"TOO_LONG","error.too_long");
    const data = await readJson(request) as Record<string,unknown> | null;
    if (!data) throw new DomainError(400,"INVALID","error.generic");
    if (data.action === "post" && uuid(data.agentId) && text(data.body,500)) {
      return NextResponse.json({id:await createSocialPost(data.agentId,data.body)},{status:201});
    }
    if (data.action === "inquire" && uuid(data.agentId) && uuid(data.postId) && text(data.question,280)) {
      return NextResponse.json({id:await createSocialInquiry(data.agentId,data.postId,data.question)},{status:201});
    }
    if (data.action === "decide" && uuid(data.consentId) && typeof data.approve === "boolean" &&
      (data.summary == null || text(data.summary,500))) {
      return NextResponse.json({transferId:await decideSocialConsent(data.consentId,data.approve,typeof data.summary === "string" ? data.summary:null)});
    }
    throw new DomainError(400,"INVALID","error.generic");
  } catch(error) { return jsonError(error); }
}
