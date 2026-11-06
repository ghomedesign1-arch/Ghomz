import { Cairo } from "next/font/google";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  DEFAULT_ORDER_META,
  effectiveDeliveryDate,
  effectiveLineItems,
  fetchRecentAndActiveOrders,
  getOrdersMeta,
  resolvePaymentKind,
  type ShopifyAddress,
  type ShopifyOrderSummary,
} from "@/lib/shopify";
import { orderArea } from "@/lib/locations";
import { PAYMENT_AR, STATUS_AR, arabicProductName, arabicVariant } from "@/lib/ticket-arabic";
import { PrintButton } from "@/components/shopify/print-button";

export const dynamic = "force-dynamic";

const cairo = Cairo({ subsets: ["arabic", "latin"], display: "swap" });

const PAYMENT_TONE: Record<string, string> = {
  paid: "border-emerald-600 bg-emerald-50 text-emerald-800",
  deposit: "border-amber-500 bg-amber-50 text-amber-900",
  unpaid: "border-rose-600 bg-rose-50 text-rose-800",
  refunded: "border-slate-400 bg-slate-50 text-slate-700",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function addressLines(a: ShopifyAddress | null): string[] {
  if (!a) return [];
  return [a.address1, a.address2, [a.city, a.province].filter(Boolean).join("، ")]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
}

/**
 * Arabic, price-free tickets for the factory / delivery team.
 * ?ids=1,2,3 prints those orders in that order; without ids prints every
 * open order (not Shipped / Cancelled).
 */
export default async function PrintShopifyTicketsPage({
  searchParams,
}: {
  searchParams?: { ids?: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const ids = (searchParams?.ids ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  let orders: ShopifyOrderSummary[] = [];
  let error: string | null = null;
  try {
    orders = await fetchRecentAndActiveOrders(30);
  } catch (err) {
    error = err instanceof Error ? err.message : "تعذر تحميل الطلبات";
  }
  const metaMap = await getOrdersMeta(orders.map((o) => o.id));
  const metaFor = (o: ShopifyOrderSummary) =>
    metaMap.get(o.id) ?? DEFAULT_ORDER_META;

  let list: ShopifyOrderSummary[];
  if (ids.length > 0) {
    const byId = new Map(orders.map((o) => [o.id, o]));
    list = ids.map((id) => byId.get(id)).filter((o): o is ShopifyOrderSummary => !!o);
  } else {
    list = orders.filter((o) => {
      const fin = (o.financial_status ?? "").toLowerCase();
      const s = metaFor(o).status;
      return (
        fin !== "refunded" && fin !== "voided" && s !== "SHIPPED" && s !== "CANCELLED"
      );
    });
  }

  const tickets = list.map((o) => {
    const m = metaFor(o);
    const kind = resolvePaymentKind(o, m);
    const customer =
      [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(" ").trim() ||
      o.shipping_address?.name ||
      "عميل";
    const address = o.shipping_address ?? o.billing_address;
    const lines = effectiveLineItems(o, m)
      .filter((li) => li.quantity > 0)
      .map((li) => ({ li, v: arabicVariant(li.title, li.variantTitle, li.sku) }));
    return {
      id: o.id,
      name: o.name,
      customer,
      phone: o.customer?.phone ?? o.shipping_address?.phone ?? null,
      area: orderArea(o, m),
      address: addressLines(address),
      ordered: formatDate(new Date(o.created_at)),
      due: formatDate(effectiveDeliveryDate(o.created_at, m)),
      status: STATUS_AR[m.status] ?? m.status,
      kind,
      notes: m.notes?.trim() || null,
      lines,
    };
  });

  const counts = { paid: 0, deposit: 0, unpaid: 0 } as Record<string, number>;
  for (const t of tickets) counts[t.kind] = (counts[t.kind] ?? 0) + 1;

  return (
    <div dir="rtl" lang="ar" className={`${cairo.className} min-h-screen bg-gray-100 text-black print:bg-white`}>
      <style>{`@page { size: A4; margin: 10mm; } @media print { .no-print { display: none !important; } }`}</style>

      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-white px-6 py-3 shadow-sm">
        <PrintButton />
        <span className="text-sm text-gray-600">
          {tickets.length} طلب · غير مدفوع {counts.unpaid ?? 0} · عربون {counts.deposit ?? 0} · مدفوع {counts.paid ?? 0}
        </span>
      </div>

      <div className="mx-auto max-w-[800px] space-y-4 p-6 print:max-w-none print:space-y-3 print:p-0">
        {error && <div className="rounded border border-rose-300 bg-rose-50 p-4">{error}</div>}
        {!error && tickets.length === 0 && (
          <div className="rounded border bg-white p-6 text-center">لا توجد طلبات للطباعة.</div>
        )}

        {tickets.map((t) => (
          <section
            key={t.id}
            className="break-inside-avoid rounded-lg border-2 border-gray-800 bg-white p-4"
            style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-300 pb-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold" dir="ltr">{t.name}</span>
                <span className="rounded border border-gray-400 px-2 py-0.5 text-sm">{t.status}</span>
              </div>
              <span className={`rounded border-2 px-3 py-1 text-base font-bold ${PAYMENT_TONE[t.kind]}`}>
                {PAYMENT_AR[t.kind]}
              </span>
            </header>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-2 text-sm">
              <div><b>العميل:</b> {t.customer}</div>
              <div><b>الهاتف:</b> <span dir="ltr">{t.phone ?? "—"}</span></div>
              <div><b>المنطقة:</b> {t.area ?? "—"}</div>
              <div><b>تاريخ الطلب:</b> {t.ordered}</div>
              <div className="col-span-2"><b>العنوان:</b> {t.address.length ? t.address.join("، ") : "—"}</div>
              <div className="col-span-2"><b>موعد التسليم:</b> {t.due}</div>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-2 py-1 text-right">المنتج</th>
                  <th className="border border-gray-400 px-2 py-1 text-right">المقاس</th>
                  <th className="border border-gray-400 px-2 py-1 text-right">اللون</th>
                  <th className="border border-gray-400 px-2 py-1 text-right">المرتبة</th>
                  <th className="border border-gray-400 px-2 py-1 text-center">الكمية</th>
                </tr>
              </thead>
              <tbody>
                {t.lines.map(({ li, v }) => (
                  <tr key={li.id}>
                    <td className="border border-gray-400 px-2 py-1 font-semibold">
                      {arabicProductName(li.title) ?? li.title}
                      {arabicProductName(li.title) && (
                        <div className="text-xs font-normal text-gray-600" dir="ltr">{li.title}</div>
                      )}
                      {v.extra.length > 0 && (
                        <div className="text-xs font-normal">{v.extra.join(" / ")}</div>
                      )}
                      {li.note && <div className="text-xs font-normal">ملاحظة: {li.note}</div>}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">{v.size ?? "—"}</td>
                    <td className="border border-gray-400 px-2 py-1">{v.color ?? "—"}</td>
                    <td className="border border-gray-400 px-2 py-1">
                      {v.mattress === true ? "مع مرتبة" : v.mattress === false ? "بدون مرتبة" : "—"}
                    </td>
                    <td className="border border-gray-400 px-2 py-1 text-center text-base font-bold">
                      {li.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {t.notes && (
              <div className="mt-2 rounded border border-gray-300 bg-gray-50 p-2 text-sm">
                <b>ملاحظات:</b> {t.notes}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
