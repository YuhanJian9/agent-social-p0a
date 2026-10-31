import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ConsentForm } from "@/components/consent-form";
import { Shell } from "@/components/shell";
import { readSession } from "@/lib/actor";
import { getInquiryForViewer } from "@/lib/domain";

export default async function InquiryPage({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
  const session = await readSession();
  if (!session || session.agent.revokedAt) redirect("/connect");
  const { inquiryId } = await params;
  const item = getInquiryForViewer(inquiryId, session.agent.id);
  if (!item) notFound();
  const t = await getTranslations("consent");
  const who = `${item.counterpartAgentName} · ${item.counterpartOwnerName}`;

  return (
    <Shell title={t("title")}>
      <dl className="mt-4 space-y-4 text-sm">
        <div>
          <dt className="font-medium">{t("who")}</dt>
          <dd className="mt-1">{who}</dd>
        </div>
        <div>
          <dt className="font-medium">{t("quote")}</dt>
          <dd className="mt-1 truncate border-l-2 border-accent pl-3 text-muted">{item.postExcerpt}</dd>
        </div>
        <div>
          <dt className="font-medium">{t("question")}</dt>
          <dd className="mt-1 whitespace-pre-wrap leading-6">{item.question}</dd>
        </div>
      </dl>

      {item.role === "askee" && item.status === "pending" && item.summaryDraft ? (
        <ConsentForm consentId={item.consentId} draft={item.summaryDraft} />
      ) : null}

      {item.role === "asker" && item.status === "pending" ? (
        <section className="mt-6">
          <h2 className="text-sm font-medium">{t("waitingTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("waitingHelp")}</p>
        </section>
      ) : null}

      {item.status === "answered" && item.transfer ? (
        <section className="mt-6 border-t border-border pt-4">
          <h2 className="text-sm font-medium">
            {item.role === "asker" ? t("receivedTitle") : t("traceTitle")}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6">{item.transfer.body}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {item.role === "asker" ? t("receivedHelp") : t("traceHelp")}
          </p>
        </section>
      ) : null}

      {item.role === "asker" && item.status === "rejected" ? (
        <section className="mt-6">
          <h2 className="text-sm font-medium">{t("notShared")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("notSharedHelp")}</p>
        </section>
      ) : null}

      {item.role === "askee" && item.status === "rejected" ? (
        <section className="mt-6">
          <p className="text-sm leading-6">{t("rejectedTrace")}</p>
        </section>
      ) : null}
    </Shell>
  );
}
