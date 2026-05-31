import { NextRequest, NextResponse } from "next/server";
import { calculateProductCost } from "@/lib/costing";
import { costEstimateInput } from "@/lib/validators";

/**
 * Stateless cost estimator — usable from the product BOM editor before
 * any data is saved to the database.
 */
export async function POST(req: NextRequest) {
  const parsed = costEstimateInput.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const breakdown = calculateProductCost(parsed.data);
  return NextResponse.json({ breakdown });
}
