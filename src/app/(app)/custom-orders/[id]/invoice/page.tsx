import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatLE } from "@/lib/costing";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function CustomOrderInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const order = await prisma.customOrder.findUnique({
    where: { id: params.id },
    include: { items: true },
  });

  if (!order) notFound();

  const subtotal = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const balance = subtotal - order.deposit;

  return (
    <>
      {/* Print button — hidden when printing */}
      <div className="no-print fixed right-6 top-6 z-50 flex gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-[#3a2a18] px-4 py-2 text-sm font-medium text-white shadow hover:bg-[#2e2010] transition-colors"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>

      <div
        className="min-h-screen bg-gray-100 p-8 print:bg-white print:p-0"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <div
          className="mx-auto max-w-[720px] bg-white shadow-lg print:shadow-none"
          style={{ padding: "48px" }}
        >
          {/* ── Header ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              paddingBottom: "24px",
              borderBottom: "2px solid #f3f0e8",
              marginBottom: "32px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "800",
                  color: "#3a2a18",
                  letterSpacing: "-0.5px",
                }}
              >
                G-Homz
              </div>
              <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                Premium compressed-sponge furniture · Cairo, EG
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: "700",
                  color: "#1f2937",
                }}
              >
                INVOICE
              </div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "800",
                  color: "#3a2a18",
                  marginTop: "4px",
                }}
              >
                {order.invoiceNo}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "6px" }}>
                {formatDate(order.createdAt)}
              </div>
            </div>
          </div>

          {/* ── Client info ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              marginBottom: "32px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#9ca3af",
                  marginBottom: "8px",
                }}
              >
                Bill to
              </div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#1f2937" }}>
                {order.clientName}
              </div>
              {order.clientPhone && (
                <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                  {order.clientPhone}
                </div>
              )}
              {order.clientAddress && (
                <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                  {order.clientAddress}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#9ca3af",
                  marginBottom: "8px",
                }}
              >
                Details
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>
                <span style={{ color: "#374151", fontWeight: "600" }}>Status: </span>
                {order.status.replace("_", " ")}
              </div>
              {order.deliveryDate && (
                <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                  <span style={{ color: "#374151", fontWeight: "600" }}>Delivery: </span>
                  {formatDate(order.deliveryDate)}
                </div>
              )}
            </div>
          </div>

          {/* ── Items table ── */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "24px",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "#f3f0e8",
                }}
              >
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#3a2a18",
                    borderRadius: "6px 0 0 6px",
                  }}
                >
                  Item
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#3a2a18",
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "center",
                    fontSize: "11px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#3a2a18",
                    width: "64px",
                  }}
                >
                  Qty
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    fontSize: "11px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#3a2a18",
                    width: "110px",
                  }}
                >
                  Unit price
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    fontSize: "11px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#3a2a18",
                    width: "110px",
                    borderRadius: "0 6px 6px 0",
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    backgroundColor: i % 2 === 0 ? "white" : "#fafaf9",
                  }}
                >
                  <td
                    style={{
                      padding: "12px 12px",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#1f2937",
                    }}
                  >
                    {item.name}
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    {item.description ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      fontSize: "13px",
                      textAlign: "center",
                      color: "#374151",
                    }}
                  >
                    {item.quantity}
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      fontSize: "13px",
                      textAlign: "right",
                      color: "#374151",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatLE(item.unitPrice)}
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      fontSize: "13px",
                      textAlign: "right",
                      fontWeight: "600",
                      color: "#1f2937",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatLE(item.quantity * item.unitPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Totals box ── */}
          <div
            style={{
              marginLeft: "auto",
              maxWidth: "320px",
              backgroundColor: "#f9f6f1",
              borderRadius: "10px",
              padding: "20px 24px",
              marginBottom: "32px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
                fontSize: "13px",
                color: "#6b7280",
              }}
            >
              <span>Subtotal</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "#1f2937" }}>
                {formatLE(subtotal)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
                fontSize: "13px",
                color: "#6b7280",
              }}
            >
              <span>Deposit paid</span>
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  color: "#059669",
                  fontWeight: "600",
                }}
              >
                {formatLE(order.deposit)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "12px",
                marginTop: "8px",
                borderTop: "1.5px solid #d6c4a6",
                fontSize: "16px",
                fontWeight: "700",
                color: "#3a2a18",
              }}
            >
              <span>Balance due</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatLE(Math.max(0, balance))}
              </span>
            </div>
          </div>

          {/* ── Notes ── */}
          {order.notes && (
            <div
              style={{
                marginBottom: "32px",
                padding: "14px 16px",
                backgroundColor: "#fffbf5",
                borderLeft: "3px solid #d6c4a6",
                borderRadius: "0 6px 6px 0",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#9ca3af",
                  marginBottom: "6px",
                }}
              >
                Notes
              </div>
              <div style={{ fontSize: "13px", color: "#374151" }}>{order.notes}</div>
            </div>
          )}

          {/* ── Footer ── */}
          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              paddingTop: "20px",
              textAlign: "center",
              fontSize: "11px",
              color: "#9ca3af",
            }}
          >
            Thank you for choosing G-Homz · Premium compressed-sponge furniture · Cairo, Egypt
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @page { margin: 0; }
        }
      `}</style>
    </>
  );
}
