import { getTranslations } from "next-intl/server";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export async function ConsentForm({
  consentId,
  inquiryId,
  draft,
  errorMessage,
}: {
  consentId: string;
  inquiryId: string;
  draft: string;
  errorMessage: string | null;
}) {
  const t = await getTranslations("consent");

  return (
    <form action={`/api/consents/${consentId}/decide`} method="post" className="mt-6">
      <input type="hidden" name="next" value={`/inbox/${inquiryId}`} />
      <label htmlFor="summary" className="text-sm font-medium">
        {t("preview")}
      </label>
      <Textarea id="summary" name="summary" required maxLength={500} defaultValue={draft} className="mt-2" />
      <p className="mt-2 text-sm leading-6 text-muted">{t("previewHelp")}</p>
      <FormError message={errorMessage} />
      <div className="mt-6 flex flex-col gap-3">
        <Button type="submit" name="action" value="approve" className="w-full" data-action="approve">
          {t("approve")}
        </Button>
        <Button
          type="submit"
          name="action"
          value="approve"
          variant="outline"
          className="w-full"
          data-action="approve-edited"
        >
          {t("approveEdited")}
        </Button>
        <Button
          type="submit"
          name="action"
          value="reject"
          variant="danger"
          className="w-full"
          formNoValidate
          data-action="reject"
        >
          {t("reject")}
        </Button>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{t("rejectHelp")}</p>
    </form>
  );
}
