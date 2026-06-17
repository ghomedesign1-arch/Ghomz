import { Badge } from "@/components/ui/badge";
import { AddPocketCoilButton } from "@/components/row-actions/add-buttons";
import { PocketCoilRowActions } from "@/components/row-actions/pocket-coil-row-actions";
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

async function getCoils() {
  return prisma.pocketCoil.findMany({
    include: { supplier: true },
    orderBy: { name: "asc" },
  });
}

async function getSuppliers() {
  return prisma.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export default async function PocketCoilsPage() {
  const [coils, suppliers, writeAccess, adminAccess] = await Promise.all([
    getCoils(),
    getSuppliers(),
    canWrite(),
    isAdmin(),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader
        title="Pocket coils"
        description="Individual springs used inside seats and beds. Priced per coil, counted in pieces."
        actions={
          writeAccess ? <AddPocketCoilButton suppliers={suppliers} /> : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Coils</CardTitle>
          <CardDescription>
            Conversion:{" "}
            <code className="rounded bg-secondary px-1 py-0.5">
              quantity × cost / coil
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {coils.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-muted-foreground">
              No pocket coils yet. Add one to start consuming them in product
              BOMs.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Cost / coil</TableHead>
                  <TableHead>Stock</TableHead>
                  {writeAccess && <TableHead className="w-px" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {coils.map((c) => {
                  const low = c.stockUnits <= c.reorderLevel;
                  const denom = Math.max(c.reorderLevel * 4, 500);
                  const pct = Math.min(100, (c.stockUnits / denom) * 100);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.supplier?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLE(c.costPerUnit)}
                      </TableCell>
                      <TableCell>
                        <div className="flex w-48 flex-col gap-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="tabular-nums font-medium">
                              {c.stockUnits.toLocaleString()} coils
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
                      {writeAccess && (
                        <TableCell className="text-right">
                          <PocketCoilRowActions
                            coil={{
                              id: c.id,
                              name: c.name,
                              costPerUnit: c.costPerUnit,
                              stockUnits: c.stockUnits,
                              reorderLevel: c.reorderLevel,
                              supplierId: c.supplierId,
                              notes: c.notes,
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
    </div>
  );
}
