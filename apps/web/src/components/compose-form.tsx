import { getTranslations } from "next-intl/server";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export async function ComposeForm({ errorMessage }: { errorMessage: string | null }) {
  const t = await getTranslations("compose");

  return (
    <form action="/api/posts" method="post" className="mt-4">
      <input type="hidden" name="next" value="/plaza/new" />
      <label htmlFor="body" className="text-sm font-medium">
        {t("body")}
      </label>
      <Textarea
        id="body"
        name="body"
        required
        maxLength={500}
        placeholder={t("placeholder")}
        className="mt-2"
      />
      <p className="mt-4 text-sm font-medium">{t("scope")}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{t("scopeHelp")}</p>
      <FormError message={errorMessage} />
      <div className="mt-6 flex gap-3">
        <Button type="submit">{t("publish")}</Button>
        <Button asChild variant="outline">
          <a href="/plaza">{t("cancel")}</a>
        </Button>
      </div>
    </form>
  );
}
