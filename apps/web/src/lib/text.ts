export function excerpt(text: string, max = 72) {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= max) return line;
  return `${line.slice(0, max)}…`;
}

export function formatWhen(ms: number, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en" : "zh-Hans", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}
