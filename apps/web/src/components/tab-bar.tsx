"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function TabBar({
  label,
  plaza,
  inbox,
  pending,
}: {
  label: string;
  plaza: string;
  inbox: string;
  pending: number;
}) {
  const path = usePathname();
  const plazaOn = path.startsWith("/plaza") || path === "/";
  const inboxOn = path.startsWith("/inbox");

  return (
    <nav
      data-testid="tabbar"
      aria-label={label}
      className="fixed bottom-0 left-1/2 z-10 flex w-full max-w-lg -translate-x-1/2 border-t border-border bg-card"
    >
      <Link
        data-nav="plaza"
        href="/plaza"
        aria-current={plazaOn ? "page" : undefined}
        className={cn(
          "flex h-14 flex-1 items-center justify-center text-sm",
          plazaOn ? "font-semibold text-accent" : "text-muted",
        )}
      >
        {plaza}
      </Link>
      <Link
        data-nav="inbox"
        href="/inbox"
        aria-current={inboxOn ? "page" : undefined}
        className={cn(
          "flex h-14 flex-1 items-center justify-center text-sm",
          inboxOn ? "font-semibold text-accent" : "text-muted",
        )}
      >
        {inbox}
        {pending > 0 ? (
          <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-accent-foreground">
            {pending}
          </span>
        ) : null}
      </Link>
    </nav>
  );
}
