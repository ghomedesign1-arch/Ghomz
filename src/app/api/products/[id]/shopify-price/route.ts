import { requireRole, HttpError, withApi } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { MUFFIN_ERP_ID, money, shopifyClient, readPrice, writePrice, signApproval, verifyApproval } from "@/lib/shopify-price";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
const json = (data: unknown) => Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
async function product(id: string) {
  if (id !== MUFFIN_ERP_ID) throw new HttpError(404, "This product is not linked to Shopify.");
  const row = await prisma.product.findUnique({ where: { id },
    select: { id: true, name: true, retailPrice: true, updatedAt: true } });
  if (!row) throw new HttpError(404, "Product not found.");
  return row;
}
export const GET = withApi(async (_request: Request, { params }: Context) => {
  const { session } = await requireRole("ADMIN");
  if (!session.user?.id) throw new HttpError(401);
  const row = await product(params.id);
  const newPrice = money(row.retailPrice);
  const current = await readPrice(await shopifyClient());
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const approval = signApproval({ userId: session.user.id, productId: row.id,
    erpUpdatedAt: row.updatedAt.toISOString(), shopifyUpdatedAt: current.updatedAt,
    oldPrice: current.price, newPrice, expiresAt });
  return json({ erpName: row.name, shopifyName: current.title, variant: current.variant,
    status: current.status, currency: "EGP", oldPrice: current.price, newPrice,
    unchanged: current.price === newPrice, approval, expiresAt });
});
export const POST = withApi(async (request: Request, { params }: Context) => {
  const { session } = await requireRole("ADMIN");
  if (!session.user?.id) throw new HttpError(401);
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      !request.headers.get("content-type")?.startsWith("application/json")) {
    throw new HttpError(403, "Open the price preview from G-HOMZ to confirm.");
  }
  const body = await request.json().catch(() => null);
  const approval = verifyApproval(body?.approval, session.user.id, params.id);
  const row = await product(params.id);
  const price = money(row.retailPrice);
  if (price !== approval.newPrice || row.updatedAt.toISOString() !== approval.erpUpdatedAt) {
    throw new HttpError(409, "The ERP product changed. Refresh the preview before syncing.");
  }
  const client = await shopifyClient();
  const current = await readPrice(client);
  if (current.price === price) return json({ ok: true, unchanged: true, price });
  if (current.price !== approval.oldPrice || current.updatedAt !== approval.shopifyUpdatedAt) {
    throw new HttpError(409, "The Shopify product changed. Refresh the preview before syncing.");
  }
  await writePrice(client, price);
  return json({ ok: true, unchanged: false, price });
});
