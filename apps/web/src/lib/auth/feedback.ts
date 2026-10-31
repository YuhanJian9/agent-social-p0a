// Only allowlisted provider codes reach the URL. Never expose raw error text.
export function authFeedback(code?: string, status?: number) {
  if (code === "email_not_confirmed") return "unconfirmed";
  if (status === 429 || code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "rate_limited";
  if (code === "invalid_credentials") return "credentials";
  return "error";
}

export const authMessages: Record<string, string> = {
  verify: "请查收最新的验证邮件，在注册时使用的浏览器中打开确认链接，确认后再登录。/ Check your latest confirmation email. Open its link in the browser used to sign up, then sign in.",
  unconfirmed: "邮箱尚未验证。请先打开最新确认邮件中的链接，无需重复注册。/ Your email is not confirmed yet. Open the link in your latest confirmation email; you do not need to sign up again.",
  rate_limited: "请求过于频繁，请至少等一分钟再重试。请先检查收件箱和垃圾邮件，使用最新确认邮件。/ Too many requests. Wait at least a minute before retrying. Check your inbox and spam folder for the latest confirmation email.",
  credentials: "邮箱或密码不正确。/ Incorrect email or password.",
  error: "操作未完成，请检查输入或稍后重试。/ Unable to continue. Check your details or try again later.",
};
