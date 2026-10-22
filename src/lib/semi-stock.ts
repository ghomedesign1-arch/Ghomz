import { prisma } from "./prisma";
import {
  effectiveLineItems,
  resolvePaymentKind,
  type ShopifyOrderMeta,
  type ShopifyOrderSummary,
} from "./shopify";

type StockItem = { id: string; model: string; sizeCm: number; createdAt: Date };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function parseSize(variantTitle: string | null, sku: string | null): number | null {
  const m = (variantTitle ?? "").match(/W\s*(\d{2,3})/i);
  if (m) return Number(m[1]);
  const seg = (sku ?? "").split("-").find((p) => /^\d{2,3}$/.test(p));
  return seg ? Number(seg) : null;
}

/** Longest model name contained in the line title wins ("Nest Plus" beats "Nest"). */
function matchItem(
  items: StockItem[],
  title: string,
  variantTitle: string | null,
  sku: string | null,
): StockItem | null {
  const size = parseSize(variantTitle, sku);
  if (size == null) return null;
  const t = ` ${norm(title)} `;
  let best: StockItem | null = null;
  for (const it of items) {
    if (it.sizeCm !== size) continue;
    if (!t.includes(` ${norm(it.model)} `)) continue;
    if (!best || it.model.length > best.model.length) best = it;
  }
  return best;
}

/**
 * Reconcile stock allocations with the current state of the given orders.
 * An order holds stock while it has a deposit or is paid and isn't
 * cancelled / refunded. Orders placed before the item existed only count
 * while still New / Scheduled.
 */
export async function syncOrdersStock(
  orders: ShopifyOrderSummary[],
  metaFor: (o: ShopifyOrderSummary) => ShopifyOrderMeta,
): Promise<void> {
  if (orders.length === 0) return;
  const items = await prisma.semiStockItem.findMany({
    select: { id: true, model: true, sizeCm: true, createdAt: true },
  });
  if (items.length === 0) return;

  const orderIds = orders.map((o) => String(o.id));
  const existing = await prisma.semiStockAllocation.findMany({
    where: { orderId: { in: orderIds } },
  });
  const existingByKey = new Map(existing.map((a) => [`${a.orderId}:${a.lineItemId}`, a]));

  const desired = new Map<
    string,
    { itemId: string; orderId: string; orderName: string; lineItemId: string; qty: number }
  >();
  for (const o of orders) {
    const meta = metaFor(o);
    const kind = resolvePaymentKind(o, meta);
    const holds =
      (kind === "deposit" || kind === "paid") && meta.status !== "CANCELLED";
    if (!holds) continue;
    const notStarted = meta.status === "NEW" || meta.status === "SCHEDULED";
    const placedAt = new Date(o.created_at);
    for (const li of effectiveLineItems(o, meta)) {
      if (li.quantity <= 0) continue;
      const key = `${o.id}:${li.id}`;
      const item = matchItem(items, li.title, li.variantTitle, li.sku);
      // Orders placed before tracking began only take stock while they
      // haven't been started — the factory already used sponge for the rest.
      const eligible = item && (notStarted || placedAt >= item.createdAt);
      if (!eligible) {
        // Keep a unit already taken (e.g. order moved on to In production).
        const kept = existingByKey.get(key);
        if (kept) {
          desired.set(key, {
            itemId: kept.itemId,
            orderId: kept.orderId,
            orderName: kept.orderName,
            lineItemId: kept.lineItemId,
            qty: kept.qty,
          });
        }
        continue;
      }
      desired.set(key, {
        itemId: item.id,
        orderId: String(o.id),
        orderName: o.name,
        lineItemId: String(li.id),
        qty: li.quantity,
      });
    }
  }

  const ops = [];
  for (const [key, d] of Array.from(desired.entries())) {
    const cur = existingByKey.get(key);
    if (cur && cur.itemId === d.itemId && cur.qty === d.qty) continue;
    ops.push(
      prisma.semiStockAllocation.upsert({
        where: { orderId_lineItemId: { orderId: d.orderId, lineItemId: d.lineItemId } },
        create: d,
        update: { itemId: d.itemId, qty: d.qty, orderName: d.orderName },
      }),
    );
  }
  const stale = existing.filter((a) => !desired.has(`${a.orderId}:${a.lineItemId}`));
  if (stale.length > 0) {
    ops.push(
      prisma.semiStockAllocation.deleteMany({
        where: { id: { in: stale.map((a) => a.id) } },
      }),
    );
  }
  if (ops.length > 0) await prisma.$transaction(ops);
}

export interface StockRow {
  id: string;
  model: string;
  sizeCm: number;
  lowStockAt: number;
  added: number;
  allocated: number;
  onHand: number;
  history: {
    at: string;
    delta: number;
    label: string;
  }[];
}

export async function getStockSummary(): Promise<StockRow[]> {
  const items = await prisma.semiStockItem.findMany({
    orderBy: [{ model: "asc" }, { sizeCm: "asc" }],
    include: {
      movements: { orderBy: { createdAt: "desc" } },
      allocations: { orderBy: { createdAt: "desc" } },
    },
  });
  return items.map((it) => {
    const added = it.movements.reduce((a, m) => a + m.delta, 0);
    const allocated = it.allocations.reduce((a, x) => a + x.qty, 0);
    const history = [
      ...it.movements.map((m) => ({
        at: m.createdAt.toISOString(),
        delta: m.delta,
        label: m.note || (m.delta >= 0 ? "Added" : "Removed"),
      })),
      ...it.allocations.map((a) => ({
        at: a.createdAt.toISOString(),
        delta: -a.qty,
        label: `Order ${a.orderName}`,
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 30);
    return {
      id: it.id,
      model: it.model,
      sizeCm: it.sizeCm,
      lowStockAt: it.lowStockAt,
      added,
      allocated,
      onHand: added - allocated,
      history,
    };
  });
}
