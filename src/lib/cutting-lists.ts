import { prisma } from "./prisma";

const MIGRATED_KEY = "cuttingLists.migratedFromProducts";

/**
 * One-time copy of the old product-linked cutting lists into standalone
 * CuttingListItems: every base product becomes an item with the same name and
 * cutting note, and its files move under it. Idempotent and race-safe
 * (legacyProductId is unique), guarded by a Setting flag so products created
 * later are never pulled in.
 */
export async function ensureCuttingListsMigrated(): Promise<void> {
  const flag = await prisma.setting.findUnique({ where: { key: MIGRATED_KEY } });
  if (flag) return;

  const products = await prisma.product.findMany({
    where: { parentId: null },
    select: { id: true, name: true, cuttingNote: true },
  });
  await prisma.cuttingListItem.createMany({
    data: products.map((p) => ({
      name: p.name,
      note: p.cuttingNote,
      legacyProductId: p.id,
    })),
    skipDuplicates: true,
  });

  // Files attached to variants belong to their parent's item.
  const variantParents = await prisma.product.findMany({
    where: { parentId: { not: null } },
    select: { id: true, parentId: true },
  });
  const parentOf = new Map(variantParents.map((v) => [v.id, v.parentId as string]));

  const items = await prisma.cuttingListItem.findMany({
    where: { legacyProductId: { not: null } },
    select: { id: true, legacyProductId: true },
  });
  const itemByProduct = new Map(items.map((i) => [i.legacyProductId as string, i.id]));

  const unlinked = await prisma.cuttingList.findMany({
    where: { itemId: null },
    select: { id: true, productId: true },
  });
  let unassignedId: string | null = null;
  for (const f of unlinked) {
    const pid = f.productId ? parentOf.get(f.productId) ?? f.productId : null;
    let itemId = pid ? itemByProduct.get(pid) : undefined;
    if (!itemId) {
      if (!unassignedId) {
        const u = await prisma.cuttingListItem.create({ data: { name: "Unassigned" } });
        unassignedId = u.id;
      }
      itemId = unassignedId;
    }
    await prisma.cuttingList.update({ where: { id: f.id }, data: { itemId } });
  }

  await prisma.setting.upsert({
    where: { key: MIGRATED_KEY },
    create: { key: MIGRATED_KEY, value: new Date().toISOString() },
    update: {},
  });
}
