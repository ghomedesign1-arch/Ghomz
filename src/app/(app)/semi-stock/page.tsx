import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { canWrite, isAdmin } from "@/lib/rbac";
import { getStockSummary } from "@/lib/semi-stock";
import { SemiStockBoard } from "@/components/semi-stock/semi-stock-board";

export const dynamic = "force-dynamic";

export default async function SemiStockPage() {
  const [rows, writeAccess, adminAccess, kidsBeds] = await Promise.all([
    getStockSummary(),
    canWrite(),
    isAdmin(),
    prisma.product.findMany({
      where: { category: "KIDS_BED", parentId: null, active: true },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const modelSuggestions = Array.from(new Set(kidsBeds.map((p) => p.name)));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Semi-finished stock"
        description="Ready sponge sets per bed and size. A unit is taken automatically when a Shopify order gets a deposit or is paid, and returned if the order is cancelled or goes back to unpaid."
      />
      <SemiStockBoard
        rows={rows}
        modelSuggestions={modelSuggestions}
        canEdit={writeAccess}
        canDelete={adminAccess}
      />
    </div>
  );
}
