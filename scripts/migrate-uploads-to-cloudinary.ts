/**
 * One-shot migration: legacy filesystem uploads → Cloudinary.
 *
 * Scans every CuttingList row whose `filePath` (or `thumbnailPath`) still
 * points at the local `/uploads/...` tree on disk, uploads the on-disk file
 * to Cloudinary, and rewrites the row to use the resulting secure URL.
 *
 * Also migrates the brand logo if it's still a local path.
 *
 * Safe to re-run — rows that are already Cloudinary URLs are skipped.
 *
 *   tsx scripts/migrate-uploads-to-cloudinary.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  isCloudinaryUrl,
  resourceKindFor,
  uploadBuffer,
} from "../src/lib/cloudinary";

const prisma = new PrismaClient();

// MIME inference for re-upload — Cloudinary's `auto` resource_type picks the
// right kind from the bytes, but we use the extension to seed resourceKindFor.
function mimeFromExt(p: string): string {
  const ext = (p.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? "").toLowerCase();
  switch (ext) {
    case "pdf":  return "application/pdf";
    case "png":  return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    case "gif":  return "image/gif";
    case "svg":  return "image/svg+xml";
    case "dwg":  return "application/acad";
    case "dxf":  return "application/dxf";
    default:     return "application/octet-stream";
  }
}

/**
 * Reads `<repo>/public/<legacyPath>` and pushes it to Cloudinary. Returns
 * the new secure URL, or null if the file is missing on disk.
 */
async function pushFile(
  legacyPath: string,
  folder: string,
): Promise<string | null> {
  // `legacyPath` is shaped like `/uploads/cutting-lists/<productId>/<uuid>.dwg`
  const absolute = path.join(process.cwd(), "public", legacyPath);
  let buf: Buffer;
  try {
    buf = await fs.readFile(absolute);
  } catch {
    console.warn(`  ⚠️  missing on disk: ${absolute}`);
    return null;
  }
  const mime = mimeFromExt(legacyPath);
  const uploaded = await uploadBuffer(buf, {
    folder,
    resourceType: resourceKindFor(mime),
  });
  return uploaded.url;
}

async function migrateCuttingLists() {
  const rows = await prisma.cuttingList.findMany({
    select: { id: true, productId: true, filePath: true, thumbnailPath: true, fileName: true },
  });

  let migrated = 0;
  let skipped = 0;
  for (const row of rows) {
    const needsFile  = row.filePath && !isCloudinaryUrl(row.filePath);
    const needsThumb = row.thumbnailPath && !isCloudinaryUrl(row.thumbnailPath);
    if (!needsFile && !needsThumb) {
      skipped++;
      continue;
    }

    console.log(`\n— ${row.fileName} (cuttingList ${row.id})`);
    const folder = `cutting-lists/${row.productId}`;

    let newFilePath: string | null = null;
    let newThumbPath: string | null = null;

    if (needsFile) {
      console.log(`  ↑ file: ${row.filePath}`);
      newFilePath = await pushFile(row.filePath!, folder);
      if (newFilePath) console.log(`    → ${newFilePath}`);
    }
    if (needsThumb) {
      console.log(`  ↑ cover: ${row.thumbnailPath}`);
      newThumbPath = await pushFile(row.thumbnailPath!, `${folder}/cover`);
      if (newThumbPath) console.log(`    → ${newThumbPath}`);
    }

    if (newFilePath || newThumbPath) {
      await prisma.cuttingList.update({
        where: { id: row.id },
        data: {
          ...(newFilePath  && { filePath:      newFilePath  }),
          ...(newThumbPath && { thumbnailPath: newThumbPath }),
        },
      });
      migrated++;
    }
  }
  console.log(`\n✓ cutting lists: ${migrated} migrated, ${skipped} already-cloud, ${rows.length} total`);
}

/**
 * Generic field migrator — walks rows of a table looking for a string column
 * that holds a `/uploads/...` legacy path, uploads each one, and rewrites the
 * row's column to the new Cloudinary URL.
 */
async function migrateImageField<T extends { id: string }>(
  label: string,
  rows: (T & { [k: string]: unknown })[],
  field: keyof T,
  folder: string,
  updateFn: (id: string, newUrl: string) => Promise<unknown>,
) {
  let migrated = 0;
  let skipped = 0;
  for (const row of rows) {
    const value = row[field] as string | null | undefined;
    if (!value) continue;
    if (isCloudinaryUrl(value)) {
      skipped++;
      continue;
    }
    if (!value.startsWith("/")) {
      // Some absolute URLs (Unsplash, S3, etc.) — leave them alone.
      skipped++;
      continue;
    }
    console.log(`\n— ${label} ${row.id}.${String(field)}: ${value}`);
    const newUrl = await pushFile(value, folder);
    if (newUrl) {
      await updateFn(row.id, newUrl);
      console.log(`  → ${newUrl}`);
      migrated++;
    }
  }
  console.log(`\n✓ ${label}.${String(field)}: ${migrated} migrated, ${skipped} already-cloud/absolute`);
}

async function migrateProductImages() {
  const products = await prisma.product.findMany({ select: { id: true, imageUrl: true } });
  await migrateImageField(
    "Product",
    products,
    "imageUrl",
    "products",
    (id, newUrl) => prisma.product.update({ where: { id }, data: { imageUrl: newUrl } }),
  );
}

async function migrateSpongeImages() {
  const sponges = await prisma.sponge.findMany({ select: { id: true, imageUrl: true } });
  await migrateImageField(
    "Sponge",
    sponges,
    "imageUrl",
    "sponges",
    (id, newUrl) => prisma.sponge.update({ where: { id }, data: { imageUrl: newUrl } }),
  );
}

async function migrateFabricImages() {
  const fabrics = await prisma.fabric.findMany({ select: { id: true, imageUrl: true } });
  await migrateImageField(
    "Fabric",
    fabrics,
    "imageUrl",
    "fabrics",
    (id, newUrl) => prisma.fabric.update({ where: { id }, data: { imageUrl: newUrl } }),
  );
}

/**
 * Brand logo special case: the previous (filesystem) version of the brand
 * route never wrote anything to the Setting table — it just dropped a
 * `logo.{ext}` file under `public/uploads/brand/`. So we scan that folder
 * directly and seed the Setting row with the Cloudinary URL.
 */
async function migrateBrandLogo() {
  const setting = await prisma.setting.findUnique({ where: { key: "brand.logoUrl" } });
  if (setting && isCloudinaryUrl(setting.value)) {
    console.log(`\n✓ brand logo: already on Cloudinary — ${setting.value}`);
    return;
  }

  // First check Setting (if it points at a legacy path, migrate that).
  let legacyPath: string | null = null;
  if (setting && !isCloudinaryUrl(setting.value)) {
    legacyPath = setting.value.startsWith("/") ? setting.value : null;
  }

  // If no Setting row (or value isn't a /uploads path), scan disk for a logo.
  if (!legacyPath) {
    const brandDir = path.join(process.cwd(), "public", "uploads", "brand");
    try {
      const entries = await fs.readdir(brandDir);
      const match = entries.find((n) => /^logo\.(svg|png|jpe?g|webp)$/i.test(n));
      if (match) legacyPath = `/uploads/brand/${match}`;
    } catch {
      /* dir doesn't exist */
    }
  }

  if (!legacyPath) {
    console.log("\n✓ brand logo: nothing on disk and no legacy Setting row — nothing to do");
    return;
  }

  console.log(`\n— brand logo at ${legacyPath}`);
  const newUrl = await pushFile(legacyPath, "brand");
  if (!newUrl) {
    console.log("  ⚠️  could not read brand logo from disk");
    return;
  }
  await prisma.setting.upsert({
    where: { key: "brand.logoUrl" },
    create: { key: "brand.logoUrl", value: newUrl },
    update: { value: newUrl },
  });
  console.log(`  ✓ moved → ${newUrl}`);
}

async function main() {
  console.log("Migrating legacy /uploads files → Cloudinary…");
  await migrateCuttingLists();
  await migrateProductImages();
  await migrateSpongeImages();
  await migrateFabricImages();
  await migrateBrandLogo();
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
