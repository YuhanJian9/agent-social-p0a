export const LOCALES = ["zh-Hans", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "zh-Hans" || value === "en";
}
