import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { HttpError } from '@/lib/rbac';
import { shopifyClient } from '@/lib/shopify-price';
import catalog from './shopify-kids-catalog.json';

export const KIDS_REVISION = createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
export const KIDS_QUERY = `query KidsImport($ids: [ID!]!) {
  shop { myshopifyDomain currencyCode }
  nodes(ids: $ids) { ... on Product { id title status variants(first: 100) {
    nodes { id title sku price } pageInfo { hasNextPage }
  } } }
}`;
const existingFamilies: Record<string, string> = {
  'gid://shopify/Product/8455185531051': 'cmq47b5bc0003retibny481ni',
  'gid://shopify/Product/8455213351083': 'cmsvp6x11000011mrte0pjb9e',
};
const key = (id: string) => `shopify.variant.${id.split('/').pop()}`;
const familyKey = (id: string) => `shopify.product.${id.split('/').pop()}`;
const shop = '13e79d-01.myshopify.com';

export function validateKidsCatalog(data: any) {
  if (data.shop?.myshopifyDomain !== shop || data.shop?.currencyCode !== 'EGP' || data.nodes?.length !== catalog.length) {
    throw new HttpError(409, 'Shopify store identity or currency does not match. Nothing was imported.');
  }
  for (const p of catalog) {
    const live = data.nodes.find((n: any) => n?.id === p.id);
    if (!live || live.title !== p.name || live.status !== p.status || live.variants?.pageInfo?.hasNextPage || live.variants?.nodes?.length !== p.variants.length) {
      throw new HttpError(409, 'The Shopify collection changed. Review the import before continuing.');
    }
    for (const v of p.variants) {
      const found = live.variants.nodes.find((n: any) => n.id === v.id);
      if (!found || found.sku !== v.sku || found.title !== v.title || Number(found.price) !== v.price) {
        throw new HttpError(409, `Shopify details changed for ${v.sku}. Nothing was imported.`);
      }
    }
  }
}
export async function kidsPreview() {
  const links = await prisma.setting.findMany({ where: { key: { in: catalog.flatMap(p => p.variants.map(v => key(v.id))) } } });
  const keys = new Set(links.map(l => l.key));
  return { revision: KIDS_REVISION, total: 106, linked: keys.size,
    products: catalog.map(p => ({ name: p.name, status: p.status, variants: p.variants.length,
      pending: p.variants.filter(v => !keys.has(key(v.id))).length })) };
}
export async function importKids() {
  const client = await shopifyClient();
  validateKidsCatalog(await client(KIDS_QUERY, { ids: catalog.map(p => p.id) }));
  // One transaction and one lock make concurrent clicks and retries safe.
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(871422, 318237)::text`;
    const rows = await tx.product.findMany();
    const settings = await tx.setting.findMany({ where: { key: { startsWith: 'shopify.' } } });
    const settingsByKey = new Map(settings.map(s => [s.key, s.value]));
    const products: any[] = [];
    const links: {key: string; value: string}[] = [];
    const seen = new Set(rows.map(r => r.sku.toUpperCase()));
    let imported = 0;
    const add = (data: any) => {
      if (seen.has(data.sku.toUpperCase())) throw new HttpError(409, `ERP SKU ${data.sku} already exists without this Shopify link. Review it before importing.`);
      seen.add(data.sku.toUpperCase());
      const row = { id: randomUUID(), category: 'KIDS_BED', stockQty: 0, wholesalePrice: 0, ...data };
      products.push(row); return row.id as string;
    };
    for (const p of catalog) {
      let parentId: string | null = null;
      if (p.variants.length > 1) {
        const savedFamily = settingsByKey.get(familyKey(p.id));
        parentId = savedFamily ? JSON.parse(savedFamily).erpProductId : existingFamilies[p.id] ?? null;
        if (parentId) {
          const parent = rows.find(r => r.id === parentId);
          if (!parent || parent.category !== 'KIDS_BED' || parent.parentId) throw new HttpError(409, 'An existing ERP bed family needs review.');
        } else {
          const v = p.variants[0];
          parentId = add({ name: p.name, sku: v.sku.split('-').slice(0,3).join('-'),
            widthCm: v.widthCm, depthCm: v.depthCm, heightCm: v.heightCm,
            retailPrice: v.price, imageUrl: p.imageUrl, active: p.status === 'ACTIVE',
            description: `${p.description}\nShopify family. Select a linked variant for orders. Production materials need setup.` });
        }
        if (!savedFamily) links.push({ key: familyKey(p.id), value: JSON.stringify({ shop, shopifyProductId:p.id, erpProductId:parentId }) });
      }
      for (const v of p.variants) {
        const saved = settingsByKey.get(key(v.id));
        if (saved) {
          const link = JSON.parse(saved);
          const row = rows.find(r => r.id === link.erpProductId);
          if (link.shop !== shop || link.shopifyProductId !== p.id || link.shopifyVariantId !== v.id || !row || row.sku !== v.sku) throw new HttpError(409, 'An existing variant link needs review.');
          continue;
        }
        const erpProductId = add({ name:p.name, sku:v.sku, parentId,
          variantName: parentId ? v.title : null, widthCm:v.widthCm, depthCm:v.depthCm, heightCm:v.heightCm,
          retailPrice:v.price, active:p.status === 'ACTIVE', imageUrl:p.imageUrl,
          description:`${p.description}\nShopify option: ${v.title}. Production materials need setup; imported price is not a production cost.` });
        links.push({key:key(v.id), value:JSON.stringify({shop, shopifyProductId:p.id, shopifyVariantId:v.id, erpProductId, sku:v.sku})});
        imported++;
      }
    }
    if (products.length) await tx.product.createMany({data:products});
    if (links.length) await tx.setting.createMany({data:links});
    return { ok:true, imported, createdRecords:products.length, linked:106, existingProductionRecordsPreserved:true };
  }, { timeout:30000, maxWait:10000 });
}
