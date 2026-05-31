import React from "react";
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
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { canWrite, isAdmin } from "@/lib/rbac";
import { formatLE } from "@/lib/costing";
import type { PurchaseResources } from "@/components/dialogs/purchase-form-dialog";
import { AddPurchaseButton } from "@/components/row-actions/purchase-add-button";
import { AddMarketingExpenseButton } from "@/components/row-actions/marketing-expense-button";
import { PurchaseRowActions } from "@/components/row-actions/purchase-row-actions";

export const dynamic = "force-dynamic";

type Kind = "SPONGE" | "FABRIC" | "BULK" | "MARKETING" | "OTHER";

const KIND_LABEL: Record<string, string> = {
  SPONGE: "Sponge",
  FABRIC: "Fabric",
  BULK: "Bulk",
  MARKETING: "Marketing",
  OTHER: "Other",
};

const QTY_UNIT: Record<string, string> = {
  SPONGE: "blocks",
  FABRIC: "m",
  BULK: "kg",
  MARKETING: "units",
  OTHER: "units",
};

function formatQty(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

type PurchaseFull = Awaited<ReturnType<typeof prisma.purchase.findMany<{
  include: { supplier: true; items: true; createdBy: { select: { name: true } } };
}>>>[number];

async function load() {
  try {
    const [purchases, suppliers] = await Promise.all([
      prisma.purchase.findMany({
        include: {
          supplier: true,
          items: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.supplier.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const resources: PurchaseResources = { suppliers };
    return { purchases, resources, ready: true as const };
  } catch {
    return {
      purchases: [] as PurchaseFull[],
      resources: { suppliers: [] } satisfies PurchaseResources,
      ready: false as const,
    };
  }
}

export default async function PurchasesPage() {
  const [{ purchases, resources, ready }, writeAccess, adminAccess] =
    await Promise.all([load(), canWrite(), isAdmin()]);

  const spongePurchases = purchases.filter((p) =>
    p.items.some((i) => i.kind === "SPONGE"),
  );
  const fabricPurchases = purchases.filter((p) =>
    p.items.some((i) => i.kind === "FABRIC"),
  );
  const marketingPurchases = purchases.filter((p) =>
    p.items.some((i) => i.kind === "MARKETING"),
  );

  const spongeTotal    = sumByKind(purchases, "SPONGE");
  const fabricTotal    = sumByKind(purchases, "FABRIC");
  const marketingTotal = sumByKind(purchases, "MARKETING");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Purchases"
        description="Standalone log of what you bought. Two sections: sponge purchases and fabric purchases — each is independent of inventory."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Tile
          label="Sponge spend"
          value={formatLE(spongeTotal)}
          hint={`${spongePurchases.length} purchase(s)`}
        />
        <Tile
          label="Fabric spend"
          value={formatLE(fabricTotal)}
          hint={`${fabricPurchases.length} purchase(s)`}
        />
        <Tile
          label="Marketing spend"
          value={formatLE(marketingTotal)}
          hint={`${marketingPurchases.length} purchase(s)`}
        />
        <Tile
          label="Total purchases logged"
          value={`${purchases.length}`}
          hint="Last 100 entries"
        />
      </div>

      <PurchaseSection
        title="Sponge purchases"
        description="Every restock that includes a sponge line. Only the sponge items are listed here — fabric items on the same purchase show in the fabric section."
        kind="SPONGE"
        purchases={spongePurchases}
        resources={resources}
        ready={ready}
        writeAccess={writeAccess}
        adminAccess={adminAccess}
        addLabel="Record sponge purchase"
      />

      <PurchaseSection
        title="Fabric purchases"
        description="Every restock that includes a fabric line."
        kind="FABRIC"
        purchases={fabricPurchases}
        resources={resources}
        ready={ready}
        writeAccess={writeAccess}
        adminAccess={adminAccess}
        addLabel="Record fabric purchase"
      />

      <PurchaseSection
        title="Marketing expenses"
        description="Social media ads, media buying, influencer campaigns, photography, and any other marketing spend."
        kind="MARKETING"
        purchases={marketingPurchases}
        resources={resources}
        ready={ready}
        writeAccess={writeAccess}
        adminAccess={adminAccess}
        addLabel="Record marketing expense"
        addButton={<AddMarketingExpenseButton />}
      />
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sumByKind(
  purchases: { items: { kind: string; totalCost: number }[] }[],
  kind: Kind,
): number {
  return purchases.reduce(
    (a, p) =>
      a + p.items.filter((i) => i.kind === kind).reduce((b, i) => b + i.totalCost, 0),
    0,
  );
}

function PurchaseSection({
  title,
  description,
  kind,
  purchases,
  resources,
  ready,
  writeAccess,
  adminAccess,
  addLabel,
  addButton,
}: {
  title: string;
  description: string;
  kind: Kind;
  purchases: PurchaseFull[];
  resources: PurchaseResources;
  ready: boolean;
  writeAccess: boolean;
  adminAccess: boolean;
  addLabel: string;
  addButton?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {writeAccess && ready && (
          addButton ?? (
            <AddPurchaseButton
              resources={resources}
              defaultKind={kind}
              lockKind
              label={addLabel}
            />
          )
        )}
      </CardHeader>
      <CardContent className="px-0">
        {purchases.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No {KIND_LABEL[kind].toLowerCase()} purchases yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Logged by</TableHead>
                {writeAccess && <TableHead className="w-px" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => {
                // Show only the lines that match this section's kind. Other
                // kinds on the same purchase appear on their own section.
                const sectionItems = p.items.filter((i) => i.kind === kind);
                const sectionTotal = sectionItems.reduce(
                  (a, i) => a + i.totalCost,
                  0,
                );
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      {p.createdAt.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.supplier?.name ?? sectionItems[0]?.itemName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.reference ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {sectionItems.map((i) => (
                          <div key={i.id} className="text-sm font-medium">
                            {i.itemName ?? "—"}
                            {i.itemDescription && (
                              <span className="ml-1 text-xs text-muted-foreground font-normal">
                                · {i.itemDescription}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-1">
                        {sectionItems.map((i) => (
                          <div
                            key={i.id}
                            className="flex items-baseline justify-end gap-1 text-sm tabular-nums"
                          >
                            <span className="font-semibold">
                              {formatQty(i.quantity)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {QTY_UNIT[kind]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-1">
                        {sectionItems.map((i) => (
                          <div
                            key={i.id}
                            className="text-sm tabular-nums text-muted-foreground"
                          >
                            {formatLE(i.totalCost)}
                          </div>
                        ))}
                        <div className="tabular-nums font-semibold border-t pt-1">
                          {formatLE(sectionTotal)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {p.createdBy?.name ?? "—"}
                    </TableCell>
                    {writeAccess && (
                      <TableCell className="text-right">
                        <PurchaseRowActions
                          purchase={{
                            id: p.id,
                            supplierId: p.supplierId ?? "",
                            reference: p.reference ?? "",
                            notes: p.notes ?? "",
                            purchaseDate: p.createdAt
                              .toISOString()
                              .slice(0, 10),
                            totalAmount: p.totalAmount,
                            items: p.items.map((i) => ({
                              kind: i.kind as Kind,
                              itemName: i.itemName ?? "",
                              itemDescription: i.itemDescription ?? "",
                              quantity: i.quantity,
                              unitCost: i.unitCost,
                            })),
                          }}
                          resources={resources}
                          canDelete={adminAccess}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                <TableCell colSpan={4} className="text-right text-sm font-medium">
                  Total {KIND_LABEL[kind].toLowerCase()} purchases
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {formatQty(
                    purchases.reduce(
                      (a, p) =>
                        a +
                        p.items
                          .filter((i) => i.kind === kind)
                          .reduce((b, i) => b + i.quantity, 0),
                      0,
                    ),
                  )}{" "}
                  {QTY_UNIT[kind]}
                </TableCell>
                <TableCell className="text-right tabular-nums font-display text-lg font-bold">
                  {formatLE(
                    purchases.reduce(
                      (a, p) =>
                        a +
                        p.items
                          .filter((i) => i.kind === kind)
                          .reduce((b, i) => b + i.totalCost, 0),
                      0,
                    ),
                  )}
                </TableCell>
                <TableCell />
                {writeAccess && <TableCell />}
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Tile({
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
