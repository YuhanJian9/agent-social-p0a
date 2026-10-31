import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("state");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg items-center bg-card px-4 text-sm text-muted">
      {t("loading")}
    </div>
  );
}
