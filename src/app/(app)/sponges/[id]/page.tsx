import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Layers, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import {
  cutVolumeCm3,
  formatLE,
  spongeBlockCost,
  spongeBlockVolumeCm3,
  unitsPerBlock,
} from "@/lib/costing";
import { canWrite, isAdmin } from "@/lib/rbac";
import { SpongeRowActions } from "@/components/row-actions/sponge-row-actions";
import {
  EditYieldsDialog,
  type YieldProductOption,
} from "@/components/dialogs/edit-yields-dialog";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function SpongeDetailPage({ params }: PageProps) {
  const sponge = await prisma.sponge.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      productUsages: { include: { product: true } },
      yields: { include: { product: true } },
      consumptions: {
        include: { productionLog: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!sponge) notFound();

  const intakeItems = await prisma.purchaseItem.findMany({
    where: { kind: "SPONGE", referenceId: params.id },
    include: {
      purchase: {
        include: {
          supplier: true,
          createdBy: { select: { name: true } },
        },
      },
    },
    orderBy: { purchase: { createdAt: "desc" } },
    take: 20,
  });

  const intakeTotalBlocks = intakeItems.reduce(
    (a, i) => a + i.quantity,
    0,
  );
  const intakeTotalSpent = intakeItems.reduce((a, i) => a + i.totalCost, 0);

  const [suppliers, writeAccess, adminAccess] = await Promise.all([
    prisma.supplier.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    canWrite(),
    isAdmin(),
  ]);

  const unitCost = spongeBlockCost(sponge);
  const volumeCm3 = spongeBlockVolumeCm3(sponge);
  const stockValue = unitCost * sponge.stockBlocks;
  const stockBarPct = Math.min(100, (sponge.stockBlocks / 20) * 100);
  const lowStock = sponge.stockBlocks <= 3;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/sponges">
          <ArrowLeft className="h-4 w-4" /> All sponges
        </Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{humanize(sponge.hardness)}</Badge>
            <Badge variant="outline">{sponge.color}</Badge>
            <Badge variant="outline">Density {sponge.density} kg/m³</Badge>
            {lowStock && <Badge variant="warning">Low stock</Badge>}
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {sponge.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sponge.widthCm} × {sponge.depthCm} × {sponge.heightCm} cm ·{" "}
            {(volumeCm3 / 1_000_000).toFixed(3)} m³ per block · waste{" "}
            {sponge.wastePct}%
            {sponge.manufactureDate && (
              <>
                {" "}
                · manufactured{" "}
                {new Date(sponge.manufactureDate).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </>
            )}
          </p>
        </div>
        {writeAccess && (
          <SpongeRowActions
            sponge={{
              id: sponge.id,
              name: sponge.name,
              color: sponge.color,
              hardness: sponge.hardness,
              density: sponge.density,
              widthCm: sponge.widthCm,
              depthCm: sponge.depthCm,
              heightCm: sponge.heightCm,
              pricePerDensity: sponge.pricePerDensity,
              stockBlocks: sponge.stockBlocks,
              wastePct: sponge.wastePct,
              supplierId: sponge.supplierId,
              manufactureDate: sponge.manufactureDate,
              notes: sponge.notes,
            }}
            suppliers={suppliers}
            canDelete={adminAccess}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Unit cost" value={formatLE(unitCost)} icon={Layers} />
        <Tile
          label="Stock value"
          value={formatLE(stockValue)}
          hint={`${sponge.stockBlocks} blocks on hand`}
        />
        <Tile
          label="Manufacture date"
          value={
            sponge.manufactureDate
              ? new Date(sponge.manufactureDate).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—"
          }
          hint={
            sponge.manufactureDate ? ageHint(sponge.manufactureDate) : undefined
          }
          icon={CalendarDays}
        />
        <Tile
          label="Supplier"
          value={sponge.supplier?.name ?? "—"}
          icon={Truck}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock</CardTitle>
          <CardDescription>
            Bar turns amber when ≤ 3 blocks remain (default reorder threshold).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="tabular-nums font-medium">
              {sponge.stockBlocks} blocks
            </span>
            <span className="text-muted-foreground">
              {formatLE(stockValue)} locked-in
            </span>
          </div>
          <Progress
            value={stockBarPct}
            indicatorClassName={lowStock ? "bg-amber-500" : "bg-primary"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Used in products</CardTitle>
          <CardDescription>
            Cut sizes and how many units of each product fit inside one block.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {sponge.productUsages.length === 0 ? (
            <Empty>No products currently use this sponge.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Cut</TableHead>
                  <TableHead className="text-right">Cuts / unit</TableHead>
                  <TableHead className="text-right">Volume share</TableHead>
                  <TableHead className="text-right">Units / block</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponge.productUsages.map((u) => {
                  const cut = {
                    cutWidthCm: u.cutWidthCm,
                    cutDepthCm: u.cutDepthCm,
                    cutHeightCm: u.cutHeightCm,
                    cuts: u.cuts,
                  };
                  const vol = cutVolumeCm3(cut);
                  const share = volumeCm3 > 0 ? (vol / volumeCm3) * 100 : 0;
                  const units = unitsPerBlock({ block: sponge, cuts: [cut] });
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Link
                          href={`/products/${u.productId}`}
                          className="font-medium hover:underline"
                        >
                          {u.product.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {u.product.sku}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {u.cutWidthCm} × {u.cutDepthCm} × {u.cutHeightCm} cm
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {u.cuts}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {share.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {units > 0 ? units : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CuttingPlanCard
        sponge={sponge}
        unitCost={unitCost}
        volumeCm3={volumeCm3}
        writeAccess={writeAccess}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Intake history</CardTitle>
            <CardDescription>
              Every batch of this block received from a supplier — total{" "}
              <strong>{Math.round(intakeTotalBlocks)} blocks</strong> at{" "}
              <strong>{formatLE(intakeTotalSpent)}</strong>.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/sponges/intake">All intake</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {intakeItems.length === 0 ? (
            <Empty>
              No intake recorded for this block yet. Record a purchase to start
              tracking deliveries.
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Qty (blocks)</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intakeItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">
                      {item.purchase.createdAt.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {item.purchase.supplier?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.purchase.reference ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {Math.round(item.quantity)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatLE(item.unitCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatLE(item.totalCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent consumption</CardTitle>
          <CardDescription>
            Last 10 production runs that drew from this block.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {sponge.consumptions.length === 0 ? (
            <Empty>This sponge hasn&apos;t been consumed by any run yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Blocks used</TableHead>
                  <TableHead className="text-right">Waste</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponge.consumptions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">
                      {c.createdAt.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.productionLog.product.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.productionLog.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.blocksUsed.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {(c.wasteCm3 / 1_000_000).toFixed(3)} m³
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {sponge.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{sponge.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="font-display text-2xl font-semibold tracking-tight">
            {value}
          </div>
          {hint && (
            <div className="text-xs text-muted-foreground">{hint}</div>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-secondary p-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ageHint(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const days = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return "future-dated";
  if (days === 0) return "today";
  if (days === 1) return "1 day old";
  if (days < 30) return `${days} days old`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month old";
  if (months < 12) return `${months} months old`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year old" : `${years} years old`;
}

function humanize(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function CuttingPlanCard({
  sponge,
  unitCost,
  volumeCm3,
  writeAccess,
}: {
  sponge: {
    id: string;
    name: string;
    productUsages: {
      productId: string;
      cutWidthCm: number;
      cutDepthCm: number;
      cutHeightCm: number;
      cuts: number;
      product: { id: string; name: string; sku: string };
    }[];
    yields: {
      productId: string;
      unitsPerBlock: number;
      product: { id: string; name: string; sku: string };
    }[];
  };
  unitCost: number;
  volumeCm3: number;
  writeAccess: boolean;
}) {
  // Map productId → cut volume from this block (from ProductSponge entries)
  const cutByProduct = new Map<string, number>();
  for (const u of sponge.productUsages) {
    cutByProduct.set(
      u.productId,
      cutVolumeCm3({
        cutWidthCm: u.cutWidthCm,
        cutDepthCm: u.cutDepthCm,
        cutHeightCm: u.cutHeightCm,
        cuts: u.cuts,
      }),
    );
  }

  // Build the product picker options for the dialog: every product with a BOM
  // line on this block. (Could be extended to "all products" later.)
  const products: YieldProductOption[] = sponge.productUsages.map((u) => ({
    id: u.productId,
    name: u.product.name,
    sku: u.product.sku,
    cutVolumePerUnit: cutByProduct.get(u.productId) ?? 0,
  }));

  const totalUsed = sponge.yields.reduce(
    (acc, y) =>
      acc + (cutByProduct.get(y.productId) ?? 0) * y.unitsPerBlock,
    0,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Cutting plan</CardTitle>
          <CardDescription>
            One block can produce a mix of products — e.g. <em>2 sofas + 6 chairs</em>.
            Block cost is split across these products by volume share.
          </CardDescription>
        </div>
        {writeAccess && (
          <EditYieldsDialog
            spongeId={sponge.id}
            spongeName={sponge.name}
            blockVolumeCm3={volumeCm3}
            blockCost={unitCost}
            products={products}
            initial={sponge.yields.map((y) => ({
              productId: y.productId,
              unitsPerBlock: y.unitsPerBlock,
            }))}
          />
        )}
      </CardHeader>
      <CardContent className="px-0">
        {sponge.yields.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No cutting plan defined yet. Each product&apos;s sponge cost falls
            back to per-product allocation with the block&apos;s waste %.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Units / block</TableHead>
                <TableHead className="text-right">Volume share</TableHead>
                <TableHead className="text-right">Cost / unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponge.yields.map((y) => {
                const cut = cutByProduct.get(y.productId) ?? 0;
                const used = cut * y.unitsPerBlock;
                const share = totalUsed > 0 ? (used / totalUsed) * 100 : 0;
                const perUnit =
                  y.unitsPerBlock > 0 && totalUsed > 0
                    ? (used / totalUsed) * unitCost / y.unitsPerBlock
                    : 0;
                return (
                  <TableRow key={y.productId}>
                    <TableCell>
                      <Link
                        href={`/products/${y.productId}`}
                        className="font-medium hover:underline"
                      >
                        {y.product.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {y.product.sku}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {y.unitsPerBlock}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {share.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatLE(perUnit)}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell className="text-sm font-medium">Total</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {(totalUsed / 1_000_000).toFixed(3)} m³ used ·{" "}
                  {((totalUsed / volumeCm3) * 100).toFixed(1)}% of block
                </TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums font-medium">
                  {formatLE(unitCost)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
