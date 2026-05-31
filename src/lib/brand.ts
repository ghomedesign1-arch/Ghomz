import { prisma } from "./prisma";

/** Key used in the `Setting` table for the brand logo URL. */
export const BRAND_LOGO_KEY = "brand.logoUrl";

/**
 * Returns the public URL for the current brand logo, or `null` if none has
 * been uploaded. The Setting row is the source of truth — uploaded once via
 * `POST /api/brand/logo`, persisted across deploys.
 */
export async function getBrandLogoUrl(): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: BRAND_LOGO_KEY } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setBrandLogoUrl(url: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: BRAND_LOGO_KEY },
    create: { key: BRAND_LOGO_KEY, value: url },
    update: { value: url },
  });
}

export async function clearBrandLogoUrl(): Promise<void> {
  await prisma.setting
    .delete({ where: { key: BRAND_LOGO_KEY } })
    .catch(() => undefined); // already gone
}
