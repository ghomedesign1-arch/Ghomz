import { Badge } from "@/components/ui/badge";
import { AddBulkButton } from "@/components/row-actions/add-buttons";
import { BulkRowActions } from "@/components/row-actions/bulk-row-actions";
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
    id: "b1",
    name: "Polyester fiber",
    kind: "FIBER",
    costPerKg: 250,
    stockKg: 120,
    reorderLevel: 20,
  },
  {
    id: "b2",
    name: "Vaseline (compression wrap)",
    kind: "PACKAGING",
    costPerKg: 50,
    stockKg: 80,
    reorderLevel: 15,
  },
];

async function getBulk() {
  try {
    return await prisma.bulkMaterial.findMany({ orderBy: { name: "asc" } });
  } catch {
    return DEMO;
  }
}

export default async function MaterialsPage() {
  const [bulk, writeAccess, adminAccess] = await Promise.all([
    getBulk(),
    canWrite(),
    isAdmin(),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader
        title="Bulk materials"
        description="Fiber, packaging and extras priced per kilogram. Product BOMs consume in grams."
        actions={writeAccess ? <AddBulkButton /> : null}
      />

      <Card>
        <CardHeader>
          <CardTitle>Fiber & packaging</CardTitle>
          <CardDescription>
            Conversion: <code className="rounded bg-secondary px-1 py-0.5">g ÷ 1000 × cost/kg</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Cost / kg</TableHead>
                <TableHead>Stock</TableHead>
                {writeAccess && <TableHead className="w-px" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bulk.map((b) => {
                const low = b.stockKg <= b.reorderLevel;
                const pct = Math.min(100, (b.stockKg / 200) * 100);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      <Badge variant={b.kind === "FIBER" ? "info" : "secondary"}>
                        {b.kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatLE(b.costPerKg)}
                    </TableCell>
                    <TableCell>
                      <div className="flex w-48 flex-col gap-1.5">
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
        </CardContent>
      </Card>
    </div>
  );
}
