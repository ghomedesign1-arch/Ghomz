import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

/**
 * Preview + apply "collapse duplicates into variants" for products.
 *
 * Duplicate detection: top-level products (parentId null) that share the
 * exact same `name`. The oldest row in each group becomes the family
 * **parent** (variantName cleared) and every other row becomes a
 * **variant** of that parent (parentId set, variantName filled in).
 *
 * We never delete or merge BOMs / cutting lists / images — only the
 * parent/variant relationship is reshaped, so a bad grouping is easy to
 * reverse by hand later. Variants that already have a parent are
 * untouched.
 */
export const GET = withApi(async () => {
  await requireRole("ADMIN", "MANAGER");
  const groups = await buildGroups();
  return NextResponse.json({
    groupCount: groups.length,
    affectedProducts: groups.reduce((a, g) => a + g.variants.length, 0),
    groups,
  });
});

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const body = (await req.json().catch(() => ({}))) as {
    acceptedParents?: string[];
  };
  const accepted = new Set(body.acceptedParents ?? []);
  if (accepted.size === 0) {
    throw new HttpError(422, "acceptedParents required");
  }

  const groups = await buildGroups();
  const changed: { parentId: string; variantIds: string[] }[] = [];
  for (const g of groups) {
    if (!accepted.has(g.parent.id)) continue;
    const ops: Promise<unknown>[] = [];
    // Ensure the parent itself is clean: no parentId, no variantName.
    if (g.parent.parentId || g.parent.variantName) {
      ops.push(
        prisma.product.update({
          where: { id: g.parent.id },
          data: { parentId: null, variantName: null },
        }),
      );
    }
    for (const v of g.variants) {
      ops.push(
        prisma.product.update({
          where: { id: v.id },
          data: {
            parentId: g.parent.id,
            variantName: v.suggestedVariantName,
          },
        }),
      );
    }
    await Promise.all(ops);
    changed.push({
      parentId: g.parent.id,
      variantIds: g.variants.map((v) => v.id),
    });
  }

  return NextResponse.json({ groupsChanged: changed.length, changed });
});

interface PreviewProduct {
  id: string;
  sku: string;
  name: string;
  variantName: string | null;
  parentId: string | null;
  widthCm: number;
  depthCm: number;
}

interface PreviewVariant extends PreviewProduct {
  suggestedVariantName: string;
}

interface Group {
  parent: PreviewProduct;
  variants: PreviewVariant[];
}

async function buildGroups(): Promise<Group[]> {
  const rows = await prisma.product.findMany({
    where: { parentId: null },
    select: {
      id: true,
      sku: true,
      name: true,
      variantName: true,
      parentId: true,
      widthCm: true,
      depthCm: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const byName = new Map<string, (typeof rows)[number][]>();
  for (const r of rows) {
    const key = r.name.trim();
    const bucket = byName.get(key) ?? [];
    bucket.push(r);
    byName.set(key, bucket);
  }
  const groups: Group[] = [];
  for (const bucket of Array.from(byName.values())) {
    if (bucket.length < 2) continue;
    const [parent, ...rest] = bucket;
    groups.push({
      parent: {
        id: parent.id,
        sku: parent.sku,
        name: parent.name,
        variantName: parent.variantName,
        parentId: parent.parentId,
        widthCm: parent.widthCm,
        depthCm: parent.depthCm,
      },
      variants: rest.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        variantName: v.variantName,
        parentId: v.parentId,
        widthCm: v.widthCm,
        depthCm: v.depthCm,
        suggestedVariantName:
          v.variantName && v.variantName.trim().length > 0
            ? v.variantName
            : // Derive a nice variant label like "W120 × D230 · GH-BED-TINY-120-BB-WM"
              `W${Math.round(v.widthCm)} × D${Math.round(v.depthCm)} · ${v.sku}`,
      })),
    });
  }
  return groups.sort((a, b) => b.variants.length - a.variants.length);
}
