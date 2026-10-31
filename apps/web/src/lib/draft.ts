import type { Locale } from "@/i18n/locale";

function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max)}…`;
}

/** Stub draft only. Not a model completion and not owner memory. */
export function buildSummaryDraft(
  postBody: string,
  question: string,
  locale: Locale,
) {
  const excerpt = clip(postBody, 160);
  const asked = clip(question, 120);
  if (locale === "en") {
    return `Short reply (edit before sending): About the public post “${excerpt}”. They asked: ${asked}`;
  }
  return `短答复（发送前可改）：关于这条公开动态「${excerpt}」。对方问：${asked}`;
}
