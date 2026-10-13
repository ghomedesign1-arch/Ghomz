"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Factory,
  FileDown,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
  X,
} from "lucide-react";
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
import {
  DEFAULT_LEAD_TIME_DAYS,
  DUE_SOON_WINDOW_DAYS,
  MAX_CALL_ATTEMPTS,
  effectiveDeliveryDate,
  effectiveLineItems,
  effectiveSubtotal,
  todayIsoDate,
  tomorrowIsoDate,
  type CallOutcome,
  type EffectiveLineItem,
  type ShopifyOrderMeta,
  type ShopifyOrderPriority,
  type ShopifyOrderStatus,
  type ShopifyOrderSummary,
  type ShopifyPaymentMode,
} from "@/lib/shopify";
import { LineItemEditDialog } from "@/components/shopify/line-item-edit-dialog";

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
  const [expanded, setExpanded] = React.useState(false);

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
  const effectiveLines = effectiveLineItems(order, meta);
  const activeLineItems = effectiveLines.filter((li) => li.quantity > 0);
  const totalItems = activeLineItems.reduce((a, i) => a + i.quantity, 0);
  // Prefer sum of (overridden) line totals so edits flow through; fall back to
  // Shopify's current total when no overrides touch things.
  const hasOverrides = effectiveLines.some((li) => li.isCustom);
  const shopifyTotal = currentAmount(order.current_total_price, order.total_price);
  const rawTotal = hasOverrides
    ? effectiveSubtotal(activeLineItems) +
      (shopifyTotal -
        currentAmount(order.current_subtotal_price, order.subtotal_price))
    : shopifyTotal;
  const erpDiscount = Math.max(0, Number(meta.discount ?? 0));
  const currentTotal = Math.max(0, rawTotal - erpDiscount);
  const isTerminal = meta.status === "SHIPPED" || meta.status === "CANCELLED";
  const dueDate = effectiveDeliveryDate(order.created_at, meta);
  const daysToDue = Math.ceil(
    (dueDate.getTime() - Date.now()) / 86_400_000,
  );
  const isOverdue = !isTerminal && daysToDue < 0;
  const isDueSoon =
    !isTerminal && daysToDue >= 0 && daysToDue <= DUE_SOON_WINDOW_DAYS;
  const dueDateIso = dueDate.toISOString().slice(0, 10);

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

  function buildConfirmationMessage(): string {
    const name =
      [order.customer?.first_name, order.customer?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "there";
    const items = order.line_items
      .filter((li) => effectiveQty(li) > 0)
      .map(
        (li) =>
          `• ${effectiveQty(li)}× ${li.title}${li.variant_title ? ` (${li.variant_title})` : ""}`,
      )
      .join("\n");
    const total = fmt(currentAmount(order.current_total_price, order.total_price));
    const due = effectiveDeliveryDate(order.created_at, meta).toLocaleDateString(
      "en-GB",
      { day: "numeric", month: "short", year: "numeric" },
    );
    return `Hi ${name}! 👋\n\nThis is G-Homz confirming your order ${order.name}:\n\n${items}\n\n*Total:* ${total} ${order.currency}\n*Expected delivery:* by ${due}\n\nWe'll keep you updated as your bed moves through production. Thank you for choosing G-Homz! 🛏️`;
  }

  async function sendCancellation() {
    const phone =
      order.customer?.phone ?? order.shipping_address?.phone ?? null;
    const wa = whatsAppLink(phone);
    if (!wa) {
      toast.error("No phone number on this order");
      return;
    }
    const name =
      [order.customer?.first_name, order.customer?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "there";
    const message =
`Hi ${name},

We've tried to reach you several times about your G-Homz order ${order.name} to confirm the 50% deposit needed before we can begin production, but unfortunately we haven't heard back from you.

Since we haven't received the deposit, we won't be able to proceed with your order at the factory and your order will be *cancelled*.

If you'd still like to go ahead, please reply within the next 24 hours and we'll be happy to reopen it. Otherwise, no further action is needed from your side.

Thank you for your interest in G-Homz — we hope to serve you in the future! 🛏️`;
    window.open(
      `${wa}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setSaving("cancelSent");
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markCancellationSent: true }),
      });
      if (res.ok) {
        const next = await res.json();
        setMeta(next);
        toast.success("Cancellation notice ready in WhatsApp — tap send");
      }
    } finally {
      setSaving(null);
    }
  }

  async function sendDepositRequest() {
    const phone =
      order.customer?.phone ?? order.shipping_address?.phone ?? null;
    const wa = whatsAppLink(phone);
    if (!wa) {
      toast.error("No phone number on this order");
      return;
    }
    const name =
      [order.customer?.first_name, order.customer?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "there";
    const half = Math.round(currentTotal / 2);
    const total = fmt(currentTotal);
    const message =
`Hi ${name}! ✨

Thank you for choosing G-Homz for your order ${order.name} — we can't wait to craft it for you! 🛏️

Each G-Homz piece is custom-made just for you, so to reserve your spot in our workshop and lock in your materials we kindly ask for a *50% deposit of ${fmt(half)} ${order.currency}* (half of your ${total} ${order.currency} total).

Why a deposit? It lets our team begin production without delay — once we receive it, your order is officially *in production* and your delivery timeline begins. The remaining 50% is due on delivery. 🚚

Reply here as soon as you've sent it and we'll fire up the workshop! 🪚✨`;
    window.open(
      `${wa}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setSaving("depositSent");
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markDepositRequestSent: true }),
      });
      if (res.ok) {
        const next = await res.json();
        setMeta(next);
        toast.success("Deposit request ready in WhatsApp — tap send");
      }
    } finally {
      setSaving(null);
    }
  }

  async function sendDeliveryDate() {
    const phone =
      order.customer?.phone ?? order.shipping_address?.phone ?? null;
    const wa = whatsAppLink(phone);
    if (!wa) {
      toast.error("No phone number on this order");
      return;
    }
    const name =
      [order.customer?.first_name, order.customer?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "there";
    const dateStr = dueDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const message = `Hi ${name}! 👋\n\nGood news — your G-Homz order ${order.name} is scheduled for delivery on *${dateStr}*.\n\nIf this date doesn't suit you, please let us know — or suggest a day that works better and we'll do our best to make it happen. Thank you for choosing G-Homz! 🛏️`;
    window.open(
      `${wa}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setSaving("deliverySent");
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markDeliveryDateSent: true }),
      });
      if (res.ok) {
        const next = await res.json();
        setMeta(next);
        toast.success("Delivery message ready in WhatsApp — tap send");
      }
    } finally {
      setSaving(null);
    }
  }

  async function sendInvoiceOnWhatsApp() {
    const phone =
      order.customer?.phone ?? order.shipping_address?.phone ?? null;
    const wa = whatsAppLink(phone);
    if (!wa) {
      toast.error("No phone number on this order");
      return;
    }
    // Open the tab synchronously so the popup blocker treats it as a direct
    // user gesture; we'll point it at WhatsApp once the PDF upload returns.
    const win = window.open("about:blank", "_blank");
    setSaving("invoiceShare");
    try {
      const res = await fetch(
        `/api/shopify/orders/${order.id}/invoice/share`,
        { method: "POST" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Invoice upload failed");
        try {
          win?.close();
        } catch {
          /* ignore */
        }
        return;
      }
      const name =
        [order.customer?.first_name, order.customer?.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || "there";
      const total = fmt(currentTotal);
      const message = `Hi ${name}! 👋\n\nHere's your G-Homz invoice ${order.name}:\n${payload.url}\n\n*Total:* ${total} ${order.currency}\n\nPlease let us know if anything needs changing. Thank you! 🛏️`;
      const link = `${wa}?text=${encodeURIComponent(message)}`;
      if (win && !win.closed) {
        win.location.href = link;
      } else {
        window.open(link, "_blank", "noopener,noreferrer");
      }
      toast.success("Invoice ready in WhatsApp — tap send");
    } finally {
      setSaving(null);
    }
  }

  async function sendConfirmation() {
    const phone =
      order.customer?.phone ?? order.shipping_address?.phone ?? null;
    const wa = whatsAppLink(phone);
    if (!wa) {
      toast.error("No phone number on this order");
      return;
    }
    const message = encodeURIComponent(buildConfirmationMessage());
    window.open(`${wa}?text=${message}`, "_blank", "noopener,noreferrer");
    // Mark as sent in the ERP (the user still has to tap Send inside WhatsApp,
    // but opening the pre-filled chat is the explicit intent).
    setSaving("confirmation");
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markConfirmationSent: true }),
      });
      if (res.ok) {
        const next = await res.json();
        setMeta(next);
        toast.success("Confirmation message ready in WhatsApp — tap send");
      }
    } finally {
      setSaving(null);
    }
  }

  async function uploadReceipt(file: File) {
    setSaving("receipt");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/shopify/orders/${order.id}/receipts`,
        { method: "POST", body: fd },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Upload failed");
        return;
      }
      setMeta(payload);
      toast.success("Receipt attached");
    } finally {
      setSaving(null);
    }
  }

  async function deleteReceipt(url: string) {
    setSaving("receipt");
    try {
      const res = await fetch(
        `/api/shopify/orders/${order.id}/receipts?url=${encodeURIComponent(url)}`,
        { method: "DELETE" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Delete failed");
        return;
      }
      setMeta(payload);
    } finally {
      setSaving(null);
    }
  }

  async function callOp(
    body: { logCallAttempt?: CallOutcome; resetCallAttempts?: true },
    key: string,
  ) {
    setSaving(key);
    try {
      const res = await fetch(`/api/shopify/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload.error ?? "Save failed");
        return;
      }
      setMeta(payload);
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
                  Overdue by {Math.abs(daysToDue)}d
                </Badge>
              )}
              {isDueSoon && (
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  {daysToDue === 0
                    ? "Due today"
                    : `Due in ${daysToDue}d`}
                </span>
              )}
              {meta.productionLogId && (
                <Badge variant="success" className="gap-1 text-[10px]">
                  <Factory className="h-3 w-3" /> In production
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {customerDisplay} · Ordered {date}
              </span>
              {(() => {
                const phone =
                  order.customer?.phone ?? order.shipping_address?.phone ?? null;
                if (!phone) return null;
                const waLink = whatsAppLink(phone);
                return (
                  <span className="inline-flex items-center gap-1">
                    <span>· {phone}</span>
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-200"
                        aria-label="Open WhatsApp chat"
                      >
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    )}
                  </span>
                );
              })()}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium ${
                  isOverdue
                    ? "border-rose-300 bg-rose-50 text-rose-800"
                    : isDueSoon
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-border bg-secondary/40 text-foreground"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Deliver by{" "}
                {dueDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {!meta.deliveryDate && (
                  <span className="text-[10px] opacity-70">(auto)</span>
                )}
              </span>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById(`due-date-${order.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Change
              </button>
              {(() => {
                const today = todayIsoDate();
                const tomorrow = tomorrowIsoDate();
                const onToday = meta.scheduledFor === today;
                const onTomorrow = meta.scheduledFor === tomorrow;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        save(
                          { scheduledFor: onToday ? null : today },
                          "scheduledFor",
                        )
                      }
                      disabled={saving === "scheduledFor"}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        onToday
                          ? "bg-amber-200 text-amber-900 hover:bg-amber-300"
                          : "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      } disabled:opacity-50`}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {onToday ? "On today's list" : "+ Today"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        save(
                          { scheduledFor: onTomorrow ? null : tomorrow },
                          "scheduledFor",
                        )
                      }
                      disabled={saving === "scheduledFor"}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        onTomorrow
                          ? "bg-amber-200 text-amber-900 hover:bg-amber-300"
                          : "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      } disabled:opacity-50`}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {onTomorrow ? "On tomorrow's list" : "+ Tomorrow"}
                    </button>
                  </>
                );
              })()}
              <a
                href={`/api/shopify/orders/${order.id}/invoice`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                title="Open invoice PDF in a new tab"
              >
                <FileDown className="h-3 w-3" />
                Invoice PDF
              </a>
              {(order.customer?.phone || order.shipping_address?.phone) && (
                <button
                  type="button"
                  onClick={sendInvoiceOnWhatsApp}
                  disabled={saving === "invoiceShare"}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  title="Upload invoice and open WhatsApp with the link"
                >
                  {saving === "invoiceShare" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Invoice → WhatsApp
                </button>
              )}
              {(() => {
                const phone =
                  order.customer?.phone ??
                  order.shipping_address?.phone ??
                  null;
                if (!phone) return null;
                if (meta.confirmationSentAt) {
                  return (
                    <button
                      type="button"
                      onClick={sendConfirmation}
                      disabled={saving === "confirmation"}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-200"
                      title={`Sent ${new Date(meta.confirmationSentAt).toLocaleDateString("en-GB")}`}
                    >
                      <Check className="h-3 w-3" />
                      Confirmed · resend
                    </button>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={sendConfirmation}
                    disabled={saving === "confirmation"}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    <Send className="h-3 w-3" />
                    Send confirmation
                  </button>
                );
              })()}
              {(order.customer?.phone || order.shipping_address?.phone) && (
                <button
                  type="button"
                  onClick={sendDepositRequest}
                  disabled={saving === "depositSent"}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                    meta.depositRequestSentAt
                      ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      : "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  }`}
                  title={
                    meta.depositRequestSentAt
                      ? `Sent ${new Date(meta.depositRequestSentAt).toLocaleDateString("en-GB")}`
                      : "Send 50% deposit request via WhatsApp"
                  }
                >
                  {meta.depositRequestSentAt ? (
                    <>
                      <Check className="h-3 w-3" /> Deposit asked · resend
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3" /> Ask for 50% deposit
                    </>
                  )}
                </button>
              )}
              {(order.customer?.phone || order.shipping_address?.phone) && (
                <button
                  type="button"
                  onClick={sendCancellation}
                  disabled={saving === "cancelSent"}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                    meta.cancellationSentAt
                      ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                      : "border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
                  title={
                    meta.cancellationSentAt
                      ? `Sent ${new Date(meta.cancellationSentAt).toLocaleDateString("en-GB")}`
                      : "Send cancellation notice via WhatsApp"
                  }
                >
                  {meta.cancellationSentAt ? (
                    <>
                      <Check className="h-3 w-3" /> Cancellation sent · resend
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3" /> Send cancellation
                    </>
                  )}
                </button>
              )}
              {(order.customer?.phone || order.shipping_address?.phone) && (
                <button
                  type="button"
                  onClick={sendDeliveryDate}
                  disabled={saving === "deliverySent"}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                    meta.deliveryDateSentAt
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                  title={
                    meta.deliveryDateSentAt
                      ? `Sent ${new Date(meta.deliveryDateSentAt).toLocaleDateString("en-GB")}`
                      : "Send delivery date via WhatsApp"
                  }
                >
                  {meta.deliveryDateSentAt ? (
                    <>
                      <Check className="h-3 w-3" /> Delivery date sent · resend
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3" /> Send delivery date
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="text-right">
              <div className="font-display text-lg font-semibold">
                {fmt(currentTotal)} {order.currency}
              </div>
              <div className="text-xs text-muted-foreground">
                {totalItems} item{totalItems === 1 ? "" : "s"}
              </div>
              <PaymentBadge order={order} meta={meta} />
            </div>
            <button
              type="button"
              onClick={() => setExpanded((s) => !s)}
              aria-label={expanded ? "Collapse details" : "Expand details"}
              className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-secondary"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {meta.notes && meta.notes.trim() && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Note
            </div>
            <div className="mt-0.5 whitespace-pre-wrap text-amber-900">
              {meta.notes}
            </div>
          </div>
        )}

        <div className="divide-y divide-border border-y border-border">
          {activeLineItems.map((li) => (
            <div
              key={li.id}
              className="flex items-start justify-between gap-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-medium">{li.title}</div>
                  {li.isCustom && (
                    <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                      Custom
                    </span>
                  )}
                </div>
                {li.variantTitle && (
                  <div className="text-xs text-foreground/80">
                    {li.variantTitle}
                  </div>
                )}
                {li.sku && (
                  <div className="text-[11px] text-muted-foreground">
                    SKU: {li.sku}
                  </div>
                )}
                {li.isCustom && (
                  <div className="mt-1 text-[11px] italic text-muted-foreground">
                    was {li.original.title}
                    {li.original.variantTitle
                      ? ` · ${li.original.variantTitle}`
                      : ""}{" "}
                    · {li.original.quantity} × {fmt(li.original.unitPrice)}{" "}
                    {order.currency}
                  </div>
                )}
                {li.note && (
                  <div className="mt-1 text-[11px] text-amber-800">
                    Note: {li.note}
                  </div>
                )}
                <div className="mt-1">
                  <LineItemEditDialog
                    orderId={order.id}
                    item={li}
                    currency={order.currency}
                    onSaved={(next) => setMeta(next)}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right text-sm">
                <div>×{li.quantity}</div>
                <div className="text-xs text-muted-foreground">
                  {fmt(li.unitPrice)} {order.currency}
                </div>
                {li.isCustom && (
                  <div className="text-[10px] text-muted-foreground">
                    = {fmt(li.lineTotal)} {order.currency}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {expanded && (
          <>
        <div className="grid gap-3 md:grid-cols-2">
          <PaymentBreakdown
            order={order}
            meta={meta}
            saving={saving}
            onSave={save}
            onCallOp={callOp}
            onUploadReceipt={uploadReceipt}
            onDeleteReceipt={deleteReceipt}
          />
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
              id={`due-date-${order.id}`}
              type="date"
              className="h-9"
              value={meta.deliveryDate ? meta.deliveryDate.slice(0, 10) : dueDateIso}
              onChange={(e) =>
                save(
                  { deliveryDate: e.target.value ? e.target.value : null },
                  "deliveryDate",
                )
              }
              disabled={saving === "deliveryDate"}
            />
            {!meta.deliveryDate && (
              <div className="text-[10px] text-muted-foreground">
                Auto (order date + {DEFAULT_LEAD_TIME_DAYS}d)
              </div>
            )}
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
          </>
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

function whatsAppLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Keep only digits; drop leading zeros. If the number looks local (10 digits
  // starting with 1 or 0 — common for Egyptian mobiles like 010/011/012/015)
  // prefix the Egyptian country code 20.
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = "20" + digits.slice(1);
  else if (digits.length === 10 && (digits.startsWith("1") || digits.startsWith("2"))) {
    digits = "20" + digits;
  }
  return `https://wa.me/${digits}`;
}

function effectiveQty(li: {
  quantity: number;
  current_quantity?: number | null;
}): number {
  // Shopify leaves refunded/removed line items in the payload with
  // `current_quantity` set to the still-active quantity (0 when removed).
  if (li.current_quantity != null) return Math.max(0, li.current_quantity);
  return Math.max(0, li.quantity ?? 0);
}

function currentAmount(
  current: string | number | null | undefined,
  original: string | number | null | undefined,
): number {
  const c = current == null || current === "" ? NaN : Number(current);
  if (Number.isFinite(c)) return c;
  const o = Number(original ?? 0);
  return Number.isFinite(o) ? o : 0;
}

function fmt(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-EG", { maximumFractionDigits: 2 });
}

function PaymentBadge({
  order,
  meta,
}: {
  order: ShopifyOrderSummary;
  meta: ShopifyOrderMeta;
}) {
  const { kind } = resolvePayment(order, meta);
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

function resolvePayment(
  order: ShopifyOrderSummary,
  meta: ShopifyOrderMeta,
): { kind: "paid" | "deposit" | "unpaid" | "refunded"; paid: number; remaining: number } {
  const raw = currentAmount(order.current_total_price, order.total_price);
  const discount = Math.max(0, Number(meta.discount ?? 0));
  const total = Math.max(0, raw - discount);
  const status = (order.financial_status ?? "").toLowerCase();
  if (meta.paymentMode === "FULL") {
    return { kind: "paid", paid: total, remaining: 0 };
  }
  if (meta.paymentMode === "DEPOSIT") {
    const deposit = Math.max(0, Number(meta.depositAmount ?? 0));
    const remaining = Math.max(0, total - deposit);
    if (remaining <= 0.009) return { kind: "paid", paid: total, remaining: 0 };
    if (deposit > 0.009) return { kind: "deposit", paid: deposit, remaining };
    return { kind: "unpaid", paid: 0, remaining: total };
  }
  // AUTO — follow Shopify's financial state (payments Shopify recorded, then
  // the ERP discount reduces what is still owed).
  if (status === "refunded" || status === "voided") {
    const paid = Math.max(0, raw - Number(order.total_outstanding ?? 0));
    return { kind: "refunded", paid, remaining: 0 };
  }
  const paidFromShopify = Math.max(
    0,
    raw - Number(order.total_outstanding ?? 0),
  );
  const stillOwed = Math.max(0, total - paidFromShopify);
  if (stillOwed <= 0.009) return { kind: "paid", paid: total, remaining: 0 };
  if (paidFromShopify > 0.009)
    return { kind: "deposit", paid: paidFromShopify, remaining: stillOwed };
  return { kind: "unpaid", paid: 0, remaining: total };
}

function PaymentBreakdown({
  order,
  meta,
  saving,
  onSave,
  onCallOp,
  onUploadReceipt,
  onDeleteReceipt,
}: {
  order: ShopifyOrderSummary;
  meta: ShopifyOrderMeta;
  saving: string | null;
  onSave: (patch: Partial<ShopifyOrderMeta>, key: string) => void;
  onCallOp: (
    body: { logCallAttempt?: CallOutcome; resetCallAttempts?: true },
    key: string,
  ) => void;
  onUploadReceipt: (file: File) => void;
  onDeleteReceipt: (url: string) => void;
}) {
  const [depositDraft, setDepositDraft] = React.useState<string>(
    meta.depositAmount != null ? String(meta.depositAmount) : "",
  );
  React.useEffect(() => {
    setDepositDraft(meta.depositAmount != null ? String(meta.depositAmount) : "");
  }, [meta.depositAmount]);

  const rawTotal = currentAmount(order.current_total_price, order.total_price);
  const erpDiscount = Math.max(0, Number(meta.discount ?? 0));
  const total = Math.max(0, rawTotal - erpDiscount);
  const subtotal = currentAmount(order.current_subtotal_price, order.subtotal_price);
  const shopifyDiscount = currentAmount(order.current_total_discounts, order.total_discounts);
  const tax = currentAmount(order.current_total_tax, order.total_tax);
  const shipping = Math.max(0, rawTotal - subtotal - tax + shopifyDiscount);
  const { kind, paid, remaining } = resolvePayment(order, meta);

  const [discountDraft, setDiscountDraft] = React.useState<string>(
    meta.discount != null ? String(meta.discount) : "",
  );
  React.useEffect(() => {
    setDiscountDraft(meta.discount != null ? String(meta.discount) : "");
  }, [meta.discount]);

  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-3 text-sm">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Payment</span>
        <span>{order.currency}</span>
      </div>
      <div>
        <Row label="Subtotal" value={fmt(subtotal)} />
        {shopifyDiscount > 0 && (
          <Row label="Discount (Shopify)" value={`− ${fmt(shopifyDiscount)}`} />
        )}
        {shipping > 0 && <Row label="Shipping" value={fmt(shipping)} />}
        {tax > 0 && <Row label="Tax" value={fmt(tax)} />}
        <Row label="Order total" value={fmt(rawTotal)} />
        {erpDiscount > 0 && (
          <Row
            label="ERP discount"
            value={`− ${fmt(erpDiscount)}`}
            tone="warning"
          />
        )}
        <Row label="Total due" value={fmt(total)} bold />
      </div>

      <div className="rounded-md border border-border bg-background p-2">
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          ERP discount ({order.currency})
        </label>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          className="h-8 text-xs"
          value={discountDraft}
          onChange={(e) => setDiscountDraft(e.target.value)}
          onBlur={() => {
            const num = discountDraft === "" ? null : Number(discountDraft);
            if (num !== meta.discount) {
              onSave({ discount: num }, "discount");
            }
          }}
          disabled={saving === "discount"}
          placeholder="0"
        />
      </div>

      <div className="space-y-2 rounded-md border border-border bg-background p-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Payment mode
          </label>
          <Select
            value={meta.paymentMode}
            onValueChange={(v) =>
              onSave({ paymentMode: v as ShopifyPaymentMode }, "paymentMode")
            }
            disabled={saving === "paymentMode"}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AUTO">Auto (from Shopify)</SelectItem>
              <SelectItem value="FULL">Full payment</SelectItem>
              <SelectItem value="DEPOSIT">Deposit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {meta.paymentMode === "DEPOSIT" && (
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Deposit amount
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className="h-8 text-xs"
              value={depositDraft}
              onChange={(e) => setDepositDraft(e.target.value)}
              onBlur={() => {
                const num = depositDraft === "" ? null : Number(depositDraft);
                if (num !== meta.depositAmount) {
                  onSave({ depositAmount: num }, "depositAmount");
                }
              }}
              disabled={saving === "depositAmount"}
              placeholder="0"
            />
          </div>
        )}
      </div>

      <div>
        {kind === "paid" ? (
          <Row label="Paid" value={fmt(paid)} tone="success" bold />
        ) : kind === "deposit" ? (
          <>
            <Row label="Deposit paid" value={fmt(paid)} tone="success" bold />
            <Row label="Remaining" value={fmt(remaining)} tone="warning" bold />
          </>
        ) : kind === "unpaid" ? (
          <Row label="Outstanding" value={fmt(remaining)} tone="danger" bold />
        ) : (
          <Row label="Refunded" value={fmt(paid)} tone="muted" />
        )}
      </div>

      <ReceiptsRow
        receipts={meta.receipts}
        saving={saving}
        onUpload={onUploadReceipt}
        onDelete={onDeleteReceipt}
      />

      {kind === "unpaid" && (
        <CallTracker
          meta={meta}
          saving={saving}
          onCallOp={onCallOp}
          onCancel={() => onSave({ status: "CANCELLED" }, "status")}
        />
      )}
    </div>
  );
}

function CallTracker({
  meta,
  saving,
  onCallOp,
  onCancel,
}: {
  meta: ShopifyOrderMeta;
  saving: string | null;
  onCallOp: (
    body: { logCallAttempt?: CallOutcome; resetCallAttempts?: true },
    key: string,
  ) => void;
  onCancel: () => void;
}) {
  const attempts = meta.callAttempts;
  const noAnswerCount = attempts.filter((a) => a.outcome === "no_answer").length;
  const outOfAttempts = attempts.length >= MAX_CALL_ATTEMPTS;
  const shouldCancel = noAnswerCount >= MAX_CALL_ATTEMPTS;

  return (
    <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50/60 p-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-900">
          Collection calls ({attempts.length}/{MAX_CALL_ATTEMPTS})
        </div>
        {attempts.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onCallOp({ resetCallAttempts: true }, "callReset")
            }
            disabled={saving === "callReset"}
            className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      <div className="space-y-1">
        {Array.from({ length: MAX_CALL_ATTEMPTS }).map((_, i) => {
          const a = attempts[i];
          if (!a) return null;
          const tone =
            a.outcome === "no_answer"
              ? "text-rose-700"
              : a.outcome === "answered"
                ? "text-slate-700"
                : "text-emerald-700";
          const label =
            a.outcome === "no_answer"
              ? "No answer"
              : a.outcome === "answered"
                ? "Answered"
                : "Promised to pay";
          return (
            <div
              key={i}
              className={`flex items-center justify-between text-[11px] ${tone}`}
            >
              <span>#{i + 1} · {label}</span>
              <span className="text-muted-foreground">
                {new Date(a.at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                {new Date(a.at).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
      </div>

      {!outOfAttempts && (
        <div className="flex flex-wrap gap-1 pt-1">
          <button
            type="button"
            onClick={() => onCallOp({ logCallAttempt: "no_answer" }, "callLog")}
            disabled={saving === "callLog"}
            className="rounded-md border border-rose-300 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            No answer
          </button>
          <button
            type="button"
            onClick={() => onCallOp({ logCallAttempt: "promised" }, "callLog")}
            disabled={saving === "callLog"}
            className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            Promised to pay
          </button>
          <button
            type="button"
            onClick={() => onCallOp({ logCallAttempt: "answered" }, "callLog")}
            disabled={saving === "callLog"}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Answered (other)
          </button>
        </div>
      )}

      {shouldCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={saving === "status"}
          className="w-full rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          3 no-answers — cancel this order
        </button>
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

function ReceiptsRow({
  receipts,
  saving,
  onUpload,
  onDelete,
}: {
  receipts: ShopifyOrderMeta["receipts"];
  saving: string | null;
  onUpload: (file: File) => void;
  onDelete: (url: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const busy = saving === "receipt";

  return (
    <div className="space-y-2 border-t border-border pt-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Receipts ({receipts.length})
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-2 py-1 text-[11px] font-medium hover:bg-secondary disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Paperclip className="h-3 w-3" />
          )}
          Attach
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,application/pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </div>

      {receipts.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {receipts.map((r) => {
            const isImage = r.contentType.startsWith("image/");
            return (
              <div
                key={r.url}
                className="group relative overflow-hidden rounded-md border border-border bg-white"
              >
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.url}
                      alt={r.fileName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <FileText className="h-6 w-6" />
                      <span className="px-1 text-center text-[10px] leading-tight line-clamp-2">
                        {r.fileName || "PDF"}
                      </span>
                    </div>
                  )}
                </a>
                <button
                  type="button"
                  onClick={() => onDelete(r.url)}
                  disabled={busy}
                  aria-label="Remove receipt"
                  className="absolute right-1 top-1 hidden rounded-full bg-rose-600 p-0.5 text-white shadow-sm hover:bg-rose-700 group-hover:block"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
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
    <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Shipping address
      </div>
      <div className="space-y-0.5">
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {phone && (
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <span>📞 {phone}</span>
            {whatsAppLink(phone) && (
              <a
                href={whatsAppLink(phone)!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-200"
              >
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
