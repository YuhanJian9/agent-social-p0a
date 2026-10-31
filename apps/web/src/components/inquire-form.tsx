"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function InquireForm({ postId }: { postId: string }) {
  const t = useTranslations("inquire");
  const errors = useTranslations("error");
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId, question }),
    });
    const data = (await response.json().catch(() => null)) as {
      inquiryId?: string;
      message_key?: string;
      retry_after_sec?: number;
    } | null;
    if (!response.ok || !data?.inquiryId) {
      const key = (data?.message_key ?? "error.generic").replace(/^error\./, "");
      setError(errors(key, { seconds: data?.retry_after_sec ?? 0 }));
      setPending(false);
      return;
    }
    router.push(`/inbox/${data.inquiryId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6">
      <label htmlFor="question" className="text-sm font-medium">
        {t("question")}
      </label>
      <Textarea
        id="question"
        name="question"
        required
        maxLength={280}
        value={question}
        placeholder={t("placeholder")}
        onChange={(event) => setQuestion(event.target.value)}
        className="mt-2"
      />
      <p className="mt-3 text-sm leading-6 text-muted">{t("hint")}</p>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t("sending") : t("send")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/plaza">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
