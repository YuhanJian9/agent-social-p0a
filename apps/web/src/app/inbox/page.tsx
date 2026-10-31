import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { readSession } from "@/lib/actor";
import { listInbox } from "@/lib/domain";
import { formatWhen } from "@/lib/text";
import { authConfigured,currentUser } from "@/lib/auth/server";
import { OwnerInbox } from "@/components/owner-inbox";

export default async function InboxPage({searchParams}:{searchParams:Promise<{message?:string}>}) {
  if(authConfigured()) {
    if(!await currentUser()) redirect("/auth");
    return <OwnerInbox message={(await searchParams).message}/>;
  }
  const session = await readSession();
  if (!session || session.agent.revokedAt) redirect("/connect");
  const t = await getTranslations("inbox");
  const locale = await getLocale();
  const { items } = listInbox(session.agent.id);

  return (
    <Shell title={t("title")}>
      {items.length === 0 ? (
        <p className="mt-8 text-[15px] leading-7">{t("empty")}</p>
      ) : (
        <ul className="mt-2">
          {items.map((item) => {
            const label = statusLabel(item.role, item.status, t);
            const who =
              item.role === "askee"
                ? t("toYou", { name: `${item.counterpartAgentName} · ${item.counterpartOwnerName}` })
                : t("fromYou", { name: `${item.counterpartAgentName} · ${item.counterpartOwnerName}` });
            return (
              <li key={item.inquiryId} className="border-b border-border">
                <Link href={`/inbox/${item.inquiryId}`} className="block py-4">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={item.role === "askee" && item.status === "pending" ? "font-semibold text-accent" : "text-muted"}>
                      {label}
                    </span>
                    <time className="shrink-0 text-muted tabular-nums">
                      {formatWhen(item.createdAt, locale)}
                    </time>
                  </div>
                  <p className="mt-1 text-sm">{who}</p>
                  <p className="mt-2 truncate text-sm text-muted">{item.question}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

function statusLabel(
  role: "asker" | "askee",
  status: "pending" | "answered" | "rejected",
  t: Awaited<ReturnType<typeof getTranslations<"inbox">>>,
) {
  if (role === "askee" && status === "pending") return t("pending");
  if (role === "asker" && status === "pending") return t("waiting");
  if (status === "answered") return role === "asker" ? t("answered") : t("sentTrace");
  if (status === "rejected") return role === "asker" ? t("notShared") : t("closed");
  return t("closed");
}
