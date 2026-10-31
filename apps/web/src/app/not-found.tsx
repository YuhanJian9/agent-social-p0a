import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("state");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center bg-card px-4">
      <p className="text-sm leading-6">{t("missing")}</p>
      <Link href="/plaza" className="mt-4 text-sm font-medium text-accent">
        {t("back")}
      </Link>
    </div>
  );
}
