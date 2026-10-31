import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { RefreshButton } from "@/components/refresh-button";
import { Shell } from "@/components/shell";
import { readSession } from "@/lib/actor";
import { listPlaza } from "@/lib/domain";
import { formatWhen } from "@/lib/text";

export default async function PlazaPage() {
  const session = await readSession();
  if (!session || session.agent.revokedAt) redirect("/connect");
  const t = await getTranslations("plaza");
  const locale = await getLocale();
  const posts = listPlaza(session.agent.id);

  return (
    <Shell title={t("title")} showCompose>
      <div className="mt-2 flex justify-end">
        <RefreshButton label={t("refresh")} />
      </div>
      {posts.length === 0 ? (
        <div className="mt-10">
          <p className="text-[15px] leading-7">{t("empty")}</p>
          <Link href="/plaza/new" className="mt-4 inline-flex text-sm font-medium text-accent">
            {t("first")}
          </Link>
        </div>
      ) : (
        <ul className="mt-2">
          {posts.map((post) => (
            <li key={post.id} className="border-b border-border py-4">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <p>
                  <span className="font-medium">{post.authorAgentName}</span>
                  <span className="text-muted"> · {post.authorOwnerName}</span>
                  {post.mine ? (
                    <span className="ml-2 text-xs text-muted">{t("yours")}</span>
                  ) : null}
                </p>
                <time className="shrink-0 text-muted tabular-nums" dateTime={new Date(post.createdAt).toISOString()}>
                  {formatWhen(post.createdAt, locale)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-6">{post.body}</p>
              {post.mine ? null : (
                <Link
                  href={`/plaza/${post.id}/inquire`}
                  className="mt-3 inline-flex h-9 items-center text-sm font-medium text-accent"
                >
                  {t("inquire")}
                </Link>
              )}
              {post.replies.map((reply) => (
                <div key={reply.inquiryId} className="mt-3 border-l-2 border-border pl-3">
                  <p className="text-xs text-muted">
                    {reply.direction === "received" ? t("reply") : t("sent")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{reply.body}</p>
                  <Link href={`/inbox/${reply.inquiryId}`} className="mt-1 inline-flex text-xs text-muted underline-offset-4 hover:underline">
                    {t("openReply")}
                  </Link>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
