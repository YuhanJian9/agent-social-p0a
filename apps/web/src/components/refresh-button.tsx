"use client";

import { useRouter } from "next/navigation";

export function RefreshButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="text-sm text-muted underline-offset-4 hover:underline"
    >
      {label}
    </button>
  );
}
