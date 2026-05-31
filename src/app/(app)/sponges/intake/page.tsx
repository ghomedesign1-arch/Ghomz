import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatLE } from "@/lib/costing";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Sponge intake — every block this brand has received from a supplier, drawn
 * from PurchaseItem rows where kind=SPONGE. Differs from /purchases (which
 * mixes sponges/fabrics/bulk) by being sponge-only and giving you a clean
 * "how many blocks did I take in" view.
 */
export default async function SpongeIntakePage() {
  const items = await prisma.purchaseItem.findMany({
    where: { kind: "SPONGE" },
    include: {
      purchase: {
        include: {
          supplier: true,
          createdBy: { select: { name: true } },
        },
      },
    },
    orderBy: { purchase: { createdAt: "desc" } },
    take: 200,
  });

  const totalBlocks = items.reduce((a, i) => a + i.quantity, 0);
  const totalSpent = items.reduce((a, i) => a + i.totalCost, 0);
  const latest = items[0]?.purchase.createdAt;

  // Group purchases by item name (free-text). Falls back to legacy referenceId
  // for older rows recorded before purchases became a standalone log.
  const byName = new Map<
    string,
    {
      displayName: string;
      blocks: number;
      spent: number;
      events: number;
      lastReceived?: Date;
    }
  >();
  for (const item of items) {
    const key = (item.itemName ?? item.referenceId ?? "—").trim() || "—";
    const entry = byName.get(key) ?? {
      displayName: key,
      blocks: 0,
      spent: 0,
      events: 0,
    };
    entry.blocks += item.quantity;
    entry.spent += item.totalCost;
    entry.events += 1;
    if (!entry.lastReceived || item.purchase.createdAt > entry.lastReceived) {
      entry.lastReceived = item.purchase.createdAt;
    }
    byName.set(key, entry);
  }
  const blockSummary = Array.from(byName.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.blocks - a.blocks);

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/sponges">
          <ArrowLeft className="h-4 w-4" /> All sponges
        </Link>
      </Button>

      <PageHeader
        title="Sponge intake"
        description="Every sponge block received from a supplier. Pulled from the purchase ledger — log a new intake via the Purchases page."
        actions={
          <Button asChild variant="outline">
            <Link href="/purchases">
              Go to purchases <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="Total blocks received"
          value={formatNumber(Math.round(totalBlocks))}
          hint={`Across ${items.length} intake event(s)`}
        />
        <Tile
          label="Total spent on sponge"
          value={formatLE(totalSpent)}
          hint="Lifetime — all suppliers"
        />
        <Tile
          label="Last intake"
          value={
            latest
              ? latest.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—"
          }
          hint={latest ? "Most recent purchase" : "No purchases yet"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lifetime intake by block</CardTitle>
          <CardDescription>
            How many blocks of each type you&apos;ve taken in across all
            purchases.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {blockSummary.length === 0 ? (
            <Empty>
              No sponge intake yet. Open Purchases and record a new purchase
              with a Sponge line to populate this page.
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Block</TableHead>
                  <TableHead className="text-right">Total blocks</TableHead>
                  <TableHead className="text-right">Intake events</TableHead>
                  <TableHead className="text-right">Total spent</TableHead>
                  <TableHead className="text-right">Last received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blockSummary.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="font-medium">{row.displayName}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatNumber(Math.round(row.blocks))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.events}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatLE(row.spent)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {row.lastReceived?.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }) ?? "—"}
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
          <CardTitle>Intake events</CardTitle>
          <CardDescription>
            Last {items.length} sponge-line entries on the purchase ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {items.length === 0 ? (
            <Empty>No intake events yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Qty (blocks)</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Logged by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">
                        {item.purchase.createdAt.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {item.itemName ?? "—"}
                        </div>
                        {item.itemDescription && (
                          <div className="text-xs text-muted-foreground">
                            {item.itemDescription}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.purchase.supplier?.name ?? "—"}
                        {item.purchase.reference && (
                          <div className="text-xs text-muted-foreground">
                            {item.purchase.reference}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {formatNumber(Math.round(item.quantity))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatLE(item.unitCost)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatLE(item.totalCost)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {item.purchase.createdBy?.name ?? "—"}
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
