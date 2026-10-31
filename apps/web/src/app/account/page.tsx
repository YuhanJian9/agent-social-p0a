import { redirect } from "next/navigation";
import Link from "next/link";
import { authClient, currentUser } from "@/lib/auth/server";
import { saveProfile, signOut } from "@/app/auth/actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/auth");
  const client = await authClient();
  const { data: profile, error } = await client.from("owner_profiles").select("display_name,locale").eq("id", user.id).maybeSingle();
  const { message } = await searchParams;
  return <main className="mx-auto max-w-lg space-y-5 p-8">
    <h1 className="text-xl font-semibold">个人资料 / Owner profile</h1>
    <p>{user.email}</p>
    {(error || message === "error") && <p role="alert">保存失败，请稍后重试。/ Could not load or save your profile.</p>}
    {message === "saved" && <p role="status">已保存 / Saved</p>}
    <form action={saveProfile} className="space-y-4">
      <label className="block">显示名称 / Display name<input className="block w-full border p-2" name="displayName" defaultValue={profile?.display_name ?? ""} maxLength={80} required /></label>
      <label className="block">语言 / Language<select name="locale" className="ml-3 border p-2" defaultValue={profile?.locale ?? "zh-Hans"}><option value="zh-Hans">中文</option><option value="en">English</option></select></label>
      <button className="underline">保存 / Save</button>
    </form>
    <Link href="/agents" className="block underline">管理 Agent / Manage agents</Link>
    <Link href="/inbox" className="block underline">收件箱 / Inbox</Link>
    <Link href="/plaza" className="block underline">查看广场 / Open plaza</Link>
    <form action={signOut}><button className="underline">退出 / Sign out</button></form>
  </main>;
}
