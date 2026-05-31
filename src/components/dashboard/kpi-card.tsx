"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  /** Pre-rendered icon JSX — functions can't cross the server/client boundary. */
  icon?: React.ReactNode;
  index?: number;
  /** Colour the value text based on health */
  highlight?: "green" | "amber" | "red";
}

export function KpiCard({
  label,
  value,
  delta,
  hint,
  icon,
  index = 0,
  highlight,
}: KpiCardProps) {
  const valueColor =
    highlight === "green" ? "#16a34a"
    : highlight === "amber" ? "#d97706"
    : highlight === "red"   ? "#dc2626"
    : undefined;
  const positive = delta !== undefined && delta >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: "easeOut" }}
    >
      <Card className="gradient-card relative overflow-hidden p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div
              className="font-display text-3xl font-semibold tracking-tight"
              style={valueColor ? { color: valueColor } : undefined}
            >
              {value}
            </div>
            {hint && (
              <div className="text-xs text-muted-foreground">{hint}</div>
            )}
          </div>
          {icon && (
            <div className="rounded-xl bg-secondary p-2.5 text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
        {delta !== undefined && (
          <div
            className={cn(
              "mt-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              positive
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {Math.abs(delta).toFixed(1)}%
            <span className="text-muted-foreground/80 ml-1">
              vs last month
            </span>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
