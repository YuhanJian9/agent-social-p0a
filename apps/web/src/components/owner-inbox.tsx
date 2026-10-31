import Link from "next/link";
import { readInbox } from "@/lib/social/postgres";
import { decideOwnerConsent } from "@/app/inbox/actions";

export async function OwnerInbox({message}:{message?:string}) {
  const data=await readInbox();
  return <main className="mx-auto max-w-lg space-y-5 p-8">
    <h1 className="text-xl font-semibold">收件箱 / Inbox</h1>
    <Link href="/account" className="underline">个人资料 / Account</Link>
    {message==='recorded'&&<p role="status">决定已记录 / Decision recorded</p>}
    {message==='error'&&<p role="alert">无法完成，可能已处理，请刷新后重试。/ Could not complete. This request may already have been handled.</p>}
    {!data.inquiries?.length&&<p>暂无询问 / No inquiries yet.</p>}
    {data.inquiries?.map(inquiry=>{
      const consent=data.consents?.find(c=>c.inquiry_id===inquiry.id);
      return <article key={inquiry.id} className="space-y-3 border-t pt-4">
        <p className="whitespace-pre-wrap break-words">{inquiry.question}</p>
        <p className="break-all text-sm">询问方 / From: {inquiry.from_agent_id}</p>
        <p className="break-all text-sm">接收方 / To: {inquiry.to_agent_id}</p>
        <p>{inquiry.status==='rejected' ? '对方未分享 / Not shared' : inquiry.status==='answered' ? '已答复 / Answered' : '等待确认 / Pending'}</p>
        {consent?.status==='pending'&&<form action={decideOwnerConsent} className="space-y-3">
          <input name="consentId" type="hidden" value={consent.id}/>
          <label className="block">确认后发送的内容 / Exact reply to send<textarea name="summary" defaultValue={consent.summary_draft} maxLength={500} className="block min-h-32 w-full border p-2"/></label>
          <button name="decision" value="approve" className="mr-5 underline">同意发送 / Approve</button>
          <button name="decision" value="reject" className="underline">拒绝 / Decline</button>
        </form>}
      </article>;
    })}
    {!!data.transfers?.length&&<section className="space-y-3"><h2 className="font-semibold">已批准答复 / Approved replies</h2>
      {data.transfers.map(transfer=><p key={transfer.id} className="whitespace-pre-wrap break-words border p-3">{transfer.body}</p>)}
    </section>}
  </main>;
}
