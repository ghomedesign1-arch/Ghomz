"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiPatch, apiPut } from "@/lib/api-client";
import { calculateProductCost, formatLE } from "@/lib/costing";
import { pct } from "@/lib/utils";
import { CostBar } from "@/components/dashboard/cost-bar";
import { MetadataSection } from "./sections/metadata-section";
import { SpongeSection } from "./sections/sponge-section";
import { FabricSection } from "./sections/fabric-section";
import { BulkSection } from "./sections/bulk-section";
import { ManufacturingSection } from "./sections/manufacturing-section";
import { CompositionSection } from "./sections/composition-section";
import type {
  BulkRef,
  EditableProduct,
  FabricRef,
  ProductOption,
  SpongeRef,
} from "./types";

interface ProductEditorProps {
  product: EditableProduct;
  sponges: SpongeRef[];
  fabrics: FabricRef[];
  bulkMaterials: BulkRef[];
  /** All other products (used in the "Included products" / bundle section). */
  otherProducts: ProductOption[];
  /** Pre-resolved cost-per-unit for each `otherProducts[i].id` — lets us
   *  display the live preview without recomputing recursively on the client. */
  productCosts: Record<string, number>;
}

export function ProductEditor({
  product: initial,
  sponges,
  fabrics,
  bulkMaterials,
  otherProducts,
  productCosts,
}: ProductEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<EditableProduct>(initial);
  const [saving, setSaving] = React.useState(false);

  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial],
  );

  const breakdown = React.useMemo(
    () => computeBreakdown(draft, sponges, fabrics, bulkMaterials, productCosts),
    [draft, sponges, fabrics, bulkMaterials, productCosts],
  );

  function patch<K extends keyof EditableProduct>(
    key: K,
    value: EditableProduct[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    setSaving(true);
    try {
      await apiPatch(`/api/products/${draft.id}`, {
        sku: draft.sku,
        name: draft.name,
        category: draft.category,
        description: draft.description || undefined,
        widthCm: draft.widthCm,
        depthCm: draft.depthCm,
        heightCm: draft.heightCm,
        retailPrice: draft.retailPrice,
        wholesalePrice: draft.wholesalePrice,
        variantName: draft.variantName ?? undefined,
      });
      await apiPut(`/api/products/${draft.id}/bom`, {
        sponges: draft.sponges.map((s) => ({
          spongeId: s.spongeId,
          cutWidthCm: s.cutWidthCm,
          cutDepthCm: s.cutDepthCm,
          cutHeightCm: s.cutHeightCm,
          cuts: s.cuts,
          unitsPerBlockOverride: s.unitsPerBlockOverride ?? undefined,
          notes: s.notes || undefined,
        })),
        fabrics: draft.fabrics,
        bulkMaterials: draft.bulkMaterials,
        manufacturing: draft.manufacturing,
        compositions: draft.compositions,
      });
      toast.success("Product saved");
      router.push(`/products/${draft.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setDraft(initial);
    toast.info("Reverted unsaved changes");
  }

  return (
    <div className="space-y-6 pb-32">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/products/${draft.id}`}>
          <ArrowLeft className="h-4 w-4" /> Back to product
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          Edit {initial.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Update product metadata and its bill of materials. Cost preview
          updates as you type.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <MetadataSection product={draft} onChange={setDraft} />
          <SpongeSection
            product={draft}
            sponges={sponges}
            onChange={(sponges) => patch("sponges", sponges)}
          />
          <FabricSection
            product={draft}
            fabrics={fabrics}
            onChange={(fabrics) => patch("fabrics", fabrics)}
          />
          <BulkSection
            product={draft}
            bulkMaterials={bulkMaterials}
            onChange={(bulks) => patch("bulkMaterials", bulks)}
          />
          <ManufacturingSection
            product={draft}
            onChange={(manufacturing) => patch("manufacturing", manufacturing)}
          />
          <CompositionSection
            product={draft}
            available={otherProducts}
            onChange={(compositions) => patch("compositions", compositions)}
          />
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Live cost preview</CardTitle>
              <CardDescription>
                Recomputed from the in-progress BOM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total unit cost
                </div>
                <div className="font-display text-3xl font-semibold tracking-tight">
                  {formatLE(breakdown.totalCost)}
                </div>
              </div>
              <CostBar
                segments={[
                  {
                    label: "Sponge",
                    amount: breakdown.spongeCost,
                    color: "hsl(var(--chart-1))",
                  },
                  {
                    label: "Fabric",
                    amount: breakdown.fabricCost,
                    color: "hsl(var(--chart-2))",
                  },
                  {
                    label: "Fiber",
                    amount: breakdown.fiberCost,
                    color: "hsl(var(--chart-3))",
                  },
                  {
                    label: "Packaging",
                    amount: breakdown.packagingCost,
                    color: "hsl(var(--chart-4))",
                  },
                  {
                    label: "Manufacturing",
                    amount: breakdown.manufacturingCost,
                    color: "hsl(var(--chart-5))",
                  },
                ]}
                total={breakdown.totalCost}
              />
              <Separator />
              <Row
                label="Retail margin"
                value={pct(breakdown.retailMarginPct)}
                emphasis={breakdown.retailMarginPct >= 0}
              />
              <Row
                label="Retail profit"
                value={formatLE(breakdown.retailProfit)}
              />
              <Row
                label="Wholesale margin"
                value={pct(breakdown.wholesaleMarginPct)}
              />
              <Row
                label="Wholesale profit"
                value={formatLE(breakdown.wholesaleProfit)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onReset={onReset} />
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${
          emphasis ? "font-semibold text-foreground" : "font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SaveBar({
  dirty,
  saving,
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-md">
      <div className="container flex items-center justify-between gap-3 py-3">
        <div className="text-sm text-muted-foreground">
          You have unsaved changes
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onReset} disabled={saving}>
            Discard
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function computeBreakdown(
  draft: EditableProduct,
  sponges: SpongeRef[],
  fabrics: FabricRef[],
  bulkMaterials: BulkRef[],
  productCosts: Record<string, number>,
) {
  const spongeMap = new Map(sponges.map((s) => [s.id, s]));
  const fabricMap = new Map(fabrics.map((f) => [f.id, f]));
  const bulkMap = new Map(bulkMaterials.map((b) => [b.id, b]));

  return calculateProductCost({
    sponges: draft.sponges
      .map((ps) => {
        const block = spongeMap.get(ps.spongeId);
        if (!block) return null;
        return {
          block: {
            widthCm: block.widthCm,
            depthCm: block.depthCm,
            heightCm: block.heightCm,
            density: block.density,
            pricePerDensity: block.pricePerDensity,
            wastePct: block.wastePct,
          },
          cuts: [
            {
              cutWidthCm: ps.cutWidthCm,
              cutDepthCm: ps.cutDepthCm,
              cutHeightCm: ps.cutHeightCm,
              cuts: ps.cuts,
            },
          ],
          unitsPerBlockOverride: ps.unitsPerBlockOverride,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    fabrics: draft.fabrics
      .map((pf) => {
        const f = fabricMap.get(pf.fabricId);
        return f ? { meters: pf.meters, costPerMeter: f.costPerMeter } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    fibers: draft.bulkMaterials
      .filter((b) => bulkMap.get(b.bulkMaterialId)?.kind === "FIBER")
      .map((b) => ({
        grams: b.grams,
        costPerKg: bulkMap.get(b.bulkMaterialId)!.costPerKg,
      })),
    packaging: draft.bulkMaterials
      .filter((b) => bulkMap.get(b.bulkMaterialId)?.kind === "PACKAGING")
      .map((b) => ({
        grams: b.grams,
        costPerKg: bulkMap.get(b.bulkMaterialId)!.costPerKg,
      })),
    extras: draft.bulkMaterials
      .filter((b) => bulkMap.get(b.bulkMaterialId)?.kind === "EXTRA")
      .map((b) => ({
        grams: b.grams,
        costPerKg: bulkMap.get(b.bulkMaterialId)!.costPerKg,
      })),
    manufacturing: draft.manufacturing.map((m) => ({
      label: m.label,
      amount: m.amount,
    })),
    compositionCost: draft.compositions.reduce(
      (a, c) => a + (productCosts[c.childProductId] ?? 0) * c.quantity,
      0,
    ),
    retailPrice: draft.retailPrice,
    wholesalePrice: draft.wholesalePrice,
  });
}
