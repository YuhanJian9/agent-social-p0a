"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Identity = {
  ownerId: string;
  ownerName: string;
  agentName: string;
  revokedAt: number | null;
};

export function BindPanel({
  identities,
  currentOwnerId,
}: {
  identities: Identity[];
  currentOwnerId: string | null;
}) {
  const t = useTranslations("connect");
  const errors = useTranslations("error");
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function bind(ownerId: string) {
    setPending(ownerId);
    setError(null);
    const response = await fetch("/api/bind", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerId }),
    });
    const data = (await response.json().catch(() => null)) as {
      message_key?: string;
      retry_after_sec?: number;
    } | null;
    if (!response.ok) {
      setError(readError(errors, data));
      setPending(null);
      return;
    }
    router.push("/plaza");
    router.refresh();
  }

  async function revoke() {
    setPending("revoke");
    setError(null);
    const response = await fetch("/api/revoke", { method: "POST" });
    const data = (await response.json().catch(() => null)) as {
      message_key?: string;
    } | null;
    if (!response.ok) {
      setError(readError(errors, data));
      setPending(null);
      return;
    }
    router.refresh();
    setPending(null);
  }

  const current = identities.find((item) => item.ownerId === currentOwnerId && !item.revokedAt);

  return (
    <div className="mt-6">
      <p className="text-sm leading-6 text-muted">{t("switchNote")}</p>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {identities.map((identity) => {
          const isCurrent = identity.ownerId === currentOwnerId && !identity.revokedAt;
          return (
            <li key={identity.ownerId} className="flex items-center justify-between gap-3 py-4">
              <div>
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
                <Button
                  type="button"
                  size="sm"
                  disabled={pending !== null}
                  onClick={() => bind(identity.ownerId)}
                >
                  {pending === identity.ownerId ? t("binding") : t("bind")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {current ? (
        <div className="mt-8">
          <p className="text-sm leading-6 text-muted">{t("revokeHelp")}</p>
          <Button
            type="button"
            variant="danger"
            className="mt-3"
            data-testid="revoke"
            disabled={pending !== null}
            onClick={revoke}
          >
            {pending === "revoke" ? t("revoking") : t("revoke")}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function readError(
  t: (key: string, values?: { seconds: number }) => string,
  data: { message_key?: string; retry_after_sec?: number } | null,
) {
  const key = (data?.message_key ?? "error.generic").replace(/^error\./, "");
  return t(key, { seconds: data?.retry_after_sec ?? 0 });
}
