import Link from "next/link";
import { Layers, PackageOpen, Scissors, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { formatLE, spongeBlockCost } from "@/lib/costing";
import { formatNumber } from "@/lib/utils";
import { canWrite, isAdmin } from "@/lib/rbac";
import {
  AddSpongeButton,
  AddFabricButton,
  AddBulkButton,
} from "@/components/row-actions/add-buttons";
import { SpongeRowActions } from "@/components/row-actions/sponge-row-actions";
import { FabricRowActions } from "@/components/row-actions/fabric-row-actions";
import { BulkRowActions } from "@/components/row-actions/bulk-row-actions";

export const dynamic = "force-dynamic";

async function load() {
  try {
    const [sponges, fabrics, bulks, products, suppliers] = await Promise.all([
      prisma.sponge.findMany({ orderBy: { name: "asc" } }),
      prisma.fabric.findMany({ orderBy: { name: "asc" } }),
      prisma.bulkMaterial.findMany({ orderBy: { name: "asc" } }),
      prisma.product.findMany({ orderBy: { name: "asc" } }),
      prisma.supplier.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { sponges, fabrics, bulks, products, suppliers, ready: true as const };
  } catch {
    return {
      sponges: [] as Awaited<ReturnType<typeof prisma.sponge.findMany>>,
      fabrics: [] as Awaited<ReturnType<typeof prisma.fabric.findMany>>,
      bulks: [] as Awaited<ReturnType<typeof prisma.bulkMaterial.findMany>>,
      products: [] as Awaited<ReturnType<typeof prisma.product.findMany>>,
      suppliers: [] as { id: string; name: string }[],
      ready: false as const,
    };
  }
}

export default async function InventoryPage() {
  const [{ sponges, fabrics, bulks, products, suppliers }, writeAccess, adminAccess] =
    await Promise.all([load(), canWrite(), isAdmin()]);

  const spongeValue = sponges.reduce(
    (a, s) => a + spongeBlockCost(s) * s.stockBlocks,
    0,
  );
  const fabricValue = fabrics.reduce(
    (a, f) => a + f.costPerMeter * f.stockMeters,
    0,
  );
  const bulkValue = bulks.reduce((a, b) => a + b.costPerKg * b.stockKg, 0);
  const finishedValue = products.reduce(
    (a, p) => a + p.retailPrice * p.stockQty,
    0,
  );
  const total = spongeValue + fabricValue + bulkValue + finishedValue;

  const totalBlocks = sponges.reduce((a, s) => a + s.stockBlocks, 0);
  const totalMeters = fabrics.reduce((a, f) => a + f.stockMeters, 0);
  const totalKg = bulks.reduce((a, b) => a + b.stockKg, 0);
  const lowStock = [
    ...sponges.filter((s) => s.stockBlocks <= 3),
    ...fabrics.filter((f) => f.stockMeters <= f.reorderLevel),
    ...bulks.filter((b) => b.stockKg <= b.reorderLevel),
  ];

  const valueRows = [
    {
      icon: Layers,
      label: "Sponge blocks",
      value: spongeValue,
      color: "bg-sand-400",
    },
    {
      icon: Scissors,
      label: "Fabric",
      value: fabricValue,
      color: "bg-sky-400",
    },
    {
      icon: PackageOpen,
      label: "Fiber & packaging",
      value: bulkValue,
      color: "bg-emerald-400",
    },
    {
      icon: ShoppingBag,
      label: "Finished products (retail)",
      value: finishedValue,
      color: "bg-rose-400",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Inventory"
        description="Stock levels and locked-in value across every material and finished product."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Sponge stock"
          value={`${formatNumber(Math.round(totalBlocks))} blocks`}
          hint={formatLE(spongeValue)}
        />
        <Tile
          label="Fabric stock"
          value={`${formatNumber(Math.round(totalMeters))} m`}
          hint={formatLE(fabricValue)}
        />
        <Tile
          label="Bulk stock"
          value={`${totalKg.toFixed(1)} kg`}
          hint={formatLE(bulkValue)}
        />
        <Tile
          label="Total inventory value"
          value={formatLE(total)}
          hint={
            lowStock.length > 0
              ? `${lowStock.length} item(s) below reorder`
              : "Stock healthy"
          }
          warning={lowStock.length > 0}
        />
      </div>

      {/* ── Sponge stock ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Sponge blocks</CardTitle>
            <CardDescription>
              Stock-by-block · click a name to open the detail page.
            </CardDescription>
          </div>
          {writeAccess && <AddSpongeButton suppliers={suppliers} />}
        </CardHeader>
        <CardContent className="px-0">
          {sponges.length === 0 ? (
            <Empty>No sponge blocks yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Block</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Stock value</TableHead>
                  {writeAccess && <TableHead className="w-px" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponges.map((s) => {
                  const cost = spongeBlockCost(s);
                  const value = cost * s.stockBlocks;
                  const low = s.stockBlocks <= 3;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          href={`/sponges/${s.id}`}
                          className="font-medium hover:underline"
                        >
                          {s.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {s.density} kg/m³ · {s.color}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <span className="tabular-nums font-semibold">
                            {s.stockBlocks}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            blocks
                          </span>
                          {low && <Badge variant="warning">Low</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatLE(cost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLE(value)}
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
                              supplierId: s.supplierId,
                              manufactureDate: s.manufactureDate,
                              notes: s.notes,
                            }}
                            suppliers={suppliers}
                            canDelete={adminAccess}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Fabric stock ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Fabric</CardTitle>
            <CardDescription>
              Stock in meters · the bar shows progress toward your reorder
              threshold.
            </CardDescription>
          </div>
          {writeAccess && <AddFabricButton suppliers={suppliers} />}
        </CardHeader>
        <CardContent className="px-0">
          {fabrics.length === 0 ? (
            <Empty>No fabrics yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fabric</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Cost / m</TableHead>
                  <TableHead className="text-right">Stock value</TableHead>
                  {writeAccess && <TableHead className="w-px" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fabrics.map((f) => {
                  const value = f.costPerMeter * f.stockMeters;
                  const low = f.stockMeters <= f.reorderLevel;
                  const pct = Math.min(100, (f.stockMeters / 600) * 100);
                  return (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="font-medium">{f.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.collection ?? ""} · {f.color ?? ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex w-44 flex-col gap-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="tabular-nums font-medium">
                              {f.stockMeters.toFixed(1)} m
                            </span>
                            {low && <Badge variant="warning">Reorder</Badge>}
                          </div>
                          <Progress
                            value={pct}
                            indicatorClassName={
                              low ? "bg-amber-500" : "bg-primary"
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatLE(f.costPerMeter)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLE(value)}
                      </TableCell>
                      {writeAccess && (
                        <TableCell className="text-right">
                          <FabricRowActions
                            fabric={{
                              id: f.id,
                              name: f.name,
                              collection: f.collection,
                              color: f.color,
                              texture: f.texture,
                              costPerMeter: f.costPerMeter,
                              stockMeters: f.stockMeters,
                              reorderLevel: f.reorderLevel,
                              supplierId: f.supplierId,
                            }}
                            suppliers={suppliers}
                            canDelete={adminAccess}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Bulk material stock ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Fiber, packaging & extras</CardTitle>
            <CardDescription>Stock in kilograms.</CardDescription>
          </div>
          {writeAccess && <AddBulkButton />}
        </CardHeader>
        <CardContent className="px-0">
          {bulks.length === 0 ? (
            <Empty>No bulk materials yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Cost / kg</TableHead>
                  <TableHead className="text-right">Stock value</TableHead>
                  {writeAccess && <TableHead className="w-px" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulks.map((b) => {
                  const value = b.costPerKg * b.stockKg;
                  const low = b.stockKg <= b.reorderLevel;
                  const pct = Math.min(100, (b.stockKg / 200) * 100);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={b.kind === "FIBER" ? "info" : "secondary"}
                        >
                          {b.kind}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex w-44 flex-col gap-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="tabular-nums font-medium">
                              {b.stockKg.toFixed(1)} kg
                            </span>
                            {low && <Badge variant="warning">Reorder</Badge>}
                          </div>
                          <Progress
                            value={pct}
                            indicatorClassName={
                              low ? "bg-amber-500" : "bg-primary"
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatLE(b.costPerKg)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLE(value)}
                      </TableCell>
                      {writeAccess && (
                        <TableCell className="text-right">
                          <BulkRowActions
                            bulk={{
                              id: b.id,
                              name: b.name,
                              kind: b.kind,
                              costPerKg: b.costPerKg,
                              stockKg: b.stockKg,
                              reorderLevel: b.reorderLevel,
                            }}
                            canDelete={adminAccess}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Value mix ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Locked-in value mix</CardTitle>
          <CardDescription>
            How total inventory value splits across raw materials and finished
            goods.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="font-display text-3xl font-semibold tracking-tight">
            {formatLE(total)}
          </div>
          <div className="space-y-3">
            {valueRows.map((r) => {
              const Icon = r.icon;
              const pct = total > 0 ? (r.value / total) * 100 : 0;
              return (
                <div key={r.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-md bg-secondary p-1.5 text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {r.label}
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatLE(r.value)}{" "}
                      <span className="text-muted-foreground">
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <Progress value={pct} indicatorClassName={r.color} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  warning,
}: {
  label: string;
  value: string;
  hint?: string;
  warning?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {value}
      </div>
      {hint && (
        <div
          className={
            warning
              ? "mt-1 text-xs font-medium text-amber-700 dark:text-amber-300"
              : "mt-1 text-xs text-muted-foreground"
          }
        >
          {hint}
        </div>
      )}
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
