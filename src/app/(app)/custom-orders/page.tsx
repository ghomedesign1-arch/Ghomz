import { prisma } from "@/lib/prisma";
import { canWrite } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/page-header";
import { CustomOrderDialog } from "@/components/dialogs/custom-order-dialog";
import { Badge } from "@/components/ui/badge";
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
import { formatLE } from "@/lib/costing";
import { Phone, MapPin } from "lucide-react";
import { CustomOrderRowActions } from "@/components/row-actions/custom-order-row-actions";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "secondary" | "info" | "success" | "warning" | "destructive"> = {
  PENDING:     "warning",
  IN_PROGRESS: "info",
  COMPLETED:   "success",
  CANCELLED:   "destructive",
};

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function CustomOrdersPage() {
  const [orders, writeAccess] = await Promise.all([
    prisma.customOrder.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    canWrite(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom orders"
        description="Free-form client orders with custom pricing and auto-generated invoices."
        actions={writeAccess ? <CustomOrderDialog /> : null}
      />

      <Card>
        <CardHeader>
          <CardTitle>All custom orders</CardTitle>
          <CardDescription>
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {orders.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No custom orders yet — create your first order above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const subtotal = o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                  const balance  = subtotal - o.deposit;
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono font-semibold text-sm">
                        {o.invoiceNo}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(o.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{o.clientName}</div>
                        {o.clientPhone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {o.clientPhone}
                          </div>
                        )}
                        {o.clientAddress && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="max-w-[160px] truncate">{o.clientAddress}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(o.deliveryDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[o.status] ?? "secondary"}>
                          {o.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLE(subtotal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {o.deposit > 0 ? formatLE(o.deposit) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {balance > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {formatLE(balance)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs">Paid</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <CustomOrderRowActions
                          orderId={o.id}
                          invoiceNo={o.invoiceNo}
                          clientName={o.clientName}
                        />
                      </TableCell>
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
