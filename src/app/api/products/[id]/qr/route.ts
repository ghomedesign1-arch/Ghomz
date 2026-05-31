import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Returns a 4×4cm-printable HTML label containing a QR that encodes
 * the absolute product URL. Open the page, hit ⌘P and print on label stock.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const productUrl = `${origin}/products/${product.id}`;
  const qrDataUrl = await QRCode.toDataURL(productUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#1f1611", light: "#ffffff" },
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escape(product.sku)} · QR label</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    background: #f5f1ea;
    color: #1f1611;
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }
  .label {
    width: 240px;
    background: #fff;
    border: 1px solid #e6dbc8;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 2px 12px rgba(31,22,17,0.08);
    text-align: center;
  }
  .brand {
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 11px;
    color: #8b6e45;
  }
  .qr { width: 200px; height: 200px; margin: 12px auto 8px; display: block; }
  .name { font-weight: 600; font-size: 14px; margin-top: 6px; }
  .sku { font-size: 11px; color: #8b6e45; margin-top: 2px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .actions { display: flex; gap: 8px; }
  button {
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid #d6c4a6;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
  }
  button.primary { background: #3a2a18; color: #fff; border-color: #3a2a18; }
  @media print {
    body { background: #fff; padding: 8mm; }
    .actions { display: none; }
    .label { border: none; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="label">
    <div class="brand">G-Homz</div>
    <img class="qr" src="${qrDataUrl}" alt="QR code" />
    <div class="name">${escape(product.name)}</div>
    <div class="sku">${escape(product.sku)}</div>
  </div>
  <div class="actions">
    <button class="primary" onclick="window.print()">Print label</button>
    <button onclick="window.close()">Close</button>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}
