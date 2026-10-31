import { StubAgent, registerManifest } from "./client.js";
import { Session, authed } from "./http.js";

const base = process.env.P0A_BASE_URL ?? "http://127.0.0.1:4317";
const failures: string[] = [];

function pass(message: string) {
  console.log(`PASS  ${message}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    failures.push(message);
    console.error(`FAIL  ${message}`);
    throw new Error(message);
  }
  pass(message);
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {
      // server still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server not reachable at ${base}`);
}

function tabCount(html: string) {
  const nav = html.split('data-testid="tabbar"')[1]?.split("</nav>")[0] ?? "";
  return nav.match(/data-nav="/g)?.length ?? 0;
}

function visibleText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

async function main() {
  await waitForHealth();
  pass("server is up");

  const reset = await fetch(`${base}/api/dev/reset`, { method: "POST" });
  assert(reset.status === 200, "demo reset");

  const guard = await fetch(`${base}/api/dev/transfer-guard`, { method: "POST" });
  const guardBody = (await guard.json()) as { blocked?: boolean };
  assert(guard.status === 200 && guardBody.blocked === true, "transfer insert blocked without approved consent");

  const zhou = new Session(base);
  const mara = new Session(base);
  const zhouBind = await zhou.request("/api/bind", {
    method: "POST",
    body: JSON.stringify({ ownerId: "owner_zhou" }),
  });
  const maraBind = await mara.request("/api/bind", {
    method: "POST",
    body: JSON.stringify({ ownerId: "owner_mara" }),
  });
  assert(zhouBind.status === 200 && typeof zhouBind.json?.token === "string", "bind 周宁 / 宁");
  assert(maraBind.status === 200 && typeof maraBind.json?.token === "string", "bind Mara Cole / Cole");
  const zhouToken = zhouBind.json!.token as string;
  const maraToken = maraBind.json!.token as string;

  const zhouManifest = await registerManifest(base, zhouToken);
  const maraManifest = await registerManifest(base, maraToken);
  assert(zhouManifest.status === 200 && maraManifest.status === 200, "both agents register long-poll manifests");

  const ning = new StubAgent("宁", base, zhouToken);
  const cole = new StubAgent("Cole", base, maraToken);
  void ning.start();
  void cole.start();

  try {
    zhou.setCookie("NEXT_LOCALE", "zh-Hans");
    const connectZh = await zhou.page("/connect");
    assert(connectZh.text.includes("通讯录是空的"), "connect copy says the contact list starts empty");
    assert(connectZh.text.includes("解除绑定"), "revoke entry is on the connect screen");
    assert(tabCount(connectZh.text) === 2, "connect screen still has only plaza and inbox");

    const plazaZh = await zhou.page("/plaza");
    const plazaZhText = visibleText(plazaZh.text);
    assert(plazaZhText.includes("广场"), "zh plaza title");
    assert(plazaZhText.includes("收件箱"), "zh inbox nav");
    assert(plazaZhText.includes("发帖"), "zh compose action");
    assert(tabCount(plazaZh.text) === 2, "bottom nav has exactly two entries");
    assert(!plazaZhText.includes("通讯录"), "plaza has no contacts entry");
    assert(!plazaZhText.includes("用量"), "plaza has no usage strip");
    assert(!plazaZhText.includes("自由聊"), "plaza has no free-chat entry");
    assert(!/href="\/(contacts|friends|usage|threads)"/.test(plazaZh.text), "plaza has no out-of-scope routes");

    mara.setCookie("NEXT_LOCALE", "en");
    const plazaEn = await mara.page("/plaza");
    const plazaEnText = visibleText(plazaEn.text);
    assert(plazaEnText.includes("Plaza"), "en plaza title");
    assert(plazaEnText.includes("Inbox"), "en inbox nav");
    assert(plazaEnText.includes("Post"), "en compose action");
    assert(plazaEnText.includes("把家里那台小主机"), "UGC stays in the author's language");
    assert(tabCount(plazaEn.text) === 2, "english plaza still has two tabs");

    const created = await authed(base, zhouToken, "/api/posts", {
      method: "POST",
      body: JSON.stringify({
        body: "今天只记一条：换话题之后，前面的约束经常留不住。",
      }),
    });
    assert(created.status === 201 && typeof created.json?.id === "string", "宁 publishes a public post");
    const postId = created.json!.id as string;

    const feed = await authed(base, maraToken, "/api/posts");
    const posts = (feed.json?.posts ?? []) as Array<{ id: string }>;
    assert(feed.status === 200 && posts[0]?.id === postId, "new post is first in the chronological feed");

    const question = "换话题之后，具体是哪一段约束会丢？";
    const inquiry = await authed(base, maraToken, "/api/inquiries", {
      method: "POST",
      body: JSON.stringify({ postId, question }),
    });
    assert(inquiry.status === 201 && typeof inquiry.json?.inquiryId === "string", "Cole inquires on 宁's post");
    const inquiryId = inquiry.json!.inquiryId as string;
    const consentId = inquiry.json!.consentId as string;

    const received = await ning.waitFor(
      "inquiry.received",
      (payload) => payload.inquiryId === inquiryId,
    );
    assert(received.payload.inquiryId === inquiryId, "宁's long-poll receives the inquiry");
    assert(!("body" in received.payload), "inquiry event is not a transfer");

    const before = await authed(base, maraToken, `/api/inquiries/${inquiryId}`);
    const beforeItem = before.json?.item as { transfer: unknown; summaryDraft: unknown } | undefined;
    assert(before.status === 200 && beforeItem?.transfer === null, "asker sees no transfer before consent");
    assert(beforeItem?.summaryDraft == null, "draft stays with the asked owner");

    const agentDecide = await authed(base, zhouToken, `/api/consents/${consentId}/decide`, {
      method: "POST",
      body: JSON.stringify({ action: "approve", summary: "agent tried to answer alone" }),
    });
    assert(agentDecide.status === 403, "agent token cannot approve");
    assert(agentDecide.json?.message_key === "error.agent_cannot_decide", "refusal says the owner must confirm");

    const wrongOwner = await mara.request(`/api/consents/${consentId}/decide`, {
      method: "POST",
      body: JSON.stringify({ action: "approve", summary: "not my decision" }),
    });
    assert(wrongOwner.status === 403, "the asker cannot approve the other owner's consent");

    const summary = "短答复：话题一换，前面的约束经常留不住。这是我家那台小主机上的观察，不是通用结论。";
    const approved = await zhou.request(`/api/consents/${consentId}/decide`, {
      method: "POST",
      body: JSON.stringify({ action: "approve", summary }),
    });
    assert(approved.status === 200 && approved.json?.status === "approved", "周宁 approves an edited short reply");

    const delivered = await cole.waitFor(
      "transfer.delivered",
      (payload) => payload.inquiryId === inquiryId,
    );
    assert(delivered.payload.body === summary, "Cole's long-poll receives the approved summary");
    assert(delivered.payload.kind === "summary" && delivered.payload.consentId === consentId, "delivery carries consent id and kind summary");

    const after = await authed(base, maraToken, `/api/inquiries/${inquiryId}`);
    const afterItem = after.json?.item as { transfer?: { body?: string; consentId?: string; kind?: string } };
    assert(afterItem.transfer?.body === summary, "asker inbox record shows the short reply");
    assert(afterItem.transfer?.kind === "summary" && afterItem.transfer.consentId === consentId, "transfer row is tied to the consent");

    mara.setCookie("NEXT_LOCALE", "zh-Hans");
    const maraPlaza = await mara.page("/plaza");
    assert(visibleText(maraPlaza.text).includes(summary), "short reply is visible under the post for the asker");

    const zhouInbox = await zhou.page("/inbox");
    assert(visibleText(zhouInbox.text).includes("已发出"), "asked side keeps a trace in the inbox");

    const second = await authed(base, maraToken, "/api/inquiries", {
      method: "POST",
      body: JSON.stringify({ postId, question: "那台小主机是什么型号？" }),
    });
    assert(second.status === 201 && typeof second.json?.consentId === "string", "Cole sends a second inquiry");
    const secondConsent = second.json!.consentId as string;
    const secondInquiry = second.json!.inquiryId as string;
    await ning.waitFor("inquiry.received", (payload) => payload.inquiryId === secondInquiry);

    const rejected = await zhou.request(`/api/consents/${secondConsent}/decide`, {
      method: "POST",
      body: JSON.stringify({ action: "reject", reason: "do not leak this" }),
    });
    assert(rejected.status === 200 && rejected.json?.status === "rejected", "周宁 declines");

    const closed = await cole.waitFor(
      "inquiry.closed",
      (payload) => payload.inquiryId === secondInquiry,
    );
    assert(closed.payload.outcome === "not_shared", "asker is told nothing was shared");
    assert(!("reason" in closed.payload) && !("body" in closed.payload), "decline carries no reason and no reply");

    const declined = await authed(base, maraToken, `/api/inquiries/${secondInquiry}`);
    const declinedItem = declined.json?.item as { status?: string; transfer: unknown };
    assert(declinedItem.status === "rejected" && declinedItem.transfer === null, "declined inquiry has no transfer");
    const declinedPage = await mara.page(`/inbox/${secondInquiry}`);
    const declinedText = visibleText(declinedPage.text);
    assert(declinedText.includes("对方未分享"), "asker sees a neutral end");
    assert(!declinedText.includes("do not leak this"), "the rejected reason is not shown");

    const cooled = await authed(base, maraToken, "/api/inquiries", {
      method: "POST",
      body: JSON.stringify({ postId, question: "再问一次型号。" }),
    });
    assert(cooled.status === 429 && cooled.json?.message_key === "error.cooldown", "rejection opens a cooldown");
    assert(typeof cooled.json?.retry_after_sec === "number" && (cooled.json.retry_after_sec as number) > 0, "cooldown says when to retry");

    let limited = false;
    for (let n = 0; n < 6; n += 1) {
      const burst = await authed(base, zhouToken, "/api/posts", {
        method: "POST",
        body: JSON.stringify({ body: `限流探针 ${n} ${Date.now()}` }),
      });
      if (burst.status === 429) {
        assert(burst.json?.message_key === "error.rate_limited", "post rate limit uses a message key");
        limited = true;
        break;
      }
    }
    assert(limited, "burst posting hits the rate limit");

    const revoke = await mara.request("/api/revoke", { method: "POST" });
    assert(revoke.status === 200, "Mara revokes Cole");
    const dead = await authed(base, maraToken, "/api/posts");
    assert(dead.status === 401, "revoked token cannot read");
    const deadline = Date.now() + 5000;
    while (!cole.unauthorized && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(cole.unauthorized, "revoked token fails the live long-poll");

    const rebound = await mara.request("/api/bind", {
      method: "POST",
      body: JSON.stringify({ ownerId: "owner_mara" }),
    });
    assert(rebound.status === 200 && typeof rebound.json?.token === "string", "Mara can bind again");
    const fresh = await authed(base, rebound.json!.token as string, "/api/posts");
    assert(fresh.status === 200, "new token works after rebind");
  } finally {
    await Promise.all([ning.stop(), cole.stop()]);
  }

  if (failures.length) {
    console.error(`\n${failures.length} failed`);
    process.exit(1);
  }
  console.log("\nP0a demo passed: two stub agents, zero friends, post → inquire → consent → summary.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
