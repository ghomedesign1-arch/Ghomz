import * as React from "react";
import {
  Document,
  Font,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Path,
  G,
  Image,
  renderToBuffer,
} from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import {
  effectiveLineItems,
  effectiveSubtotal,
  type ShopifyOrderMeta,
  type ShopifyOrderSummary,
} from "@/lib/shopify";

// ── Font registration ─────────────────────────────────────────
// Cairo supports both Latin and Arabic. Files live in /public/fonts/ and
// are fetched over the deployed public URL so the serverless bundler
// doesn't need to trace them off disk — more reliable across Vercel
// deployments.
let fontsRegistered = false;
function ensureFonts(): void {
  if (fontsRegistered) return;
  // Load Amiri (Latin + Arabic, static TTF with no variable-axis quirks)
  // from our own /public/fonts path. The auth middleware is configured to
  // pass /fonts/* through without redirecting.
  const origin =
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  Font.register({
    family: "Amiri",
    fonts: [
      { src: `${origin}/fonts/Amiri-Regular.ttf` },
      { src: `${origin}/fonts/Amiri-Bold.ttf`, fontWeight: "bold" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export interface InvoiceBranding {
  logoUrl: string | null;
  bottomCurveUrl: string | null;
}

export async function loadInvoiceBranding(): Promise<InvoiceBranding> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["invoice.logoUrl", "invoice.bottomCurveUrl"] } },
  });
  return {
    logoUrl: rows.find((r) => r.key === "invoice.logoUrl")?.value ?? null,
    bottomCurveUrl:
      rows.find((r) => r.key === "invoice.bottomCurveUrl")?.value ?? null,
  };
}

const BLACK = "#111111";
const SUBTLE = "#666666";
const LINE = "#dcdcdc";
const TABLE_HEAD = "#2a2a2a";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BLACK,
  },
  // ── Header ─────────────────────────────────────────────────
  logoRow: { flexDirection: "row", alignItems: "center" },
  logoWord: {
    marginLeft: 8,
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  thickRule: {
    height: 4,
    backgroundColor: BLACK,
    marginTop: 14,
    marginBottom: 28,
  },

  // ── Tagline row ────────────────────────────────────────────
  taglineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  tagline: {
    fontSize: 30,
    fontWeight: "bold",
    lineHeight: 1.05,
    letterSpacing: 0.5,
  },
  location: { fontSize: 11, marginTop: 10 },

  // ── Meta ────────────────────────────────────────────────────
  metaBlock: { marginBottom: 20 },
  metaLine: {
    marginBottom: 3,
    fontSize: 10.5,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  metaLabel: { fontWeight: "bold" },
  metaValue: {
    marginLeft: 4,
    borderBottomWidth: 0.75,
    borderBottomColor: BLACK,
    borderBottomStyle: "solid",
    paddingBottom: 1,
    paddingHorizontal: 2,
    minWidth: 220,
  },

  // ── Items table ────────────────────────────────────────────
  table: {
    borderWidth: 0.75,
    borderColor: LINE,
    marginTop: 6,
    marginBottom: 20,
  },
  tr: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: LINE,
  },
  th: {
    backgroundColor: TABLE_HEAD,
    color: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontWeight: "bold",
    fontSize: 10,
  },
  td: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 10,
    borderRightWidth: 0.5,
    borderRightColor: LINE,
  },
  colItem: { width: "22%" },
  colDesc: { width: "28%" },
  colQty: { width: "10%", textAlign: "center" },
  colUnit: { width: "20%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right" },

  // ── Totals (right-aligned) ─────────────────────────────────
  totalsWrap: { alignItems: "flex-end", marginBottom: 24 },
  totalRow: { flexDirection: "row", marginBottom: 2 },
  totalLabel: { width: 90, textAlign: "right" },
  totalValue: {
    width: 90,
    textAlign: "right",
    fontWeight: "bold",
  },
  totalEmphasis: { fontSize: 11 },

  // ── Notes ──────────────────────────────────────────────────
  notesBlock: { marginTop: "auto", marginBottom: 150 },
  notesTitle: { fontWeight: "bold", marginBottom: 4 },
  noteLine: { marginBottom: 2, fontSize: 10 },
});

function GhomzLogo({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    // Use the uploaded brand PNG at a fixed height so the aspect ratio keeps.
    return (
      <View style={styles.logoRow}>
        <Image src={logoUrl} style={{ height: 36, objectFit: "contain" }} />
      </View>
    );
  }
  return (
    <View style={styles.logoRow}>
      <Svg width={34} height={34} viewBox="0 0 64 64">
        <G transform="rotate(-12 32 32)">
          <Rect x={6} y={6} width={52} height={52} rx={16} fill={BLACK} />
          <Path
            d="M40 22c-2.4-2.2-5.6-3.4-9-3.4-7.2 0-12.6 5-12.6 11.4 0 5.8 4.4 10.2 10.4 10.2 3.2 0 5.8-1.2 7.6-3.2v3.6c0 4.6-3 7.4-7.6 7.4-3.2 0-5.8-1.2-7.6-3l-2.4 4c2.6 2.4 6.2 3.6 10.2 3.6 7.4 0 12.4-4.4 12.4-12V22h-1.4zm-9 13.4c-3.6 0-6.4-2.6-6.4-6.2 0-3.6 2.8-6.2 6.4-6.2 3.6 0 6.4 2.6 6.4 6.2 0 3.6-2.8 6.2-6.4 6.2z"
            fill="#ffffff"
          />
        </G>
      </Svg>
      <Text style={styles.logoWord}>HOMZ</Text>
    </View>
  );
}

/**
 * Decorative curve in the bottom-right corner — uses the uploaded PNG when
 * available, otherwise falls back to an inline-drawn wave.
 */
function BottomCurve({ curveUrl }: { curveUrl: string | null }) {
  if (curveUrl) {
    return (
      <View
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 595, // full A4 width
          height: 170,
        }}
      >
        <Image
          src={curveUrl}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </View>
    );
  }
  return (
    <View
      style={{
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 260,
        height: 120,
      }}
    >
      <Svg width={260} height={120} viewBox="0 0 260 120">
        <Path d="M260 0 L260 120 L0 120 C140 120 60 20 260 0 Z" fill={BLACK} />
      </Svg>
    </View>
  );
}

interface InvoiceInput {
  order: ShopifyOrderSummary;
  meta: ShopifyOrderMeta;
  branding?: InvoiceBranding;
}

function num(v: string | number | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmt(v: number): string {
  return v.toLocaleString("en-EG", { maximumFractionDigits: 0 });
}

function invoiceNumber(order: ShopifyOrderSummary): string {
  const n = order.name.replace(/[^\d]/g, "");
  return `GH-${n || order.id}`;
}

function invoiceDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/**
 * Text run that auto-switches to Amiri when the content contains any Arabic
 * character. Keeps Helvetica for the common Latin case so numbers line up
 * nicely and spacing matches the design template.
 */
function AutoText({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object | object[];
}) {
  const str = React.Children.toArray(children).join("");
  const isArabic = ARABIC_RE.test(str);
  const stylesArr = Array.isArray(style) ? style : style ? [style] : [];
  return (
    <Text
      style={[
        ...stylesArr,
        { fontFamily: isArabic ? "Amiri" : "Helvetica" },
      ]}
    >
      {children}
    </Text>
  );
}

function customerName(o: ShopifyOrderSummary): string {
  return (
    [o.customer?.first_name, o.customer?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    o.customer?.email ||
    "Guest"
  );
}

function customerPhone(o: ShopifyOrderSummary): string {
  return o.customer?.phone ?? o.shipping_address?.phone ?? "";
}

function customerAddress(o: ShopifyOrderSummary): string {
  const a = o.shipping_address ?? o.billing_address;
  if (!a) return "";
  return [
    a.address1,
    a.address2,
    [a.city, a.province, a.zip].filter(Boolean).join(" "),
    a.country,
  ]
    .filter((s) => s && String(s).trim())
    .join(", ");
}

export function GhomzInvoice({ order, meta, branding }: InvoiceInput) {
  const logoUrl = branding?.logoUrl ?? null;
  const curveUrl = branding?.bottomCurveUrl ?? null;
  const effectiveLines = effectiveLineItems(order, meta);
  const activeItems = effectiveLines.filter((li) => li.quantity > 0);
  const hasOverrides = effectiveLines.some((li) => li.isCustom);
  const shopifySubtotal = num(order.current_subtotal_price ?? order.subtotal_price);
  const shopifyRawTotal = num(order.current_total_price ?? order.total_price);
  const subtotal = hasOverrides
    ? effectiveSubtotal(activeItems)
    : shopifySubtotal;
  const shopifyDiscount = num(
    order.current_total_discounts ?? order.total_discounts,
  );
  // When overrides change the subtotal, keep shipping+tax reconciliation
  // relative to the override subtotal so the Total matches the ERP view.
  const rawTotal = hasOverrides
    ? subtotal + (shopifyRawTotal - shopifySubtotal)
    : shopifyRawTotal;
  const erpDiscount = Math.max(0, num(meta.discount));
  const total = Math.max(0, rawTotal - erpDiscount);

  // Determine paid vs remaining respecting the ERP's payment override.
  let paid = 0;
  if (meta.paymentMode === "FULL") paid = total;
  else if (meta.paymentMode === "DEPOSIT")
    paid = Math.min(total, Math.max(0, num(meta.depositAmount)));
  else {
    const paidFromShopify = Math.max(
      0,
      rawTotal - num(order.total_outstanding),
    );
    paid = Math.min(total, paidFromShopify);
  }
  const remaining = Math.max(0, total - paid);
  const shipping = Math.max(0, shopifyRawTotal - shopifySubtotal + shopifyDiscount - num(
    order.current_total_tax ?? order.total_tax,
  ));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header ─────────────────────────────────────────── */}
        <GhomzLogo logoUrl={logoUrl} />
        <View style={styles.thickRule} />

        {/* Tagline + location ──────────────────────────────── */}
        <View style={styles.taglineRow}>
          <View>
            <Text style={styles.tagline}>CRAFTING</Text>
            <Text style={styles.tagline}>COMFORT</Text>
          </View>
          <Text style={styles.location}>Cairo, Egypt</Text>
        </View>

        {/* Meta block ──────────────────────────────────────── */}
        <View style={styles.metaBlock}>
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Invoice No:</Text>
            <AutoText style={styles.metaValue}> {invoiceNumber(order)} </AutoText>
          </View>
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Date:</Text>
            <Text style={styles.metaValue}>
              {" "}
              {invoiceDate(order.created_at)}{" "}
            </Text>
          </View>
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Customer Name:</Text>
            <AutoText style={styles.metaValue}> {customerName(order)} </AutoText>
          </View>
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Phone:</Text>
            <AutoText style={styles.metaValue}> {customerPhone(order)} </AutoText>
          </View>
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Address:</Text>
            <AutoText style={styles.metaValue}> {customerAddress(order)} </AutoText>
          </View>
        </View>

        {/* Items table ─────────────────────────────────────── */}
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.colItem]}>Item</Text>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colUnit]}>Unit Price (EGP)</Text>
            <Text style={[styles.th, styles.colTotal]}>Total (EGP)</Text>
          </View>
          {activeItems.map((li) => {
            return (
              <View key={li.id} style={styles.tr}>
                <AutoText style={[styles.td, styles.colItem]}>{li.title}</AutoText>
                <AutoText style={[styles.td, styles.colDesc]}>
                  {li.variantTitle ?? ""}
                </AutoText>
                <Text style={[styles.td, styles.colQty]}>{li.quantity}</Text>
                <Text style={[styles.td, styles.colUnit]}>{fmt(li.unitPrice)}</Text>
                <Text style={[styles.td, styles.colTotal]}>
                  {fmt(li.lineTotal)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Totals ──────────────────────────────────────────── */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{fmt(subtotal)} EGP</Text>
          </View>
          {shopifyDiscount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount:</Text>
              <Text style={styles.totalValue}>− {fmt(shopifyDiscount)} EGP</Text>
            </View>
          )}
          {erpDiscount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount:</Text>
              <Text style={styles.totalValue}>− {fmt(erpDiscount)} EGP</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Delivery:</Text>
            <Text style={styles.totalValue}>
              {shipping > 0 ? `${fmt(shipping)} EGP` : "FREE"}
            </Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 2 }]}>
            <Text style={[styles.totalLabel, styles.totalEmphasis]}>Total:</Text>
            <Text style={[styles.totalValue, styles.totalEmphasis]}>
              {fmt(total)} EGP
            </Text>
          </View>
          <View style={{ height: 10 }} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Paid:</Text>
            <Text style={styles.totalValue}>{fmt(paid)} EGP</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Remaining:</Text>
            <Text style={styles.totalValue}>{fmt(remaining)} EGP</Text>
          </View>
        </View>

        {/* Notes ───────────────────────────────────────────── */}
        <View style={styles.notesBlock}>
          <Text style={styles.notesTitle}>Notes:</Text>
          <Text style={styles.noteLine}>- Delivery within 10–14 days</Text>
          <Text style={styles.noteLine}>- No returns on custom orders</Text>
          <Text style={styles.noteLine}>- Warranty: 5 year</Text>
        </View>

        <BottomCurve curveUrl={curveUrl} />
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(
  input: InvoiceInput,
): Promise<Buffer> {
  ensureFonts();
  return renderToBuffer(<GhomzInvoice {...input} />);
}

export function invoiceFileName(order: ShopifyOrderSummary): string {
  return `${invoiceNumber(order)}.pdf`;
}
