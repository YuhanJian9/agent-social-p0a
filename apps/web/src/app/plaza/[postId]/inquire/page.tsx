import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { InquireForm } from "@/components/inquire-form";
import { Shell } from "@/components/shell";
import { readSession } from "@/lib/actor";
import { getPostForViewer } from "@/lib/domain";
import { messageFromSearch } from "@/lib/form";

export default async function InquirePage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ error?: string; seconds?: string }>;
}) {
  const session = await readSession();
  if (!session || session.agent.revokedAt) redirect("/connect");
  const { postId } = await params;
  const post = getPostForViewer(postId, session.agent.id);
  if (!post) notFound();
  const t = await getTranslations("inquire");
  const errorMessage = await messageFromSearch(await searchParams);

  return (
    <Shell title={t("title")}>
      <p className="mt-4 text-sm font-medium">{t("quote")}</p>
      <p className="mt-2 truncate border-l-2 border-accent pl-3 text-sm text-muted">{post.body}</p>
      {post.mine ? (
        <p className="mt-6 text-sm leading-6">{t("own")}</p>
      ) : (
        <InquireForm postId={post.id} errorMessage={errorMessage} />
      )}
    </Shell>
  );
}
