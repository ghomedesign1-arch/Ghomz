import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { DedupePreview } from "@/components/products/dedupe-preview";

export const dynamic = "force-dynamic";

export default function ProductDedupePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Collapse duplicate products into variants"
        description="Groups top-level products that share the same name. The oldest in each group becomes the parent; the rest become variants under it."
      />

      <Card>
        <CardContent className="space-y-3 px-6 py-5 text-sm">
          <div className="font-medium">What this does</div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Shops around 60 Shopify-imported duplicates into one row per
              product family, with colour/size variants nested underneath.
            </li>
            <li>
              Nothing is deleted. Every row keeps its own SKU, cost, BOM,
              images and cutting lists.
            </li>
            <li>
              Variants that already have a parent are untouched.
            </li>
            <li>
              You pick which groups to collapse — unchecked groups are
              skipped.
            </li>
          </ul>
          <div className="text-xs text-muted-foreground">
            Return to the <Link href="/products" className="underline">products list</Link>.
          </div>
        </CardContent>
      </Card>

      <DedupePreview />
    </div>
  );
}
