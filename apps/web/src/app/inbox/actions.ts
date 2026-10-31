"use server";
import { redirect } from "next/navigation";
import { decideSocialConsent } from "@/lib/social/postgres";

export async function decideOwnerConsent(form:FormData) {
  const consent=String(form.get("consentId") ?? "");
  const action=form.get("decision");
  const summary=String(form.get("summary") ?? "").trim();
  if(!/^[0-9a-f-]{36}$/i.test(consent)||!["approve","reject"].includes(String(action))) redirect("/inbox?message=error");
  if(action==='approve'&&(!summary||summary.length>500)) redirect("/inbox?message=error");
  try{await decideSocialConsent(consent,action==='approve',action==='approve'?summary:null);}
  catch{redirect("/inbox?message=error");}
  redirect("/inbox?message=recorded");
}
