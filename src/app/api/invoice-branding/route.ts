import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";
import { deleteByUrl, uploadBuffer } from "@/lib/cloudinary";

const LOGO_KEY = "invoice.logoUrl";
const CURVE_KEY = "invoice.bottomCurveUrl";
const MAX_BYTES = 5 * 1024 * 1024;

async function readUrl(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function writeUrl(key: string, url: string | null): Promise<void> {
  const now = new Date();
  if (url === null) {
    await prisma.setting.deleteMany({ where: { key } });
    return;
  }
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: url, updatedAt: now },
    update: { value: url, updatedAt: now },
  });
}

/**
 * GET /api/invoice-branding — returns the current logo + bottom-curve URLs.
 */
export const GET = withApi(async () => {
  await requireRole("ADMIN", "MANAGER");
  const [logoUrl, bottomCurveUrl] = await Promise.all([
    readUrl(LOGO_KEY),
    readUrl(CURVE_KEY),
  ]);
  return NextResponse.json({ logoUrl, bottomCurveUrl });
});

/**
 * POST /api/invoice-branding — multipart upload. Accepts optional `logo` and
 * `bottomCurve` image fields, uploads them to Cloudinary and stores the
 * resulting URLs in the Setting table.
 */
export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const form = await req.formData();

  async function handle(fieldName: string, key: string): Promise<string | null> {
    const file = form.get(fieldName);
    if (!(file instanceof File) || file.size === 0) return readUrl(key);
    if (file.size > MAX_BYTES)
      throw new HttpError(413, `${fieldName} too large (max 5 MB)`);
    if (!file.type.startsWith("image/"))
      throw new HttpError(415, `${fieldName} must be an image`);
    // Clean up the previous asset so Cloudinary doesn't accumulate zombies.
    const previous = await readUrl(key);
    if (previous) await deleteByUrl(previous);
    const uploaded = await uploadBuffer(
      Buffer.from(await file.arrayBuffer()),
      { folder: "invoice-branding", resourceType: "image" },
    );
    await writeUrl(key, uploaded.url);
    return uploaded.url;
  }

  const [logoUrl, bottomCurveUrl] = await Promise.all([
    handle("logo", LOGO_KEY),
    handle("bottomCurve", CURVE_KEY),
  ]);
  return NextResponse.json({ logoUrl, bottomCurveUrl });
});

/**
 * DELETE /api/invoice-branding?target=logo|curve|both — removes stored assets
 * both from Cloudinary and the Setting table.
 */
export const DELETE = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN", "MANAGER");
  const target = req.nextUrl.searchParams.get("target") ?? "both";
  const keys =
    target === "logo"
      ? [LOGO_KEY]
      : target === "curve"
        ? [CURVE_KEY]
        : [LOGO_KEY, CURVE_KEY];
  for (const k of keys) {
    const url = await readUrl(k);
    if (url) await deleteByUrl(url);
    await writeUrl(k, null);
  }
  return NextResponse.json({ ok: true });
});
