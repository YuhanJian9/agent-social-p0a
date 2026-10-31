"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ConsentForm({
  consentId,
  draft,
}: {
  consentId: string;
  draft: string;
}) {
  const t = useTranslations("consent");
  const errors = useTranslations("error");
  const router = useRouter();
  const [text, setText] = useState(draft);
  const [pending, setPending] = useState<"approve" | "edited" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = text.trim() !== draft.trim();

  async function decide(action: "approve" | "reject", summary?: string, which?: "approve" | "edited" | "reject") {
    setPending(which ?? (action === "reject" ? "reject" : "approve"));
    setError(null);
    const response = await fetch(`/api/consents/${consentId}/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        action === "reject" ? { action } : { action, summary },
      ),
    });
    const data = (await response.json().catch(() => null)) as {
      message_key?: string;
      retry_after_sec?: number;
    } | null;
    if (!response.ok) {
      const key = (data?.message_key ?? "error.generic").replace(/^error\./, "");
      setError(errors(key, { seconds: data?.retry_after_sec ?? 0 }));
      setPending(null);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6">
      <label htmlFor="summary" className="text-sm font-medium">
        {t("preview")}
      </label>
      <Textarea
        id="summary"
        value={text}
        maxLength={500}
        onChange={(event) => setText(event.target.value)}
        className="mt-2"
      />
      <p className="mt-2 text-sm leading-6 text-muted">{t("previewHelp")}</p>
      {dirty ? (
        <button
          type="button"
          className="mt-2 text-sm text-muted underline-offset-4 hover:underline"
          onClick={() => setText(draft)}
        >
          {t("revert")}
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3">
        <Button
          type="button"
          className="w-full"
          data-action="approve"
          disabled={pending !== null || dirty || !draft.trim()}
          onClick={() => decide("approve", draft, "approve")}
        >
          {pending === "approve" ? t("working") : t("approve")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          data-action="approve-edited"
          disabled={pending !== null || !dirty || !text.trim()}
          onClick={() => decide("approve", text, "edited")}
        >
          {pending === "edited" ? t("working") : t("approveEdited")}
        </Button>
        <Button
          type="button"
          variant="danger"
          className="w-full"
          data-action="reject"
          disabled={pending !== null}
          onClick={() => decide("reject", undefined, "reject")}
        >
          {pending === "reject" ? t("working") : t("reject")}
        </Button>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{t("rejectHelp")}</p>
    </div>
  );
}
