import { Badge } from "@/components/ui/badge";
import { AddSupplierButton } from "@/components/row-actions/add-buttons";
import { SupplierRowActions } from "@/components/row-actions/supplier-row-actions";
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
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEMO = [
  {
    id: "s1",
    name: "Cairo Foam Industries",
    contact: "Mostafa Adel",
    phone: "+20 100 000 1111",
    email: "sales@cairofoam.eg",
    _count: { sponges: 3, fabrics: 0, purchases: 5 },
  },
  {
    id: "s2",
    name: "Nile Textile House",
    contact: "Salma Nabil",
    phone: "+20 100 000 2222",
    email: "orders@niletextile.eg",
    _count: { sponges: 0, fabrics: 3, purchases: 4 },
  },
];

async function getSuppliers() {
  try {
    return await prisma.supplier.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { sponges: true, fabrics: true, purchases: true } } },
    });
  } catch {
    return DEMO;
  }
}

export default async function SuppliersPage() {
  const [suppliers, writeAccess, adminAccess] = await Promise.all([
    getSuppliers(),
    canWrite(),
    isAdmin(),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader
        title="Suppliers"
        description="Vendors providing sponge blocks, fabrics, and bulk materials."
        actions={writeAccess ? <AddSupplierButton /> : null}
      />

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>
            Linked to purchase orders, sponges and fabrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                {writeAccess && <TableHead className="w-px" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{s.contact ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.phone}
                    </div>
                  </TableCell>
                  <TableCell className="space-x-1">
                    {s._count.sponges > 0 && (
                      <Badge variant="secondary">
                        Sponge × {s._count.sponges}
                      </Badge>
                    )}
                    {s._count.fabrics > 0 && (
                      <Badge variant="info">Fabric × {s._count.fabrics}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s._count.purchases}
                  </TableCell>
                  {writeAccess && (
                    <TableCell className="text-right">
                      <SupplierRowActions
                        supplier={{
                          id: s.id,
                          name: s.name,
                          contact: s.contact ?? null,
                          phone: s.phone ?? null,
                          email: s.email ?? null,
                          address:
                            ("address" in s
                              ? (s as { address: string | null }).address
                              : null) ?? null,
                          notes:
                            ("notes" in s
                              ? (s as { notes: string | null }).notes
                              : null) ?? null,
                        }}
                        canDelete={adminAccess}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
