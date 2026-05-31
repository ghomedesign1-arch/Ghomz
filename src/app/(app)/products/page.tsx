import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddProductButton } from "@/components/row-actions/add-buttons";
import { ProductRowActions } from "@/components/row-actions/product-row-actions";
import { ProductImageUpload } from "@/components/products/product-image-upload";
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

function MarginCell({ unitCost, retailPrice, retailMarginPct }: { unitCost: number; retailPrice: number; retailMarginPct: number }) {
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
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Dimensions</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Retail</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {topLevel.map((p) => {
                const variants = variantsByParent.get(p.id) ?? [];
                const isFamily = variants.length > 0;

                return (
                  <>
                    {/* ── Parent / standalone row ── */}
                    <TableRow key={p.id} className={isFamily ? "bg-muted/20 border-b-0" : undefined}>
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
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {CATEGORY_LABEL[p.category] ?? p.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {p.widthCm} × {p.depthCm} × {p.heightCm} cm
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatLE(p.unitCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLE(p.retailPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        <MarginCell unitCost={p.unitCost} retailPrice={p.retailPrice} retailMarginPct={p.retailMarginPct} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
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

                    {/* ── Variant sub-rows ── */}
                    {variants.map((v, vi) => (
                      <TableRow
                        key={v.id}
                        className={`bg-muted/10 ${vi === variants.length - 1 ? "" : "border-b-0"}`}
                      >
                        <TableCell className="pl-16">
                          <div className="inline-flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">└</span>
                            <Link href={`/products/${v.id}`} className="group">
                              <span className="text-sm font-medium group-hover:underline">
                                {v.variantName}
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">{v.sku}</span>
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                          {v.widthCm} × {v.depthCm} × {v.heightCm} cm
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                          {formatLE(v.unitCost)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-sm">
                          {formatLE(v.retailPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <MarginCell unitCost={v.unitCost} retailPrice={v.retailPrice} retailMarginPct={v.retailMarginPct} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {v.stockQty}
                        </TableCell>
                        <TableCell className="text-right">
                          {writeAccess && (
                            <ProductRowActions
                              product={{ id: v.id, name: `${v.name} · ${v.variantName}` }}
                              canDelete={adminAccess}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
