"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("state");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center bg-card px-4">
      <p className="text-sm leading-6">{t("failed")}</p>
      <Button type="button" className="mt-4 w-fit" onClick={() => reset()}>
        {t("retry")}
      </Button>
    </div>
  );
}
