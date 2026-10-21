import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddProductButton } from "@/components/row-actions/add-buttons";
import { ProductRowActions } from "@/components/row-actions/product-row-actions";
import { ProductImageUpload } from "@/components/products/product-image-upload";
import { WarmCacheButton } from "@/components/products/warm-cache-button";
import { canWrite, isAdmin } from "@/lib/rbac";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { getProducts, type ProductListItem } from "@/lib/products-data";
import { formatLE } from "@/lib/costing";
import { pct } from "@/lib/utils";
import { GitBranch } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  SOFA_2_SEAT:  "2-Seat Sofa",
  SOFA_3_SEAT:  "3-Seat Sofa",
  L_SHAPE_SOFA: "L-Shape Sofa",
  MODULAR_SOFA: "Modular Sofa",
  CHAIR:        "Chair",
  OUTDOOR:      "Outdoor",
  KIDS_BED:     "Kids Bed",
  OTTOMAN:      "Ottoman",
  BEAN_SEAT:    "Bean Seat",
  OTHER:        "Other",
};

function MarginCell({
  unitCost,
  retailPrice,
  retailMarginPct,
  cached,
}: {
  unitCost: number;
  retailPrice: number;
  retailMarginPct: number;
  cached?: boolean;
}) {
  if (cached === false) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="space-y-0.5">
      <div
        className={`tabular-nums font-medium ${
          retailMarginPct >= 25
            ? "text-emerald-700 dark:text-emerald-300"
            : retailMarginPct >= 20
              ? "text-amber-700 dark:text-amber-300"
              : "text-destructive"
        }`}
      >
        {formatLE(retailPrice - unitCost)}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {pct(retailMarginPct)}
      </div>
    </div>
  );
}

function ProductNameCell({ p, size = 40 }: { p: ProductListItem; size?: number }) {
  return (
    <div className="inline-flex items-center gap-3">
      <ProductImageUpload
        productId={p.id}
        imageUrl={p.imageUrl}
        size={size}
        initial={p.name.slice(0, 1)}
        editable={false}
      />
      <Link href={`/products/${p.id}`} className="group">
        <span className="font-medium group-hover:underline">
          {p.name}
          {p.variantName && (
            <span className="ml-1.5 text-muted-foreground font-normal">· {p.variantName}</span>
          )}
        </span>
        <span className="block text-xs text-muted-foreground">{p.sku}</span>
      </Link>
    </div>
  );
}

export default async function ProductsPage() {
  const [{ products }, writeAccess, adminAccess] = await Promise.all([
    getProducts(),
    canWrite(),
    isAdmin(),
  ]);

  // Group: parents (parentId = null) own their variants.
  // Variants (parentId != null) are nested under the parent row.
  const variantsByParent = new Map<string, ProductListItem[]>();
  const topLevel: ProductListItem[] = [];

  for (const p of products) {
    if (p.parentId) {
      const arr = variantsByParent.get(p.parentId) ?? [];
      arr.push(p);
      variantsByParent.set(p.parentId, arr);
    } else {
      topLevel.push(p);
    }
  }

  const totalSkus = products.length;
  const families  = topLevel.filter((p) => variantsByParent.has(p.id)).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Products"
        description="Every product is computed live from its bill-of-materials: sponge cuts, fabric meters, fiber & packaging grams, and manufacturing lines."
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/api/exports/products.xlsx" download>
                Export catalog
              </a>
            </Button>
            {writeAccess && (
              <Button asChild variant="outline">
                <a href="/products/dedupe">Dedupe variants</a>
              </Button>
            )}
            {writeAccess && (
              <Button asChild variant="outline">
                <a href="/products/color-merge">Merge colours</a>
              </Button>
            )}
            {writeAccess && <WarmCacheButton />}
            {writeAccess && <AddProductButton />}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>
            {totalSkus} SKU{totalSkus !== 1 ? "s" : ""}
            {families > 0 && ` · ${families} product famil${families === 1 ? "y" : "ies"} with variants`}
            {" · "}Margin = retail price − unit cost
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                {/* On mobile, Category / Dimensions / Unit cost / Stock are
                 *  folded into a secondary line inside the Product cell so
                 *  Product · Retail · Margin · ⋯ fit cleanly on iPhone. */}
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden text-right md:table-cell">Dimensions</TableHead>
                <TableHead className="hidden text-right md:table-cell">Unit cost</TableHead>
                <TableHead className="text-right">Retail</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Stock</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {topLevel.map((p) => {
                const variants = variantsByParent.get(p.id) ?? [];
                const isFamily = variants.length > 0;

                return (
                  <React.Fragment key={p.id}>
                    {/* ── Parent / standalone row ── */}
                    <TableRow className={isFamily ? "bg-muted/20" : undefined}>
                      <TableCell>
                        <div className="inline-flex items-center gap-3">
                          <ProductImageUpload
                            productId={p.id}
                            imageUrl={p.imageUrl}
                            size={40}
                            initial={p.name.slice(0, 1)}
                            editable={writeAccess}
                          />
                          <Link href={`/products/${p.id}`} className="group">
                            <span className="font-medium group-hover:underline">
                              {p.name}
                              {p.variantName && (
                                <span className="ml-1.5 text-muted-foreground font-normal">
                                  · {p.variantName}
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground">{p.sku}</span>
                              {isFamily && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
                                  <GitBranch className="h-2.5 w-2.5" />
                                  {variants.length} variant{variants.length !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                            {/* Mobile-only secondary line: cat · dims · cost · stock. */}
                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:hidden">
                              <span>{CATEGORY_LABEL[p.category] ?? p.category}</span>
                              <span>·</span>
                              <span className="tabular-nums">
                                {p.widthCm}×{p.depthCm}×{p.heightCm} cm
                              </span>
                              <span>·</span>
                              <span className="tabular-nums">Cost {p.cached === false ? "—" : formatLE(p.unitCost)}</span>
                              <span>·</span>
                              <span className="tabular-nums">Stock {p.stockQty}</span>
                            </div>
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary">
                          {CATEGORY_LABEL[p.category] ?? p.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums text-sm text-muted-foreground md:table-cell">
                        {p.widthCm} × {p.depthCm} × {p.heightCm} cm
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                        {p.cached === false ? "—" : formatLE(p.unitCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLE(p.retailPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        <MarginCell unitCost={p.unitCost} retailPrice={p.retailPrice} retailMarginPct={p.retailMarginPct} cached={p.cached} />
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {p.stockQty}
                      </TableCell>
                      <TableCell className="text-right">
                        {writeAccess && (
                          <ProductRowActions
                            product={{ id: p.id, name: p.name }}
                            canDelete={adminAccess}
                          />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Variants are hidden from the catalog list to keep it
                     *  clean — the "N variants" badge above links to the
                     *  parent's detail page where every variant is listed. */}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
