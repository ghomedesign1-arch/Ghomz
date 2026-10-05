import { requireRole, HttpError, withApi } from '@/lib/rbac';
import { kidsPreview, importKids, KIDS_REVISION } from '@/lib/shopify-kids-import';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const json = (data: unknown) => Response.json(data, { headers: { 'Cache-Control':'private, no-store' } });
export const GET = withApi(async () => {
  await requireRole('ADMIN');
  return json(await kidsPreview());
});
export const POST = withApi(async (request: Request) => {
  await requireRole('ADMIN');
  if (request.headers.get('origin') !== new URL(request.url).origin || !request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(403);
  const body = await request.json().catch(() => null);
  if (body?.revision !== KIDS_REVISION) throw new HttpError(409, 'Refresh the import preview.');
  return json(await importKids());
});
