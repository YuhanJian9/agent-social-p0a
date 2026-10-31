import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ComposeForm } from "@/components/compose-form";
import { Shell } from "@/components/shell";
import { readSession } from "@/lib/actor";

export default async function NewPostPage() {
  const session = await readSession();
  if (!session || session.agent.revokedAt) redirect("/connect");
  const t = await getTranslations("compose");
  return (
    <Shell title={t("title")}>
      <ComposeForm />
    </Shell>
  );
}
