"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Builds last N months as options, newest first. */
function buildOptions(count = 24) {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

const OPTIONS = buildOptions(24);

export function MonthPicker({ currentValue }: { currentValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(val: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("kpiMonth", val);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <Select value={currentValue} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-8 w-auto gap-1.5 border-dashed bg-secondary text-xs font-medium">
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue />
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </SelectTrigger>
      <SelectContent align="end">
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-sm">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
