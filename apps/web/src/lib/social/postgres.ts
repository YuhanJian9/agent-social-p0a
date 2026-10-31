import "server-only";
import { authClient, currentUser } from "@/lib/auth/server";
import { DomainError } from "@/lib/errors";
import { buildSummaryDraft } from "@/lib/draft";

export function checkSocialError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  const message = error.message ?? "";
  if (error.code === "28000") throw new DomainError(401,"UNAUTHORIZED","error.unauthorized");
  if (message === "AGENT_CANNOT_DECIDE" || message === "SCOPE") throw new DomainError(403,message,message === "SCOPE" ? "error.scope" : "error.agent_cannot_decide");
  if (error.code === "42501" || message === "FORBIDDEN") throw new DomainError(403,"FORBIDDEN","error.forbidden");
  if (message === "RATE_LIMITED" || message === "COOLDOWN") throw new DomainError(429,message,message === "COOLDOWN" ? "error.cooldown" : "error.rate_limited");
  if (message === "ALREADY_DECIDED") throw new DomainError(409,"ALREADY_DECIDED","error.already_decided");
  if (["23514","23502","22P02","22023"].includes(error.code ?? "") || ["INVALID_TARGET","INVALID_DECISION","INVALID_MANIFEST","INVALID_CURSOR","INVALID_TOKEN"].includes(message)) throw new DomainError(400,"INVALID","error.generic");
  // Do not put database errors or private text in logs or responses.
  throw new DomainError(503,"UNAVAILABLE","error.generic");
}
const check = checkSocialError;
async function client() {
  if (!await currentUser()) throw new DomainError(401,"UNAUTHORIZED","error.unauthorized");
  return authClient();
}
export type FeedPost = { id: string; body: string; created_at: string; author_agent_id: string; agent_name: string; owner_name: string };
export async function readFeed(): Promise<FeedPost[]> {
  const db = await client();
  const { data,error } = await db.rpc("social_feed"); check(error);
  return data ?? [];
}
export async function readInbox() {
  const db = await client();
  const [inquiries,consents,transfers] = await Promise.all([
    db.from("inquiries").select("id,from_agent_id,to_agent_id,post_id,question,status,created_at").order("created_at",{ascending:false}).limit(100),
    db.from("consents").select("id,inquiry_id,status,summary_draft,decided_at").order("id").limit(100),
    db.from("transfers").select("id,consent_id,kind,body,created_at").order("created_at",{ascending:false}).limit(100),
  ]);
  check(inquiries.error); check(consents.error); check(transfers.error);
  return {inquiries:inquiries.data,consents:consents.data,transfers:transfers.data};
}
export async function readSocialEvents(cursor: number) {
  const db = await client();
  const {data,error} = await db.from("agent_events").select("id,agent_id,type,payload,created_at")
    .gt("id",cursor).order("id").limit(50);
  check(error); return data;
}
export async function createSocialPost(agent: string, body: string) {
  const db = await client();
  const {data,error} = await db.rpc("social_create_post",{agent,body_text:body}); check(error); return data;
}
export async function createSocialInquiry(agent: string, post: string, question: string) {
  const db = await client();
  const {data:publicPost,error:postError} = await db.from("posts").select("body").eq("id",post).maybeSingle();
  check(postError);
  if (!publicPost) throw new DomainError(404,"NOT_FOUND","error.not_found");
  const {data,error} = await db.rpc("social_create_inquiry",{agent,post,question_text:question,
    draft_text:buildSummaryDraft(publicPost.body,question,"zh-Hans")}); check(error); return data;
}
export async function decideSocialConsent(consent: string, approve: boolean, summary: string | null) {
  const db = await client();
  const {data,error} = await db.rpc("social_decide_consent",{consent,approve,summary_text:summary}); check(error); return data;
}
