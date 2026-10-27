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

const CATEGORIES_SEEDED_KEY = "cuttingLists.categoriesSeeded";

const PRODUCT_CATEGORY_LABEL: Record<string, string> = {
  L_SHAPE_SOFA: "L-Shape",
  MODULAR_SOFA: "Modular Sofa",
  SOFA_3_SEAT: "3-Seat Sofa",
  SOFA_2_SEAT: "2-Seat Sofa",
  CHAIR: "Chairs",
  KIDS_BED: "Beds",
  OTTOMAN: "Ottomans",
  BEAN_SEAT: "Bean Seats",
  OUTDOOR: "Outdoor",
  OTHER: "Other",
};
const LABEL_ORDER = Object.values(PRODUCT_CATEGORY_LABEL);

/**
 * One-time: give migrated items a starting category from their original
 * product's category. Only categories actually used are created.
 */
export async function ensureCuttingCategoriesSeeded(): Promise<void> {
  const flag = await prisma.setting.findUnique({ where: { key: CATEGORIES_SEEDED_KEY } });
  if (flag) return;

  const items = await prisma.cuttingListItem.findMany({
    where: { legacyProductId: { not: null }, categoryId: null },
    select: { id: true, legacyProductId: true },
  });
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.legacyProductId as string) } },
    select: { id: true, category: true },
  });
  const labelByProduct = new Map(
    products.map((p) => [p.id, PRODUCT_CATEGORY_LABEL[p.category] ?? "Other"]),
  );
  const labels = Array.from(new Set(Array.from(labelByProduct.values()))).sort(
    (a, b) => LABEL_ORDER.indexOf(a) - LABEL_ORDER.indexOf(b),
  );

  await prisma.cuttingListCategory.createMany({
    data: labels.map((name, i) => ({ name, position: i })),
    skipDuplicates: true,
  });
  const cats = await prisma.cuttingListCategory.findMany({
    where: { name: { in: labels } },
    select: { id: true, name: true },
  });
  const catByName = new Map(cats.map((c) => [c.name, c.id]));

  for (const label of labels) {
    const ids = items
      .filter((i) => labelByProduct.get(i.legacyProductId as string) === label)
      .map((i) => i.id);
    if (ids.length === 0) continue;
    await prisma.cuttingListItem.updateMany({
      where: { id: { in: ids } },
      data: { categoryId: catByName.get(label) },
    });
  }

  await prisma.setting.upsert({
    where: { key: CATEGORIES_SEEDED_KEY },
    create: { key: CATEGORIES_SEEDED_KEY, value: new Date().toISOString() },
    update: {},
  });
}
