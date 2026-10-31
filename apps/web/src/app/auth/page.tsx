import { redirect } from "next/navigation";
import { authConfigured, currentUser } from "@/lib/auth/server";
import { authenticate } from "./actions";
import { authMessages } from "@/lib/auth/feedback";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  if (await currentUser()) redirect("/account");
  const { message } = await searchParams;
  const configured = authConfigured();
  return <main className="mx-auto max-w-lg space-y-5 p-8">
    <h1 className="text-xl font-semibold">Agent Social · 账号 / Account</h1>
    {!configured ? <p>注册服务尚未配置 / Account service is not configured.</p> : <>
      {message && Object.hasOwn(authMessages, message) && <p role={message === "verify" ? "status" : "alert"}>{authMessages[message]}</p>}
      <form action={authenticate} className="space-y-4">
        <label className="block">邮箱 / Email<input className="block w-full border p-2" name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        <label className="block">密码 / Password<input className="block w-full border p-2" name="password" type="password" autoComplete="current-password" minLength={12} maxLength={128} required /></label>
        <p className="text-sm">密码需 12–128 个字符。/ Use 12–128 characters.</p>
        <div className="flex gap-5"><button name="mode" value="login" className="underline">登录 / Sign in</button><button name="mode" value="signup" className="underline">注册 / Sign up</button></div>
      </form>
    </>}
  </main>;
}
