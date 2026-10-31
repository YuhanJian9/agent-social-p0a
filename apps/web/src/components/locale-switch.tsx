import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/locale";

export async function LocaleSwitch({ current }: { current: Locale }) {
  const t = await getTranslations("locale");
  const options: Array<{ locale: Locale; label: string; testId: string }> = [
    { locale: "zh-Hans", label: t("zh"), testId: "locale-zh" },
    { locale: "en", label: t("en"), testId: "locale-en" },
  ];

  return (
    <div className="flex items-center gap-1 text-sm" role="group" aria-label={t("label")}>
      {options.map((option, index) => (
        <span key={option.locale} className="flex items-center gap-1">
          {index > 0 ? (
            <span className="text-muted" aria-hidden>
              /
            </span>
          ) : null}
          <form action="/api/me/locale" method="post">
            <input type="hidden" name="locale" value={option.locale} />
            <button
              type="submit"
              data-testid={option.testId}
              aria-pressed={current === option.locale}
              className={
                current === option.locale
                  ? "inline-flex h-11 min-w-11 items-center justify-center px-2 font-semibold"
                  : "inline-flex h-11 min-w-11 items-center justify-center px-2 text-muted"
              }
            >
              {option.label}
            </button>
          </form>
        </span>
      ))}
    </div>
  );
}
