import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, withApi } from "@/lib/rbac";
import { resolveProductCost } from "@/lib/product-cost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pre-fill Product.cachedUnitCost for products whose cache is empty.
 *
 * Does one serial pass over up to `limit` uncached products so the Neon
 * connection pool is never flooded. Call it repeatedly from the UI (the
 * "Warm cache" button) until it reports `remaining: 0`. Each call is
 * capped well below Vercel's function timeout.
 */
export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(Math.max(body.limit ?? 20, 1), 40);

  const batch = await prisma.product.findMany({
    where: { cachedUnitCost: null, active: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  const errors: { id: string; message: string }[] = [];
  for (const row of batch) {
    try {
      const { breakdown } = await resolveProductCost(row.id);
      await prisma.product.update({
        where: { id: row.id },
        data: {
          cachedUnitCost: breakdown.totalCost,
          cachedUnitCostAt: new Date(),
        },
      });
      processed++;
    } catch (e) {
      errors.push({
        id: row.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const remaining = await prisma.product.count({
    where: { cachedUnitCost: null, active: true },
  });

  return NextResponse.json({
    processed,
    remaining,
    errors,
  });
});

export const GET = withApi(async () => {
  await requireRole("ADMIN", "MANAGER");
  const [total, uncached] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { active: true, cachedUnitCost: null } }),
  ]);
  return NextResponse.json({ total, uncached, cached: total - uncached });
});

