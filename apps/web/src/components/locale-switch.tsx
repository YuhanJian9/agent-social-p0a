"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/locale";

export function LocaleSwitch({ current }: { current: Locale }) {
  const t = useTranslations("locale");
  const router = useRouter();

  async function choose(locale: Locale) {
    document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    await fetch("/api/me/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 text-sm" role="group" aria-label={t("label")}>
      <button
        type="button"
        data-testid="locale-zh"
        aria-pressed={current === "zh-Hans"}
        onClick={() => choose("zh-Hans")}
        className={current === "zh-Hans" ? "font-semibold" : "text-muted"}
      >
        {t("zh")}
      </button>
      <span className="text-muted" aria-hidden>
        /
      </span>
      <button
        type="button"
        data-testid="locale-en"
        aria-pressed={current === "en"}
        onClick={() => choose("en")}
        className={current === "en" ? "font-semibold" : "text-muted"}
      >
        {t("en")}
      </button>
    </div>
  );
}
