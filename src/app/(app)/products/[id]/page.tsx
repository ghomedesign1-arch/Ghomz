import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Factory,
  GitBranch,
  Layers,
  PackageOpen,
  Pencil,
  Scissors,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CostBar } from "@/components/dashboard/cost-bar";
import { CatalogueBreakdown } from "@/components/products/catalogue-breakdown";
import { resolveProductCost } from "@/lib/product-cost";
import {
  cutVolumeCm3,
  formatLE,
  spongeBlockCost,
  spongeBlockVolumeCm3,
  unitsPerBlock,
} from "@/lib/costing";
import { pct } from "@/lib/utils";
import { ProductionRunDialog } from "@/components/dialogs/production-run-dialog";
import { getProductionRunOptions } from "@/lib/production-options";
import { canWrite, isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ProductRowActions } from "@/components/row-actions/product-row-actions";
import { ProductImageUpload } from "@/components/products/product-image-upload";
import { AddVariantDialog } from "@/components/dialogs/add-variant-dialog";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function ProductDetailPage({ params }: PageProps) {
  let resolved;
  try {
    resolved = await resolveProductCost(params.id);
  } catch {
    notFound();
  }
  const { product, breakdown } = resolved;

  const [runOptions, fabrics, writeAccess, adminAccess] = await Promise.all([
    getProductionRunOptions(),
    prisma.fabric.findMany({ select: { id: true, name: true, costPerMeter: true }, orderBy: { name: "asc" } }),
    canWrite(),
    isAdmin(),
  ]);

  // Resolve unit cost of every sub-product included in this one. Used by the
  // catalogue's "Included products" table to show per-row subtotals.
  const childCosts: Record<string, number> = {};
  for (const c of product.compositions ?? []) {
    try {
      const { breakdown: childBd } = await resolveProductCost(c.childProductId);
      childCosts[c.childProductId] = childBd.totalCost;
    } catch {
      childCosts[c.childProductId] = 0;
    }
  }

  const segments = [
    { label: "Sponge", amount: breakdown.spongeCost, color: "hsl(var(--chart-1))" },
    { label: "Fabric", amount: breakdown.fabricCost, color: "hsl(var(--chart-2))" },
    { label: "Fiber", amount: breakdown.fiberCost, color: "hsl(var(--chart-3))" },
    { label: "Packaging", amount: breakdown.packagingCost, color: "hsl(var(--chart-4))" },
    {
      label: "Manufacturing",
      amount: breakdown.manufacturingCost,
      color: "hsl(var(--chart-5))",
    },
  ];

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/products">
          <ArrowLeft className="h-4 w-4" /> All products
        </Link>
      </Button>

      {/* ── Variant switcher ── */}
      {(product.variants.length > 0 || product.parentId) && (() => {
        // Collect all siblings: if this is a variant, fetch parent's other variants
        const parentProduct = product.parent;
        const allVariants = product.variants.length > 0
          ? [{ id: product.id, variantName: product.variantName, sku: product.sku }, ...product.variants]
          : parentProduct
            ? [{ id: parentProduct.id, variantName: parentProduct.variantName, sku: "" }, { id: product.id, variantName: product.variantName, sku: product.sku }]
            : [];
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5" /> Variants
            </span>
            {allVariants.map((v) => (
              <Link
                key={v.id}
                href={`/products/${v.id}`}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                  v.id === product.id
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {v.variantName ?? "Base"}
              </Link>
            ))}
          </div>
        );
      })()}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <ProductImageUpload
            productId={product.id}
            imageUrl={product.imageUrl ?? null}
            size={160}
            initial={product.name.slice(0, 1)}
            editable={writeAccess}
            className="mt-1"
          />
          <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{product.sku}</Badge>
            <Badge variant="outline">
              {product.widthCm} × {product.depthCm} × {product.heightCm} cm
            </Badge>
            {product.active && (
              <Badge variant="success" className="gap-1">
                <Sparkles className="h-3 w-3" /> Active
              </Badge>
            )}
            {product.variantName && (
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                <GitBranch className="h-3 w-3" /> {product.variantName}
              </Badge>
            )}
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {product.name}
            {product.variantName && (
              <span className="ml-3 text-xl font-normal text-muted-foreground">
                {product.variantName}
              </span>
            )}
          </h1>
          {product.description && (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {product.description}
            </p>
          )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {writeAccess && (
            <AddVariantDialog
              parentId={product.parentId ?? product.id}
              parentName={product.name}
              defaults={{
                category: product.category,
                widthCm: product.widthCm,
                depthCm: product.depthCm,
                heightCm: product.heightCm,
              }}
            />
          )}
          {writeAccess && (
            <Button asChild variant="outline">
              <Link href={`/products/${product.id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit BOM
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <a
              href={`/api/products/${product.id}/invoice`}
              target="_blank"
              rel="noreferrer"
            >
              Cost statement PDF
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href={`/api/products/${product.id}/qr`}
              target="_blank"
              rel="noreferrer"
            >
              QR label
            </a>
          </Button>
          {writeAccess && (
            <ProductionRunDialog
              options={runOptions}
              availableFabrics={fabrics}
              defaultProductId={product.id}
              triggerLabel="Log production run"
            />
          )}
          {writeAccess && (
            <ProductRowActions
              product={{ id: product.id, name: product.name }}
              canDelete={adminAccess}
              redirectTo="/products"
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cost breakdown · per unit</CardTitle>
            <CardDescription>
              Total =&nbsp;sponge + fabric + fiber + packaging + manufacturing.
              Allocations follow material volume share of each sponge block.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CostBar segments={segments} total={breakdown.totalCost} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Line
                icon={Layers}
                label="Sponge"
                value={formatLE(breakdown.spongeCost)}
              />
              <Line
                icon={Scissors}
                label="Fabric"
                value={formatLE(breakdown.fabricCost)}
              />
              <Line
                icon={Boxes}
                label="Fiber"
                value={formatLE(breakdown.fiberCost)}
              />
              <Line
                icon={PackageOpen}
                label="Packaging"
                value={formatLE(breakdown.packagingCost)}
              />
              <Line
                icon={Factory}
                label="Manufacturing"
                value={formatLE(breakdown.manufacturingCost)}
              />
              <Line
                icon={Sparkles}
                label="Total unit cost"
                value={formatLE(breakdown.totalCost)}
                emphasis
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing & profit</CardTitle>
            <CardDescription>Per single product unit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row
              label="Retail price"
              value={formatLE(breakdown.retailPrice)}
              hint="Listed to end customers"
            />
            <Row
              label="Wholesale price"
              value={formatLE(breakdown.wholesalePrice)}
              hint="Showroom partners"
            />
            <Separator />
            <Row
              label="Retail margin"
              value={formatLE(breakdown.retailProfit)}
              hint={`${pct(breakdown.retailMarginPct)} of retail`}
              accent
            />
            <Row
              label="Wholesale margin"
              value={formatLE(breakdown.wholesaleProfit)}
              hint={`${pct(breakdown.wholesaleMarginPct)} of wholesale`}
            />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="catalogue">
        <TabsList>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          <TabsTrigger value="sponges">Sponge cuts</TabsTrigger>
          <TabsTrigger value="fabrics">Fabric</TabsTrigger>
          <TabsTrigger value="bulk">Fiber & packaging</TabsTrigger>
          <TabsTrigger value="manufacturing">Manufacturing</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogue">
          <CatalogueBreakdown
            product={product}
            breakdown={breakdown}
            childCosts={childCosts}
          />
        </TabsContent>

        <TabsContent value="sponges">
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Block</TableHead>
                    <TableHead className="text-right">Cut size</TableHead>
                    <TableHead className="text-right">Cuts / unit</TableHead>
                    <TableHead className="text-right">Volume share</TableHead>
                    <TableHead className="text-right">Units / block</TableHead>
                    <TableHead className="text-right">Cost / unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.sponges.map((ps) => {
                    const blockCost = spongeBlockCost(ps.sponge);
                    const blockVol  = spongeBlockVolumeCm3(ps.sponge);

                    // Check if this block uses a shared cutting plan (yield-based)
                    const yieldEntry = ps.sponge.yields?.find(
                      (y) => y.productId === product.id,
                    );

                    if (yieldEntry) {
                      // Yield-based: cost = block cost ÷ units from cutting plan
                      const yieldCost = yieldEntry.unitsPerBlock > 0
                        ? blockCost / yieldEntry.unitsPerBlock
                        : 0;
                      return (
                        <TableRow key={ps.id}>
                          <TableCell>
                            <div className="font-medium">{ps.sponge.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {ps.sponge.widthCm} × {ps.sponge.depthCm} ×{" "}
                              {ps.sponge.heightCm} cm · density {ps.sponge.density}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground italic">
                            Via cutting plan
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {ps.cuts}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            —
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {yieldEntry.unitsPerBlock}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatLE(yieldCost)}
                          </TableCell>
                        </TableRow>
                      );
                    }

                    // Dimension-based allocation
                    const cutVol = cutVolumeCm3({
                      cutWidthCm: ps.cutWidthCm,
                      cutDepthCm: ps.cutDepthCm,
                      cutHeightCm: ps.cutHeightCm,
                      cuts: ps.cuts,
                    });
                    const units = ps.unitsPerBlockOverride
                      ? ps.unitsPerBlockOverride
                      : unitsPerBlock({
                          block: ps.sponge,
                          cuts: [
                            {
                              cutWidthCm: ps.cutWidthCm,
                              cutDepthCm: ps.cutDepthCm,
                              cutHeightCm: ps.cutHeightCm,
                              cuts: ps.cuts,
                            },
                          ],
                        });
                    const cost = ps.unitsPerBlockOverride
                      ? blockCost / ps.unitsPerBlockOverride
                      : blockVol > 0
                        ? (cutVol / blockVol) *
                          blockCost *
                          (1 / (1 - (ps.sponge.wastePct ?? 0) / 100))
                        : 0;
                    const hasDims = ps.cutWidthCm > 0 || ps.cutDepthCm > 0 || ps.cutHeightCm > 0;
                    return (
                      <TableRow key={ps.id}>
                        <TableCell>
                          <div className="font-medium">{ps.sponge.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {ps.sponge.widthCm} × {ps.sponge.depthCm} ×{" "}
                            {ps.sponge.heightCm} cm · density{" "}
                            {ps.sponge.density}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {hasDims
                            ? `${ps.cutWidthCm} × ${ps.cutDepthCm} × ${ps.cutHeightCm} cm`
                            : <span className="text-xs text-muted-foreground italic">Not set</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {ps.cuts}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {hasDims && blockVol > 0
                            ? `${((cutVol / blockVol) * 100).toFixed(1)}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {units > 0 ? units : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {cost > 0 ? formatLE(cost) : <span className="text-muted-foreground text-xs">Set dims above</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fabrics">
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fabric</TableHead>
                    <TableHead className="text-right">Meters / unit</TableHead>
                    <TableHead className="text-right">Cost / m</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.fabrics.map((pf) => (
                    <TableRow key={pf.id}>
                      <TableCell>
                        <div className="font-medium">{pf.fabric.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {pf.fabric.collection ?? ""}
                          {pf.fabric.color ? ` · ${pf.fabric.color}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pf.meters.toFixed(1)} m
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatLE(pf.fabric.costPerMeter)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLE(pf.meters * pf.fabric.costPerMeter)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Grams / unit</TableHead>
                    <TableHead className="text-right">Cost / kg</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.bulkMaterials.map((pb) => (
                    <TableRow key={pb.id}>
                      <TableCell className="font-medium">
                        {pb.bulkMaterial.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {pb.bulkMaterial.kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pb.grams.toFixed(0)} g
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatLE(pb.bulkMaterial.costPerKg)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLE((pb.grams / 1000) * pb.bulkMaterial.costPerKg)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manufacturing">
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.manufacturing.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{m.kind}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLE(m.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Line({
  icon: Icon,
  label,
  value,
  emphasis,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-3 ${
        emphasis ? "bg-secondary" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-md bg-secondary p-1.5 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className={emphasis ? "font-semibold" : "text-muted-foreground"}>
          {label}
        </span>
      </div>
      <div
        className={`tabular-nums ${emphasis ? "font-semibold text-base" : "font-medium"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  accent,
  children,
}: {
  label: string;
  value?: string;
  hint?: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <div className="text-sm text-muted-foreground">{label}</div>
        {hint && <div className="text-xs text-muted-foreground/80">{hint}</div>}
      </div>
      {children ?? (
        <div
          className={`tabular-nums ${accent ? "font-display text-lg font-semibold" : "font-medium"}`}
        >
          {value}
        </div>
      )}
    </div>
  );
}
