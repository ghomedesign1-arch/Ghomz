"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Factory, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ShopifyOrderMeta,
  ShopifyOrderPriority,
  ShopifyOrderStatus,
  ShopifyOrderSummary,
} from "@/lib/shopify";

const STATUS_OPTS: { value: ShopifyOrderStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "IN_PRODUCTION", label: "In production" },
  { value: "READY", label: "Ready" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "CANCELLED", label: "Cancelled" },
];

const PRIORITY_OPTS: { value: ShopifyOrderPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "URGENT", label: "Urgent" },
];

const STATUS_TONE: Record<ShopifyOrderStatus, string> = {
  NEW: "bg-slate-100 text-slate-700 border-slate-200",
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-200",
  IN_PRODUCTION: "bg-amber-100 text-amber-800 border-amber-200",
  READY: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SHIPPED: "bg-emerald-600 text-white border-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
};

const PRIORITY_TONE: Record<ShopifyOrderPriority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  NORMAL: "bg-slate-200 text-slate-700",
  URGENT: "bg-rose-600 text-white",
};

export function ShopifyOrderRow({
  order,
  initialMeta,
  shopUrl,
  users,
}: {
  order: ShopifyOrderSummary;
  initialMeta: ShopifyOrderMeta;
  shopUrl: string;
  users: { id: string; name: string }[];
}) {
  const [meta, setMeta] = React.useState<ShopifyOrderMeta>(initialMeta);
  const [notesDraft, setNotesDraft] = React.useState(initialMeta.notes ?? "");
  const [showNotes, setShowNotes] = React.useState(
    Boolean(initialMeta.notes?.trim()),
  );
  const [saving, setSaving] = React.useState<string | null>(null);
  const [promoting, setPromoting] = React.useState(false);

  const customerName = (order.customer
    ? [order.customer.first_name, order.customer.last_name]
        .filter(Boolean)
        .join(" ")
    : ""
  ).trim();
  const customerDisplay =
    customerName || order.customer?.email || "Walk-in / guest";
  const date = new Date(order.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const totalItems = order.line_items.reduce((a, i) => a + i.quantity, 0);
  const isOverdue =
    meta.deliveryDate &&
    meta.status !== "SHIPPED" &&
    meta.status !== "CANCELLED" &&
    new Date(meta.deliveryDate) < new Date();

  async function save(patch: Partial<ShopifyOrderMeta>, key: string) {
    setSaving(key);
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Save failed");
        return;
      }
      const next: ShopifyOrderMeta = await res.json();
      setMeta(next);
    } finally {
      setSaving(null);
    }
  }

  async function promote() {
    setPromoting(true);
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promote: true }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Promote failed");
        return;
      }
      setMeta(payload);
      toast.success("Production run created");
    } finally {
      setPromoting(false);
    }
  }

  return (
    <Card
      className={
        meta.priority === "URGENT"
          ? "border-rose-300 shadow-rose-100"
          : isOverdue
            ? "border-amber-300"
            : undefined
      }
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
              <Link
                href={shopUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                {order.name}
                <ExternalLink className="h-3.5 w-3.5 opacity-50" />
              </Link>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[meta.status]}`}
              >
                {STATUS_OPTS.find((s) => s.value === meta.status)?.label}
              </span>
              {meta.priority === "URGENT" && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_TONE.URGENT}`}>
                  URGENT
                </span>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="text-[10px]">
                  Overdue
                </Badge>
              )}
              {meta.productionLogId && (
                <Badge variant="success" className="gap-1 text-[10px]">
                  <Factory className="h-3 w-3" /> In production
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {customerDisplay} · {date}
              {order.customer?.phone && ` · ${order.customer.phone}`}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-semibold">
              {Number(order.total_price).toLocaleString("en-EG", {
                maximumFractionDigits: 2,
              })}{" "}
              {order.currency}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalItems} item{totalItems === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {order.line_items.map((li) => (
            <div
              key={li.id}
              className="flex items-start justify-between gap-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{li.title}</div>
                {(li.variant_title || li.sku) && (
                  <div className="text-xs text-muted-foreground">
                    {[li.variant_title, li.sku].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right text-sm">
                <div>×{li.quantity}</div>
                <div className="text-xs text-muted-foreground">
                  {Number(li.price).toLocaleString("en-EG")} {order.currency}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ErpField label="Status">
            <Select
              value={meta.status}
              onValueChange={(v) =>
                save({ status: v as ShopifyOrderStatus }, "status")
              }
              disabled={saving === "status"}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ErpField>

          <ErpField label="Priority">
            <Select
              value={meta.priority}
              onValueChange={(v) =>
                save({ priority: v as ShopifyOrderPriority }, "priority")
              }
              disabled={saving === "priority"}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ErpField>

          <ErpField label="Delivery date">
            <Input
              type="date"
              className="h-9"
              value={meta.deliveryDate ? meta.deliveryDate.slice(0, 10) : ""}
              onChange={(e) =>
                save(
                  { deliveryDate: e.target.value ? e.target.value : null },
                  "deliveryDate",
                )
              }
              disabled={saving === "deliveryDate"}
            />
          </ErpField>

          <ErpField label="Assigned to">
            <Select
              value={meta.assignedToId ?? "__none__"}
              onValueChange={(v) =>
                save(
                  { assignedToId: v === "__none__" ? null : v },
                  "assignedToId",
                )
              }
              disabled={saving === "assignedToId"}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ErpField>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowNotes((s) => !s)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {showNotes ? "Hide notes" : meta.notes ? "Edit notes" : "+ Add notes"}
          </button>
          <Button
            size="sm"
            onClick={promote}
            disabled={promoting || Boolean(meta.productionLogId)}
            variant={meta.productionLogId ? "outline" : "default"}
          >
            {promoting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Promoting…
              </>
            ) : meta.productionLogId ? (
              <>
                <Factory className="h-3.5 w-3.5" /> Already in production
              </>
            ) : (
              <>
                <Factory className="h-3.5 w-3.5" /> Promote to production
              </>
            )}
          </Button>
        </div>

        {showNotes && (
          <div>
            <Textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={() => {
                if (notesDraft !== (meta.notes ?? "")) {
                  save({ notes: notesDraft.trim() || null }, "notes");
                }
              }}
              placeholder="Internal notes — only visible in the ERP"
              className="text-sm"
            />
            {saving === "notes" && (
              <div className="mt-1 text-xs text-muted-foreground">Saving…</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ErpField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
