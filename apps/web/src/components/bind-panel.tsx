import { getTranslations } from "next-intl/server";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";

type Identity = {
  ownerId: string;
  ownerName: string;
  agentName: string;
  revokedAt: number | null;
};

export async function BindPanel({
  identities,
  currentOwnerId,
  errorMessage,
}: {
  identities: Identity[];
  currentOwnerId: string | null;
  errorMessage: string | null;
}) {
  const t = await getTranslations("connect");
  const current = identities.find((item) => item.ownerId === currentOwnerId && !item.revokedAt);

  return (
    <div className="mt-6">
      <p className="text-sm leading-6 text-muted">{t("switchNote")}</p>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {identities.map((identity) => {
          const isCurrent = identity.ownerId === currentOwnerId && !identity.revokedAt;
          return (
            <li key={identity.ownerId} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {identity.ownerName}
                  {isCurrent ? (
                    <span className="ml-2 text-xs font-normal text-accent">{t("current")}</span>
                  ) : null}
                  {identity.revokedAt ? (
                    <span className="ml-2 text-xs font-normal text-danger">{t("revoked")}</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted">{t("agentLine", { agent: identity.agentName })}</p>
              </div>
              {isCurrent ? (
                <Button asChild variant="outline" size="sm">
                  <a href="/plaza">{t("enter")}</a>
                </Button>
              ) : (
                <form action="/api/bind" method="post" className="shrink-0">
                  <input type="hidden" name="ownerId" value={identity.ownerId} />
                  <Button type="submit" size="sm">
                    {t("bind")}
                  </Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {current ? (
        <form action="/api/revoke" method="post" className="mt-8">
          <p className="text-sm leading-6 text-muted">{t("revokeHelp")}</p>
          <Button type="submit" variant="danger" className="mt-3" data-testid="revoke">
            {t("revoke")}
          </Button>
        </form>
      ) : null}
      <FormError message={errorMessage} />
    </div>
  );
}
