import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddFabricButton } from "@/components/row-actions/add-buttons";
import { FabricRowActions } from "@/components/row-actions/fabric-row-actions";
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
import { formatLE } from "@/lib/costing";

export const dynamic = "force-dynamic";

const DEMO = [
  {
    id: "f1",
    name: "Twix Reef",
    collection: "Twix",
    color: "Sand",
    texture: "Velvet",
    costPerMeter: 210,
    stockMeters: 480,
    reorderLevel: 80,
    supplier: { name: "Nile Textile House" },
  },
  {
    id: "f2",
    name: "Spaniol",
    collection: "Spaniol",
    color: "Charcoal",
    texture: "Boucle",
    costPerMeter: 245,
    stockMeters: 320,
    reorderLevel: 60,
    supplier: { name: "Nile Textile House" },
  },
  {
    id: "f3",
    name: "Australian",
    collection: "Australian",
    color: "Cream",
    texture: "Linen",
    costPerMeter: 195,
    stockMeters: 540,
    reorderLevel: 80,
    supplier: { name: "Nile Textile House" },
  },
];

async function getFabrics() {
  try {
    return await prisma.fabric.findMany({
      include: { supplier: true },
      orderBy: { name: "asc" },
    });
  } catch {
    return DEMO;
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

export default async function FabricsPage() {
  const [fabrics, suppliers, writeAccess, adminAccess] = await Promise.all([
    getFabrics(),
    getSuppliers(),
    canWrite(),
    isAdmin(),
  ]);
  const inventoryValue = fabrics.reduce(
    (a, f) => a + f.stockMeters * f.costPerMeter,
    0,
  );
  return (
    <div className="space-y-8">
      <PageHeader
        title="Fabrics"
        description="Collections, cost-per-meter, and rolling stock for upholstery."
        actions={writeAccess ? <AddFabricButton suppliers={suppliers} /> : null}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Inventory value" value={formatLE(inventoryValue)} />
        <Tile
          label="Total stock"
          value={`${fabrics
            .reduce((a, f) => a + f.stockMeters, 0)
            .toFixed(0)} m`}
        />
        <Tile label="Active collections" value={`${fabrics.length}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All fabrics</CardTitle>
          <CardDescription>
            Stock bar turns amber when at or below reorder level.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fabric</TableHead>
                <TableHead>Texture</TableHead>
                <TableHead className="text-right">Cost / m</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Supplier</TableHead>
                {writeAccess && <TableHead className="w-px" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {fabrics.map((f) => {
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
                      <Badge variant="secondary">{f.texture ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatLE(f.costPerMeter)}
                    </TableCell>
                    <TableCell>
                      <div className="flex w-48 flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="tabular-nums font-medium">
                            {f.stockMeters.toFixed(0)} m
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
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {f.supplier?.name ?? "—"}
                    </TableCell>
                    {writeAccess && (
                      <TableCell className="text-right">
                        <FabricRowActions
                          fabric={{
                            id: f.id,
                            name: f.name,
                            collection: f.collection ?? null,
                            color: f.color ?? null,
                            texture: f.texture ?? null,
                            costPerMeter: f.costPerMeter,
                            stockMeters: f.stockMeters,
                            reorderLevel: f.reorderLevel,
                            supplierId:
                              ("supplierId" in f
                                ? (f as { supplierId: string | null })
                                    .supplierId
                                : null) ?? null,
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
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {value}
      </div>
    </Card>
  );
}
