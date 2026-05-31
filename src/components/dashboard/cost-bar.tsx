"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatLE } from "@/lib/costing";

interface CostBarProps {
  segments: { label: string; amount: number; color: string }[];
  total: number;
}

export function CostBar({ segments, total }: CostBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
        {segments.map((seg, i) => (
          <motion.div
            key={seg.label}
            initial={{ width: 0 }}
            animate={{
              width: `${total > 0 ? (seg.amount / total) * 100 : 0}%`,
            }}
            transition={{
              duration: 0.6,
              delay: i * 0.05,
              ease: "easeOut",
            }}
            style={{ background: seg.color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {segments.map((seg) => (
          <div key={seg.label} className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: seg.color }}
            />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="tabular-nums font-medium">
              {formatLE(seg.amount)}
            </span>
            <span className={cn("tabular-nums text-muted-foreground")}>
              ({total > 0 ? ((seg.amount / total) * 100).toFixed(1) : "0"}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
