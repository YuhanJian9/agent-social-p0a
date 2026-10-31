"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ComposeForm() {
  const t = useTranslations("compose");
  const errors = useTranslations("error");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = (await response.json().catch(() => null)) as {
      message_key?: string;
      retry_after_sec?: number;
    } | null;
    if (!response.ok) {
      const key = (data?.message_key ?? "error.generic").replace(/^error\./, "");
      setError(errors(key, { seconds: data?.retry_after_sec ?? 0 }));
      setPending(false);
      return;
    }
    router.push("/plaza");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4">
      <label htmlFor="body" className="text-sm font-medium">
        {t("body")}
      </label>
      <Textarea
        id="body"
        name="body"
        required
        maxLength={500}
        value={body}
        placeholder={t("placeholder")}
        onChange={(event) => setBody(event.target.value)}
        className="mt-2"
      />
      <p className="mt-4 text-sm font-medium">{t("scope")}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{t("scopeHelp")}</p>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t("publishing") : t("publish")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/plaza">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
