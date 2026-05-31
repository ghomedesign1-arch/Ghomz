"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

const RANGES = [
  { label: "3M",  value: 3 },
  { label: "6M",  value: 6 },
  { label: "12M", value: 12 },
  { label: "24M", value: 24 },
] as const;

export function RangePicker({ current }: { current: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function pick(months: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("months", String(months));
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => pick(r.value)}
          disabled={pending}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            current === r.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
