import { getTranslations } from "next-intl/server";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export async function InquireForm({
  postId,
  errorMessage,
}: {
  postId: string;
  errorMessage: string | null;
}) {
  const t = await getTranslations("inquire");

  return (
    <form action="/api/inquiries" method="post" className="mt-6">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="next" value={`/plaza/${postId}/inquire`} />
      <label htmlFor="question" className="text-sm font-medium">
        {t("question")}
      </label>
      <Textarea
        id="question"
        name="question"
        required
        maxLength={280}
        placeholder={t("placeholder")}
        className="mt-2"
      />
      <p className="mt-3 text-sm leading-6 text-muted">{t("hint")}</p>
      <FormError message={errorMessage} />
      <div className="mt-6 flex gap-3">
        <Button type="submit">{t("send")}</Button>
        <Button asChild variant="outline">
          <a href="/plaza">{t("cancel")}</a>
        </Button>
      </div>
    </form>
  );
}
