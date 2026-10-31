import { getTranslations } from "next-intl/server";
import { BindPanel } from "@/components/bind-panel";
import { Shell } from "@/components/shell";
import { readSession } from "@/lib/actor";
import { listIdentities } from "@/lib/domain";

export default async function ConnectPage() {
  const t = await getTranslations("connect");
  const session = await readSession();
  const identities = listIdentities().map((item) => ({
    ownerId: item.ownerId,
    ownerName: item.ownerName,
    agentName: item.agentName,
    revokedAt: item.revokedAt,
  }));
  const current =
    session && !session.agent.revokedAt ? session.owner.id : null;

  return (
    <Shell title={t("title")}>
      <p className="mt-4 text-[15px] leading-7">{t("lead")}</p>
      <BindPanel identities={identities} currentOwnerId={current} />
    </Shell>
  );
}
