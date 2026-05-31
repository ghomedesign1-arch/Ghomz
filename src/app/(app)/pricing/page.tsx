import { PageHeader } from "@/components/layout/page-header";
import { ScenarioTable } from "@/components/pricing/scenario-table";
import { getProductionRunOptions } from "@/lib/production-options";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const options = await getProductionRunOptions();

  const products = options.map((o) => ({
    id:             o.id,
    sku:            o.sku,
    name:           o.name,
    cost:           o.unitCost,
    retailPrice:    o.retailPrice,
    wholesalePrice: o.wholesalePrice,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing scenarios"
        description="Simulate how different margin targets translate into selling prices — compare against your current retail and wholesale prices."
      />
      <ScenarioTable products={products} />
    </div>
  );
}
