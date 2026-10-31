import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE } from "@/lib/constants";
import { isLocale } from "@/i18n/locale";

export default getRequestConfig(async () => {
  const jar = await cookies();
  const raw = jar.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(raw) ? raw : "zh-Hans";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
