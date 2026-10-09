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
              {fmt(order.total_price)} {order.currency}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalItems} item{totalItems === 1 ? "" : "s"}
            </div>
            <PaymentBadge order={order} />
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
                {li.variant_title && (
                  <div className="text-xs text-foreground/80">
                    {li.variant_title}
                  </div>
                )}
                {li.sku && (
                  <div className="text-[11px] text-muted-foreground">
                    SKU: {li.sku}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right text-sm">
                <div>×{li.quantity}</div>
                <div className="text-xs text-muted-foreground">
                  {fmt(li.price)} {order.currency}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PaymentBreakdown order={order} />
          <AddressBlock
            address={order.shipping_address ?? order.billing_address}
            fallbackPhone={order.customer?.phone ?? null}
          />
        </div>

        {order.note && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
            <div className="font-medium text-amber-900">Customer note</div>
            <div className="whitespace-pre-wrap text-amber-800">
              {order.note}
            </div>
          </div>
        )}

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

function fmt(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-EG", { maximumFractionDigits: 2 });
}

function PaymentBadge({ order }: { order: ShopifyOrderSummary }) {
  const kind = paymentKind(order);
  const label =
    kind === "paid"
      ? "Fully paid"
      : kind === "deposit"
        ? "Deposit"
        : kind === "refunded"
          ? "Refunded"
          : "Unpaid";
  const tone =
    kind === "paid"
      ? "bg-emerald-100 text-emerald-700"
      : kind === "deposit"
        ? "bg-amber-100 text-amber-800"
        : kind === "refunded"
          ? "bg-slate-200 text-slate-700"
          : "bg-rose-100 text-rose-700";
  return (
    <span
      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function paymentKind(
  order: ShopifyOrderSummary,
): "paid" | "deposit" | "unpaid" | "refunded" {
  const status = (order.financial_status ?? "").toLowerCase();
  if (status === "refunded" || status === "voided") return "refunded";
  const total = Number(order.total_price ?? 0);
  const outstanding = Number(order.total_outstanding ?? 0);
  const paid = total - outstanding;
  if (outstanding <= 0.009) return "paid";
  if (paid > 0.009) return "deposit";
  return "unpaid";
}

function PaymentBreakdown({ order }: { order: ShopifyOrderSummary }) {
  const total = Number(order.total_price ?? 0);
  const outstanding = Number(order.total_outstanding ?? 0);
  const paid = Math.max(0, total - outstanding);
  const subtotal = Number(order.subtotal_price ?? 0);
  const discount = Number(order.total_discounts ?? 0);
  const tax = Number(order.total_tax ?? 0);
  const shipping = Math.max(0, total - subtotal - tax + discount);
  const kind = paymentKind(order);

  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Payment</span>
        <span>{order.currency}</span>
      </div>
      <Row label="Subtotal" value={fmt(subtotal)} />
      {discount > 0 && <Row label="Discount" value={`− ${fmt(discount)}`} />}
      {shipping > 0 && <Row label="Shipping" value={fmt(shipping)} />}
      {tax > 0 && <Row label="Tax" value={fmt(tax)} />}
      <Row label="Total" value={fmt(total)} bold />
      <div className="my-2 border-t border-border" />
      {kind === "paid" ? (
        <Row label="Paid" value={fmt(paid)} tone="success" bold />
      ) : kind === "deposit" ? (
        <>
          <Row label="Deposit paid" value={fmt(paid)} tone="success" bold />
          <Row label="Remaining" value={fmt(outstanding)} tone="warning" bold />
        </>
      ) : kind === "unpaid" ? (
        <Row label="Outstanding" value={fmt(total)} tone="danger" bold />
      ) : (
        <Row label="Refunded" value={fmt(paid)} tone="muted" />
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "success" | "warning" | "danger" | "muted";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-800"
        : tone === "danger"
          ? "text-rose-700"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-foreground";
  return (
    <div
      className={`flex items-center justify-between ${bold ? "font-semibold" : ""} ${toneCls}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function AddressBlock({
  address,
  fallbackPhone,
}: {
  address: ShopifyOrderSummary["shipping_address"] | null;
  fallbackPhone: string | null;
}) {
  if (!address) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        No shipping address on file
      </div>
    );
  }
  const lines = [
    address.name,
    address.company,
    address.address1,
    address.address2,
    [address.city, address.province, address.zip].filter(Boolean).join(" "),
    address.country,
  ].filter((s) => s && String(s).trim());
  const phone = address.phone ?? fallbackPhone;
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Shipping address
      </div>
      <div className="space-y-0.5">
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {phone && <div className="mt-1 text-muted-foreground">📞 {phone}</div>}
      </div>
    </div>
  );
}
