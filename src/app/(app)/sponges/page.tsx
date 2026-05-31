import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddSpongeButton } from "@/components/row-actions/add-buttons";
import { SpongeRowActions } from "@/components/row-actions/sponge-row-actions";
import { canWrite, isAdmin } from "@/lib/rbac";
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
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import {
  cutVolumeCm3,
  formatLE,
  spongeBlockCost,
  spongeBlockVolumeCm3,
} from "@/lib/costing";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEMO_SPONGES = [
  {
    id: "demo-1",
    name: "Yellow 26 Soft",
    density: 26,
    hardness: "SOFT",
    color: "Yellow",
    widthCm: 240,
    depthCm: 200,
    heightCm: 120,
    pricePerDensity: 220,
    stockBlocks: 18,
    wastePct: 6,
    supplier: { name: "Cairo Foam Industries" },
  },
  {
    id: "demo-2",
    name: "Blue 32 Medium",
    density: 32,
    hardness: "MEDIUM",
    color: "Blue",
    widthCm: 240,
    depthCm: 200,
    heightCm: 100,
    pricePerDensity: 235,
    stockBlocks: 12,
    wastePct: 5,
    supplier: { name: "Cairo Foam Industries" },
  },
  {
    id: "demo-3",
    name: "Grey 40 Hard",
    density: 40,
    hardness: "HARD",
    color: "Grey",
    widthCm: 200,
    depthCm: 180,
    heightCm: 80,
    pricePerDensity: 260,
    stockBlocks: 3,
    wastePct: 4,
    supplier: { name: "Cairo Foam Industries" },
  },
];

async function getSponges() {
  try {
    return await prisma.sponge.findMany({
      include: {
        supplier: true,
        yields: true,
        productUsages: true,
      },
      orderBy: { name: "asc" },
    });
  } catch {
    return DEMO_SPONGES;
  }
}

async function getSuppliers() {
  try {
    return await prisma.supplier.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

async function getProducts() {
  try {
    return await prisma.product.findMany({
      select: { id: true, name: true, sku: true },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

const HARDNESS_VARIANT: Record<string, "secondary" | "info" | "warning" | "destructive"> = {
  SOFT: "info",
  MEDIUM: "secondary",
  HARD: "warning",
  EXTRA_HARD: "destructive",
};

export default async function SpongesPage() {
  const [sponges, suppliers, products, writeAccess, adminAccess] =
    await Promise.all([
      getSponges(),
      getSuppliers(),
      getProducts(),
      canWrite(),
      isAdmin(),
    ]);

  // For the new-sponge button we don't know the cut volume yet (no block to
  // measure against), so default to 0 — the form lets users still pick a
  // product and just won't show a volume share until they fill in dims.
  const productsForNew = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    cutVolumePerUnit: 0,
  }));

  const totalValue = sponges.reduce(
    (acc, s) =>
      acc +
      spongeBlockCost({
        widthCm: s.widthCm,
        depthCm: s.depthCm,
        heightCm: s.heightCm,
        density: s.density,
        pricePerDensity: s.pricePerDensity,
      }) *
        s.stockBlocks,
    0,
  );
  const totalVolumeM3 =
    sponges.reduce(
      (acc, s) => acc + spongeBlockVolumeCm3(s) * s.stockBlocks,
      0,
    ) / 1_000_000;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sponge inventory"
        description="Every block is priced with W × D × H × density × price-multiplier. Edit a block to see live cost update."
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/api/exports/sponges.xlsx" download>
                Export
              </a>
            </Button>
            {writeAccess && (
              <AddSpongeButton
                suppliers={suppliers}
                products={productsForNew}
              />
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Stock value" value={formatLE(totalValue)} />
        <StatTile
          label="Total volume on hand"
          value={`${totalVolumeM3.toFixed(1)} m³`}
        />
        <StatTile
          label="Block variants"
          value={formatNumber(sponges.length)}
          hint="Active SKUs"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All sponge blocks</CardTitle>
          <CardDescription>
            Click a row to edit dimensions, density and pricing.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Block</TableHead>
                <TableHead>Hardness</TableHead>
                <TableHead className="text-right">Dimensions</TableHead>
                <TableHead className="text-right">Density</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Manufactured</TableHead>
                <TableHead className="text-right">Supplier</TableHead>
                {writeAccess && <TableHead className="w-px" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponges.map((s) => {
                const cost = spongeBlockCost({
                  widthCm: s.widthCm,
                  depthCm: s.depthCm,
                  heightCm: s.heightCm,
                  density: s.density,
                  pricePerDensity: s.pricePerDensity,
                });
                const stockPct = Math.min(100, (s.stockBlocks / 20) * 100);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link
                        href={`/sponges/${s.id}`}
                        className="group inline-flex items-center gap-3"
                      >
                        <span
                          className="h-8 w-8 rounded-lg border"
                          style={{
                            background: colorForName(s.color),
                          }}
                          aria-hidden
                        />
                        <span>
                          <span className="font-medium group-hover:underline">
                            {s.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Color: {s.color} · waste {s.wastePct}%
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={HARDNESS_VARIANT[s.hardness] ?? "secondary"}>
                        {humanize(s.hardness)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {s.widthCm} × {s.depthCm} × {s.heightCm}{" "}
                      <span className="text-muted-foreground">cm</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.density}{" "}
                      <span className="text-muted-foreground text-xs">
                        kg/m³
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatLE(cost)}
                    </TableCell>
                    <TableCell>
                      <div className="flex w-32 flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="tabular-nums font-medium">
                            {s.stockBlocks}
                          </span>
                          <span className="text-muted-foreground">blocks</span>
                        </div>
                        <Progress
                          value={stockPct}
                          indicatorClassName={
                            s.stockBlocks <= 3
                              ? "bg-amber-500"
                              : "bg-primary"
                          }
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatManufactureDate(
                        "manufactureDate" in s
                          ? (s as { manufactureDate: Date | string | null })
                              .manufactureDate
                          : null,
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {s.supplier?.name ?? "—"}
                    </TableCell>
                    {writeAccess && (
                      <TableCell className="text-right">
                        <SpongeRowActions
                          sponge={{
                            id: s.id,
                            name: s.name,
                            color: s.color,
                            hardness: s.hardness,
                            density: s.density,
                            widthCm: s.widthCm,
                            depthCm: s.depthCm,
                            heightCm: s.heightCm,
                            pricePerDensity: s.pricePerDensity,
                            stockBlocks: s.stockBlocks,
                            wastePct: s.wastePct,
                            supplierId:
                              ("supplierId" in s
                                ? (s as { supplierId: string | null }).supplierId
                                : null) ?? null,
                            manufactureDate:
                              ("manufactureDate" in s
                                ? (
                                    s as {
                                      manufactureDate: Date | string | null;
                                    }
                                  ).manufactureDate
                                : null) ?? null,
                            notes:
                              ("notes" in s
                                ? (s as { notes: string | null }).notes
                                : null) ?? null,
                          }}
                          suppliers={suppliers}
                          products={productsForSponge(s, products)}
                          initialYields={yieldsForSponge(s, products)}
                          canDelete={adminAccess}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function humanize(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function formatManufactureDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type SpongeWithYields = {
  id: string;
  productUsages?: {
    productId: string;
    cutWidthCm: number;
    cutDepthCm: number;
    cutHeightCm: number;
    cuts: number;
  }[];
  yields?: { productId: string; unitsPerBlock: number }[];
};

/** Build the ProductForYield list for a sponge — every product that has a
 *  BOM cut on this block gets its cut volume; others come through with 0. */
function productsForSponge(
  sponge: SpongeWithYields,
  products: { id: string; name: string; sku: string }[],
) {
  const cutByProduct = new Map<string, number>();
  for (const pu of sponge.productUsages ?? []) {
    cutByProduct.set(pu.productId, cutVolumeCm3(pu));
  }
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    cutVolumePerUnit: cutByProduct.get(p.id) ?? 0,
  }));
}

function yieldsForSponge(
  sponge: SpongeWithYields,
  products: { id: string; name: string; sku: string }[],
) {
  const cutByProduct = new Map<string, number>();
  for (const pu of sponge.productUsages ?? []) {
    cutByProduct.set(pu.productId, cutVolumeCm3(pu));
  }
  const valid = new Set(products.map((p) => p.id));
  return (sponge.yields ?? [])
    .filter((y) => valid.has(y.productId))
    .map((y) => ({
      productId: y.productId,
      unitsPerBlock: y.unitsPerBlock,
      cutVolumePerUnit: cutByProduct.get(y.productId) ?? 0,
    }));
}

function colorForName(c: string) {
  const map: Record<string, string> = {
    Yellow: "#F5D982",
    Blue: "#9DBEDC",
    Grey: "#B7B7B7",
    Cream: "#EFE3CB",
  };
  return map[c] ?? "#D6C4A6";
}
