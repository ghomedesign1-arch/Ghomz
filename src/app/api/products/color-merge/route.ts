import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import { nonColorKey, isColorValue } from "@/lib/variant-detect";

/**
 * Collapse colour-only variants under each parent into one canonical variant
 * per (dimension + mattress option) combo. The extras keep existing on the
 * database as `active: false` and their SKUs are appended to the canonical
 * variant's `aliasSkus` so Shopify orders still find the right ERP row.
 *
 * GET  — preview groups
 * POST — body { acceptedCanonicalIds: string[] } applies the merge
 */

interface PreviewVariant {
  id: string;
  sku: string;
  variantName: string | null;
  retailPrice: number;
}

interface PreviewGroup {
  parentId: string;
  parentName: string;
  nonColorKey: string;
  canonical: PreviewVariant;
  duplicates: PreviewVariant[];
}

async function buildGroups(): Promise<PreviewGroup[]> {
  const parents = await prisma.product.findMany({
    where: { parentId: null, variants: { some: {} } },
    select: {
      id: true,
      name: true,
      variants: {
        where: { active: true },
        select: {
          id: true,
          sku: true,
          variantName: true,
          retailPrice: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const groups: PreviewGroup[] = [];
  for (const p of parents) {
    const byKey = new Map<string, typeof p.variants>();
    for (const v of p.variants) {
      // Skip variants whose name has no colour — nothing to merge.
      const hasColor = (v.variantName ?? "")
        .split("/")
        .some((seg) => isColorValue(seg));
      if (!hasColor) continue;
      const key = nonColorKey(v.variantName);
      const bucket = byKey.get(key) ?? [];
      bucket.push(v);
      byKey.set(key, bucket);
    }
    for (const [key, bucket] of Array.from(byKey.entries())) {
      if (bucket.length < 2) continue;
      const [canonical, ...rest] = bucket;
      groups.push({
        parentId: p.id,
        parentName: p.name,
        nonColorKey: key,
        canonical: {
          id: canonical.id,
          sku: canonical.sku,
          variantName: canonical.variantName,
          retailPrice: canonical.retailPrice,
        },
        duplicates: rest.map((d) => ({
          id: d.id,
          sku: d.sku,
          variantName: d.variantName,
          retailPrice: d.retailPrice,
        })),
      });
    }
  }
  return groups.sort(
    (a, b) =>
      b.duplicates.length - a.duplicates.length ||
      a.parentName.localeCompare(b.parentName),
  );
}

export const GET = withApi(async () => {
  await requireRole("ADMIN", "MANAGER");
  const groups = await buildGroups();
  return NextResponse.json({
    groupCount: groups.length,
    duplicateCount: groups.reduce((a, g) => a + g.duplicates.length, 0),
    groups,
  });
});

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const body = (await req.json().catch(() => ({}))) as {
    acceptedCanonicalIds?: string[];
  };
  const accepted = new Set(body.acceptedCanonicalIds ?? []);
  if (accepted.size === 0) {
    throw new HttpError(422, "acceptedCanonicalIds required");
  }

  const groups = await buildGroups();
  const applied: {
    canonicalId: string;
    aliasSkusAdded: string[];
    deactivated: string[];
  }[] = [];
  for (const g of groups) {
    if (!accepted.has(g.canonical.id)) continue;
    const canonicalCurrent = await prisma.product.findUnique({
      where: { id: g.canonical.id },
      select: { aliasSkus: true },
    });
    if (!canonicalCurrent) continue;
    const aliasSet = new Set(canonicalCurrent.aliasSkus);
    for (const d of g.duplicates) aliasSet.add(d.sku);
    // Nicer label — strip the colour part out of the canonical's variant name
    // so the catalogue shows "W120 x D230 cm / Without" instead of
    // "W120 x D230 cm / Baby Blue / Without".
    const cleanedName = g.nonColorKey || g.canonical.variantName;
    await prisma.$transaction([
      prisma.product.update({
        where: { id: g.canonical.id },
        data: {
          aliasSkus: Array.from(aliasSet),
          variantName: cleanedName,
        },
      }),
      ...g.duplicates.map((d) =>
        prisma.product.update({
          where: { id: d.id },
          data: { active: false },
        }),
      ),
    ]);
    applied.push({
      canonicalId: g.canonical.id,
      aliasSkusAdded: g.duplicates.map((d) => d.sku),
      deactivated: g.duplicates.map((d) => d.id),
    });
  }
  return NextResponse.json({ groupsApplied: applied.length, applied });
});
