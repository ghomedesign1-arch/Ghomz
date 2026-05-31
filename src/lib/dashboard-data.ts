import { prisma } from "./prisma";

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function getDashboardData(
  months = 6,
  kpiYear?: number,
  kpiMonth?: number,
  kpiStart?: Date,
  kpiEnd?: Date,
) {
  const clampedMonths = Math.max(1, Math.min(60, months));
  try {
    const now = new Date();

    // kpiStart / kpiEnd override single-month params
    let startOfKpiMonth: Date;
    let endOfKpiMonth: Date;
    if (kpiStart && kpiEnd) {
      startOfKpiMonth = kpiStart;
      endOfKpiMonth   = kpiEnd;
    } else {
      const kpiY = kpiYear  ?? now.getFullYear();
      const kpiM = kpiMonth ?? now.getMonth();
      startOfKpiMonth = new Date(kpiY, kpiM, 1);
      endOfKpiMonth   = new Date(kpiY, kpiM + 1, 1);
    }
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - (clampedMonths - 1), 1);

    // ── plain queries, no imports from costing / product-cost ────────────────
    // Use raw SQL to avoid Prisma enum validation on ProductCategory
    const products = await prisma.$queryRaw<{
      id: string; sku: string; name: string; category: string;
      retailPrice: number; wholesalePrice: number; stockQty: number;
      widthCm: number; depthCm: number; heightCm: number;
    }[]>`SELECT id, sku, name, category::text, "retailPrice", "wholesalePrice", "stockQty",
         "widthCm", "depthCm", "heightCm" FROM "Product" ORDER BY name ASC`;
    const sponges = await prisma.$queryRaw<{
      id: string; name: string; stockBlocks: number;
      widthCm: number; depthCm: number; heightCm: number;
    }[]>`SELECT id, name, "stockBlocks", "widthCm", "depthCm", "heightCm" FROM "Sponge"`;

    const fabrics = await prisma.$queryRaw<{
      id: string; name: string; stockMeters: number; reorderLevel: number;
    }[]>`SELECT id, name, "stockMeters", "reorderLevel" FROM "Fabric"`;

    const bulks = await prisma.$queryRaw<{
      id: string; name: string; kind: string; stockKg: number; reorderLevel: number;
    }[]>`SELECT id, name, kind::text, "stockKg", "reorderLevel" FROM "BulkMaterial"`;

    const recentLogs = await prisma.$queryRaw<{
      id: string; productId: string; quantity: number; totalCost: number;
      unitCost: number; discount: number;
      startedAt: Date; retailPrice: number; name: string; sku: string;
    }[]>`
      SELECT pl.id, pl."productId", pl.quantity, pl."totalCost",
             pl."unitCost", COALESCE(pl."discount", 0) AS discount,
             pl."startedAt", p."retailPrice", p.name, p.sku
      FROM "ProductionLog" pl
      JOIN "Product" p ON p.id = pl."productId"
      WHERE pl."startedAt" >= ${sixMonthsAgo}
      ORDER BY pl."startedAt" DESC`;

    // Custom orders for KPI (revenue + profit)
    const recentCustomOrders = await prisma.$queryRaw<{
      id: string; createdAt: Date; subtotal: number; totalCost: number;
    }[]>`
      SELECT co.id, co."createdAt",
             COALESCE(SUM(ci."unitPrice" * ci.quantity), 0) AS subtotal,
             COALESCE(SUM(ci."unitCost"  * ci.quantity), 0) AS "totalCost"
      FROM "CustomOrder" co
      LEFT JOIN "CustomOrderItem" ci ON ci."orderId" = co.id
      WHERE co."createdAt" >= ${sixMonthsAgo}
        AND co.status != 'CANCELLED'
      GROUP BY co.id, co."createdAt"
      ORDER BY co."createdAt" DESC`;

    const purchases = await prisma.purchase.findMany({
      where:   { createdAt: { gte: sixMonthsAgo } },
      include: { items: { select: { kind: true, totalCost: true } } },
    });

    const openOrdersRaw = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM "ProductionLog"
      WHERE status IN ('DRAFT','IN_PROGRESS')`;
    const openCustomOrdersRaw = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM "CustomOrder"
      WHERE status IN ('PENDING','IN_PROGRESS')`;
    const openOrders = Number(openOrdersRaw[0]?.count ?? 0) + Number(openCustomOrdersRaw[0]?.count ?? 0);

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const kpiLogs = recentLogs.filter((l) => {
      const d = new Date(l.startedAt);
      return d >= startOfKpiMonth && d < endOfKpiMonth;
    });

    // Revenue = actual selling price (totalCost − discount), not product retail price
    const prodRevenueMTD = kpiLogs.reduce(
      (a, l) => a + Number(l.totalCost) - Number(l.discount), 0,
    );
    // Profit = revenue − BOM cost (unitCost × qty)
    const prodProfitMTD = kpiLogs.reduce(
      (a, l) => a + (Number(l.totalCost) - Number(l.discount)) - Number(l.unitCost) * Number(l.quantity), 0,
    );

    // Custom orders in the same KPI window
    const kpiCustomOrders = recentCustomOrders.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= startOfKpiMonth && d < endOfKpiMonth;
    });
    const customRevenueMTD = kpiCustomOrders.reduce((a, o) => a + Number(o.subtotal), 0);
    const customProfitMTD  = kpiCustomOrders.reduce((a, o) => a + (Number(o.subtotal) - Number(o.totalCost)), 0);

    const revenueMTD = prodRevenueMTD + customRevenueMTD;
    const profitMTD  = prodProfitMTD  + customProfitMTD;
    const marginMTD  = revenueMTD > 0 ? (profitMTD / revenueMTD) * 100 : 0;

    const kpiPurchases = purchases.filter(
      (p) => p.createdAt >= startOfKpiMonth && p.createdAt < endOfKpiMonth,
    );
    const materialCostMTD   = kpiPurchases.reduce((a, p) => a + p.totalAmount, 0);
    const purchaseCountMTD  = kpiPurchases.length;

    // ── Revenue vs cost chart (N months) ─────────────────────────────────────
    const monthMap = new Map<string, { month: string; revenue: number; cost: number }>();
    for (let i = clampedMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthMap.set(key, { month: d.toLocaleString("en-US", { month: "short" }), revenue: 0, cost: 0 });
    }
    for (const l of recentLogs) {
      const d = new Date(l.startedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const slot = monthMap.get(key);
      if (slot) slot.revenue += Number(l.totalCost) - Number(l.discount);
    }
    for (const o of recentCustomOrders) {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const slot = monthMap.get(key);
      if (slot) slot.revenue += Number(o.subtotal);
    }
    for (const p of purchases) {
      const key = `${p.createdAt.getFullYear()}-${p.createdAt.getMonth()}`;
      const slot = monthMap.get(key);
      if (slot) slot.cost += p.totalAmount;
    }
    const revenueByMonth = Array.from(monthMap.values());

    // ── Cost mix from purchases ───────────────────────────────────────────────
    const kindTotals: Record<string, number> = {};
    for (const p of purchases) {
      for (const item of p.items) {
        kindTotals[item.kind] = (kindTotals[item.kind] ?? 0) + item.totalCost;
      }
    }
    const KIND_LABEL: Record<string, string> = {
      SPONGE: "Sponge", FABRIC: "Fabric", FIBER: "Fiber",
      PACKAGING: "Packaging", MARKETING: "Marketing", OTHER: "Other",
    };
    const materialMix = Object.entries(kindTotals)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: KIND_LABEL[k] ?? k, value: v }))
      .sort((a, b) => b.value - a.value);

    // ── Low stock ─────────────────────────────────────────────────────────────
    const lowStock = [
      ...sponges.filter((s) => Number(s.stockBlocks) <= 3).map((s) => ({
        name: s.name, kind: "Sponge" as const, left: `${s.stockBlocks} blocks`,
      })),
      ...fabrics.filter((f) => Number(f.stockMeters) <= Number(f.reorderLevel)).map((f) => ({
        name: f.name, kind: "Fabric" as const, left: `${Number(f.stockMeters).toFixed(0)} m`,
      })),
      ...bulks.filter((b) => Number(b.stockKg) <= Number(b.reorderLevel)).map((b) => ({
        name: b.name,
        kind: b.kind === "FIBER" ? ("Fiber" as const) : ("Packaging" as const),
        left: `${Number(b.stockKg).toFixed(1)} kg`,
      })),
    ];

    // ── Top products by retail price (no BOM resolution needed) ──────────────
    const topProducts = products
      .map((p) => {
        const retail = Number(p.retailPrice);
        const wholesale = Number(p.wholesalePrice);
        const profit = retail - wholesale;
        const margin = retail > 0 ? (profit / retail) * 100 : 0;
        return { name: p.name, sku: p.sku, retail, cost: wholesale, margin, profit };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    // ── Sponge volume (inline calc, no costing import) ────────────────────────
    const spongeInventoryVolumeM3 =
      sponges.reduce((a, s) => a + s.widthCm * s.depthCm * s.heightCm * s.stockBlocks, 0) / 1_000_000;

    const fmtMonth = (d: Date) => d.toLocaleString("en-US", { month: "short", year: "numeric" });
    const isSameMonth =
      startOfKpiMonth.getFullYear() === new Date(endOfKpiMonth.getTime() - 1).getFullYear() &&
      startOfKpiMonth.getMonth()    === new Date(endOfKpiMonth.getTime() - 1).getMonth();
    const kpiMonthLabel = isSameMonth
      ? startOfKpiMonth.toLocaleString("en-US", { month: "long", year: "numeric" })
      : `${fmtMonth(startOfKpiMonth)} – ${fmtMonth(new Date(endOfKpiMonth.getTime() - 1))}`;

    return {
      ready: true as const,
      dbError: null as string | null,
      kpiMonthLabel,
      kpis: { revenueMTD, profitMTD, marginMTD, materialCostMTD, purchaseCountMTD, openOrders, activeProducts: products.length, lowStockCount: lowStock.length, spongeInventoryVolumeM3 },
      revenueByMonth,
      materialMix,
      fabricUsage: fabrics.map((f) => ({ fabric: f.name, meters: f.stockMeters })),
      lowStock,
      topProducts,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[dashboard] FAILED:", msg);
    return { ...DEMO_DATA, dbError: msg };
  }
}

// ─── Demo fallback ────────────────────────────────────────────────────────────
const DEMO_DATA = {
  ready: false as const,
  dbError: null as string | null,
  kpiMonthLabel: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
  kpis: { revenueMTD: 184_500, profitMTD: 76_200, marginMTD: 41.3, materialCostMTD: 96_200, purchaseCountMTD: 7, openOrders: 3, activeProducts: 4, lowStockCount: 2, spongeInventoryVolumeM3: 38.4 },
  revenueByMonth: [
    { month: "Dec", revenue: 142_000, cost: 78_000 },
    { month: "Jan", revenue: 158_000, cost: 84_000 },
    { month: "Feb", revenue: 171_000, cost: 88_000 },
    { month: "Mar", revenue: 165_000, cost: 90_000 },
    { month: "Apr", revenue: 192_000, cost: 99_000 },
    { month: "May", revenue: 184_500, cost: 96_200 },
  ],
  materialMix: [
    { name: "Sponge", value: 38_400 }, { name: "Fabric", value: 25_200 },
    { name: "Fiber",  value: 8_400 },  { name: "Packaging", value: 2_900 },
    { name: "Other",  value: 21_300 },
  ],
  fabricUsage: [
    { fabric: "Twix Reef", meters: 480 }, { fabric: "Spaniol", meters: 320 }, { fabric: "Australian", meters: 540 },
  ],
  lowStock: [
    { name: "Grey 40 Hard", kind: "Sponge" as const, left: "3 blocks" },
    { name: "Vaseline", kind: "Packaging" as const, left: "12.0 kg" },
  ],
  topProducts: [
    { name: "Fluff L Shape Sofa", sku: "GH-LSF-001", retail: 18500, cost: 9600,  margin: 48.1, profit: 8900 },
    { name: "Cloud Kids Bed",     sku: "GH-BED-001", retail: 9600,  cost: 5100,  margin: 46.8, profit: 4500 },
    { name: "Fluff Chair",        sku: "GH-CHR-001", retail: 5400,  cost: 2800,  margin: 48.2, profit: 2600 },
    { name: "Fluff Ottoman",      sku: "GH-OTT-001", retail: 2800,  cost: 1450,  margin: 48.2, profit: 1350 },
  ],
};
