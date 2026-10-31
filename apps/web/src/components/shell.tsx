import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/locale-switch";
import { TabBar } from "@/components/tab-bar";
import { Button } from "@/components/ui/button";
import { countPending } from "@/lib/domain";
import { readSession } from "@/lib/actor";
import { isLocale } from "@/i18n/locale";

export async function Shell({
  title,
  showCompose = false,
  children,
}: {
  title: string;
  showCompose?: boolean;
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  const localeValue = await getLocale();
  const locale = isLocale(localeValue) ? localeValue : "zh-Hans";
  const session = await readSession();
  const active = Boolean(session && !session.agent.revokedAt);
  const pending = active && session ? countPending(session.agent.id) : 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-card text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <div className="flex items-center gap-3">
            <LocaleSwitch current={locale} />
            {showCompose ? (
              <Button asChild size="sm">
                <Link href="/plaza/new" data-testid="compose">
                  {t("plaza.compose")}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        {active && session ? (
          <Link
            href="/connect"
            data-testid="connect-link"
            className="mt-1 inline-flex text-sm text-muted underline-offset-4 hover:underline"
          >
            {session.agent.displayName}
            <span className="mx-1.5" aria-hidden>
              ·
            </span>
            {t("nav.connect")}
          </Link>
        ) : null}
      </header>
      <main className={active ? "flex-1 px-4 pb-24 pt-2" : "flex-1 px-4 pb-10 pt-2"}>
        {children}
      </main>
      {active ? (
        <TabBar
          label={t("nav.label")}
          plaza={t("nav.plaza")}
          inbox={t("nav.inbox")}
          pending={pending}
        />
      ) : null}
    </div>
  );
}
