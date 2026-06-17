import { cn } from "@/lib/utils";
import {
  formatLE,
  spongeBlockCost,
  spongeCostForProduct,
  unitsPerBlock,
  type ProductCostBreakdown,
} from "@/lib/costing";
import type { ResolvedProduct } from "@/lib/product-cost";

interface CatalogueBreakdownProps {
  product: ResolvedProduct;
  breakdown: ProductCostBreakdown;
  /** VAT applied to the price-cost line at the bottom. Default 14% (Egypt). */
  vatRate?: number;
  /** Map of childProductId → its resolved total unit cost. Used to display
   *  per-row subtotals in the "Included products" table. */
  childCosts?: Record<string, number>;
}

/**
 * Cost-breakdown view that mirrors the layout of the G-Homz product
 * catalogue (page 12 of the Fluff catalogue PDF).
 *
 *  ┌────────────────────────────────────────────────────────────────┐
 *  │  Sponge Couch                                                  │
 *  │  Cost Breakdown                                                │
 *  │  Total Cost For                                                │
 *  │  ⬤ <hardness>                                                  │
 *  │  ● <dimensions>                                                │
 *  ├──────────────────────────┬─────────────────────────────────────┤
 *  │  Sponge table            │  Fabric table                       │
 *  ├──────────────────────────┴─────────────────────────────────────┤
 *  │  Additional | Fiber | Packaging | Susta | TOTAL                │
 *  ├────────────────────────────────────────┬───────────────────────┤
 *  │                                        │  Price Cost           │
 *  │                                        │  VAT 14%              │
 *  └────────────────────────────────────────┴───────────────────────┘
 *
 * Per-unit sponge cost uses the simple PDF convention:
 *     cost_per_unit = block_cost / units_per_block
 * which is what manufacturers expect to see on a cost sheet.
 */
export function CatalogueBreakdown({
  product,
  breakdown,
  vatRate = 0.14,
  childCosts = {},
}: CatalogueBreakdownProps) {
  const spongeRows = product.sponges.map((ps) => {
    const blockCost = spongeBlockCost(ps.sponge);
    const usage = {
      block: ps.sponge,
      cuts: [
        {
          cutWidthCm: ps.cutWidthCm,
          cutDepthCm: ps.cutDepthCm,
          cutHeightCm: ps.cutHeightCm,
          cuts: ps.cuts,
        },
      ],
      // Honor the manual yield override the user set in the BOM editor
      // so the catalogue table matches the live cost preview / breakdown.
      unitsPerBlockOverride: ps.unitsPerBlockOverride,
    };
    return {
      key: ps.id,
      type: `${ps.sponge.density} ${humanize(ps.sponge.hardness)}`,
      blockDims: `${ps.sponge.widthCm}x${ps.sponge.depthCm}x${ps.sponge.heightCm}`,
      blockCost,
      units: unitsPerBlock(usage),
      perUnit: spongeCostForProduct(usage),
    };
  });

  const fabricRows = product.fabrics.map((pf) => ({
    key: pf.id,
    name: pf.fabric.name,
    meters: pf.meters,
    costPerMeter: pf.fabric.costPerMeter,
    lineCost: pf.meters * pf.fabric.costPerMeter,
  }));

  // Use the authoritative breakdown for the rolled-up totals so the catalogue
  // always agrees with the live cost preview, even when yields or other
  // server-side allocation kicks in.
  const additional = breakdown.manufacturingCost;
  const fiber = breakdown.fiberCost;
  const packaging = breakdown.packagingCost;
  // The PDF labels its 4th bulk column "Susta Cost" — we map it to anything
  // stored as BulkMaterial.kind = EXTRA so the column always renders.
  const susta = breakdown.extrasCost;
  const pocketCoil = breakdown.pocketCoilCost;
  const totalCost = breakdown.totalCost;
  const hasComposition = (product.compositions ?? []).length > 0;

  const priceCost = product.retailPrice;
  const priceWithVat = priceCost * (1 + vatRate);

  return (
    <article className="rounded-2xl border bg-[#F2ECE2] p-4 text-[#332919] dark:bg-sand-900 dark:text-sand-50 sm:p-6 md:p-8">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="space-y-1.5">
        <div className="font-display text-xl italic tracking-tight text-[#5a4a36] dark:text-sand-200 sm:text-2xl">
          Sponge Couch
        </div>
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl md:text-4xl">
          Cost Breakdown
        </h2>
        <div className="pt-2 font-display italic text-[#5a4a36] dark:text-sand-200">
          Total Cost For
        </div>
        <div className="font-bold uppercase tracking-wide">
          {spongeRows[0]?.type ?? "—"}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Bullet>1</Bullet>
          <span className="font-medium tabular-nums">
            {product.widthCm}x{product.depthCm}x{product.heightCm}
          </span>
        </div>
      </header>

      {/* ── Two tables side-by-side ──────────────────────────────── */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CatalogueTable
          headers={[
            "Sponge Type",
            "Dimensions (cm)",
            "Cost (EGP)",
            "Quantity",
            "Cost (EGP)",
          ]}
        >
          {spongeRows.length === 0 ? (
            <EmptyRow span={5}>No sponge cuts on this product yet</EmptyRow>
          ) : (
            spongeRows.map((r) => (
              <tr key={r.key}>
                <td className="py-1.5 px-2 sm:py-2 sm:px-3 font-medium">{r.type}</td>
                <td className="py-1.5 px-2 sm:py-2 sm:px-3 tabular-nums">{r.blockDims}</td>
                <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-right tabular-nums">
                  {formatNumber(r.blockCost)}
                </td>
                <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-right tabular-nums">
                  {r.units || "—"}
                </td>
                <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-right tabular-nums font-semibold">
                  {formatNumber(r.perUnit)}
                </td>
              </tr>
            ))
          )}
        </CatalogueTable>

        <CatalogueTable
          headers={["Fabric Model", "Fabric Dimension", "Cost Per M", "Cost (EGP)"]}
        >
          {fabricRows.length === 0 ? (
            <EmptyRow span={4}>No fabric on this product yet</EmptyRow>
          ) : (
            fabricRows.map((r) => (
              <tr key={r.key}>
                <td className="py-1.5 px-2 sm:py-2 sm:px-3 font-medium">{r.name}</td>
                <td className="py-1.5 px-2 sm:py-2 sm:px-3 tabular-nums">{r.meters} m</td>
                <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-right tabular-nums">
                  {formatNumber(r.costPerMeter)}
                </td>
                <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-right tabular-nums font-semibold">
                  {formatNumber(r.lineCost)}
                </td>
              </tr>
            ))
          )}
        </CatalogueTable>
      </div>

      {/* ── Bottom row: additional + fiber + packaging + susta + total ── */}
      <div className="mt-4">
        <CatalogueTable
          headers={[
            "Additional Costs (EGP)",
            "Compressed Fiber (EGP)",
            "Packaging (EGP)",
            "Susta Cost (EGP)",
            "Pocket Coil (EGP)",
            "Total Cost (EGP)",
          ]}
        >
          <tr>
            <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-center tabular-nums">
              {formatNumber(additional)}
            </td>
            <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-center tabular-nums">
              {formatNumber(fiber)}
            </td>
            <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-center tabular-nums">
              {formatNumber(packaging)}
            </td>
            <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-center tabular-nums">
              {formatNumber(susta)}
            </td>
            <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-center tabular-nums">
              {formatNumber(pocketCoil)}
            </td>
            <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-center tabular-nums font-display text-lg font-bold text-[#a8331a] dark:text-rose-300">
              {formatNumber(totalCost)}
            </td>
          </tr>
        </CatalogueTable>
      </div>

      {/* ── Included sub-products (bundle) ───────────────────────── */}
      {hasComposition && (
        <div className="mt-4">
          <CatalogueTable
            headers={[
              "Included product",
              "SKU",
              "Quantity",
              "Cost / unit",
              "Subtotal",
            ]}
          >
            {(product.compositions ?? []).map((c) => {
              const childCost = childCosts[c.childProductId] ?? 0;
              return (
                <tr key={c.id}>
                  <td className="py-1.5 px-2 sm:py-2 sm:px-3 font-medium">{c.child.name}</td>
                  <td className="py-1.5 px-2 sm:py-2 sm:px-3 tabular-nums text-muted-foreground">
                    {c.child.sku}
                  </td>
                  <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-right tabular-nums">
                    {c.quantity}
                  </td>
                  <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-right tabular-nums text-muted-foreground">
                    {formatNumber(childCost)}
                  </td>
                  <td className="py-1.5 px-2 sm:py-2 sm:px-3 text-right tabular-nums font-semibold">
                    {formatNumber(childCost * c.quantity)}
                  </td>
                </tr>
              );
            })}
          </CatalogueTable>
          <p className="mt-2 text-[11px] italic text-[#5a4a36] dark:text-sand-200">
            Sub-product cost contribution: {formatLE(breakdown.compositionCost)}.
            Already included in the Total Cost above.
          </p>
        </div>
      )}

      {/* ── Price summary ─────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:place-items-end">
        <div className="hidden sm:block" aria-hidden />
        <div className="w-full space-y-2 text-right">
          <SummaryRow label="Price Cost" value={priceCost} />
          <SummaryRow
            label={`VAT ${(vatRate * 100).toFixed(0)}%`}
            value={priceWithVat}
            emphasis
          />
        </div>
      </div>

      <footer className="mt-6 flex items-center justify-between border-t border-[#d6c4a6] pt-3 text-xs text-[#8b6e45]">
        <span>G-Homz · {product.sku}</span>
        <span>Cost figures recalculate live from the product BOM</span>
      </footer>
    </article>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function CatalogueTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  // `overflow-x-auto` + `min-w-max` together preserve natural column widths
  // and let the user horizontally swipe the table on mobile instead of
  // seeing columns get squashed to unreadable widths.
  return (
    <div className="overflow-x-auto rounded-lg border border-[#d6c4a6] bg-white text-xs sm:text-sm dark:border-sand-700 dark:bg-sand-800 scrollbar-thin">
      <table className="w-full min-w-max">
        <thead className="bg-[#FAF7F2] text-[9px] uppercase tracking-wider text-[#5a4a36] sm:text-[10px] dark:bg-sand-700 dark:text-sand-100">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap py-1.5 px-2 text-left font-semibold sm:py-2 sm:px-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e6dbc8] dark:divide-sand-700">
          {children}
        </tbody>
      </table>
    </div>
  );
}

function EmptyRow({
  span,
  children,
}: {
  span: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={span}
        className="py-4 px-3 text-center text-xs italic text-muted-foreground"
      >
        {children}
      </td>
    </tr>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#d6c4a6] bg-white px-4 py-3 dark:border-sand-700 dark:bg-sand-800",
        emphasis && "bg-[#3a2a18] text-sand-50 dark:bg-sand-700",
      )}
    >
      <div
        className={cn(
          "text-[10px] uppercase tracking-wider",
          emphasis ? "text-sand-200" : "text-[#8b6e45] dark:text-sand-200",
        )}
      >
        {label}
      </div>
      <div className="mt-0.5 font-display text-xl font-bold tabular-nums">
        {formatLE(value)}
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#332919] text-[10px] font-bold text-sand-50 dark:bg-sand-100 dark:text-sand-900">
      {children}
    </span>
  );
}

function humanize(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-EG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

