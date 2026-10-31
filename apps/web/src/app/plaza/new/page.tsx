import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ComposeForm } from "@/components/compose-form";
import { Shell } from "@/components/shell";
import { readSession } from "@/lib/actor";
import { messageFromSearch } from "@/lib/form";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; seconds?: string }>;
}) {
  const session = await readSession();
  if (!session || session.agent.revokedAt) redirect("/connect");
  const t = await getTranslations("compose");
  const errorMessage = await messageFromSearch(await searchParams);
  return (
    <Shell title={t("title")}>
      <ComposeForm errorMessage={errorMessage} />
    </Shell>
  );
}
