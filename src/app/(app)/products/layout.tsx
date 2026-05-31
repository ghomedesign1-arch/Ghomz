import { prisma } from "@/lib/prisma";
import { ProductTabs } from "@/components/products/product-tabs";

export const dynamic = "force-dynamic";

/**
 * Wraps every page under /products/* — the catalog list, each product's
 * detail page, and the BOM editor — with a sticky tab bar at the top showing
 * every product as its own tab. Clicking a tab navigates to that product's
 * detail page.
 */
export default async function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only base products appear in the top strip. Variants (parentId set) keep
  // their own SKU and are reachable via the variant switcher inside the parent
  // product's detail page, so listing them here would just duplicate the entry.
  const products = await prisma.product
    .findMany({
      where: { parentId: null },
      select: { id: true, name: true, sku: true },
      orderBy: { name: "asc" },
    })
    .catch(() => []);

  return (
    <div>
      <ProductTabs products={products} />
      {children}
    </div>
  );
}
