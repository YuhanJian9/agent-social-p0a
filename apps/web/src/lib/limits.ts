export const LIMITS = {
  postMax: 4,
  postWindowMs: 10 * 60 * 1000,
  inquiryMax: 4,
  inquiryWindowMs: 10 * 60 * 1000,
  rejectCooldownMs: 60 * 1000,
  postMaxLength: 500,
  questionMaxLength: 280,
  summaryMaxLength: 500,
} as const;

export const TOKEN_SCOPES = [
  "plaza.post",
  "plaza.read",
  "inquiry.create",
  "inquiry.read",
  "transfer.read",
] as const;
