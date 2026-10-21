import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import { resolveProductCost } from "@/lib/product-cost";
import { invalidateProductCosts } from "@/lib/product-cost-cache";

/**
 * Manual safety-net endpoint: forces a fresh BOM-based cost computation for
 * this product (and anything that rolls up through it) and writes it back
 * to `cachedUnitCost`. Call this from the UI if the catalog ever shows a
 * stale cost — normally the invalidation hooks on BOM / material edits
 * keep the cache honest on their own.
 */
export const POST = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER");
  const exists = await prisma.product.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!exists) throw new HttpError(404, "Product not found");

  // Invalidate first so a concurrent list refresh doesn't paint a stale
  // number between the clear and the recompute.
  await invalidateProductCosts([params.id]);
  const { breakdown } = await resolveProductCost(params.id);
  await prisma.product.update({
    where: { id: params.id },
    data: {
      cachedUnitCost: breakdown.totalCost,
      cachedUnitCostAt: new Date(),
    },
  });
  return NextResponse.json({
    ok: true,
    unitCost: breakdown.totalCost,
    retailMarginPct: breakdown.retailMarginPct,
  });
});
