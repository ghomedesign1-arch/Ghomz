/**
 * Re-uploads every PDF in CuttingList whose Cloudinary URL is under `/raw/`
 * as a Cloudinary `image` asset. Image-type PDFs are served with
 * `Content-Type: application/pdf` + `Content-Disposition: inline`, so the
 * preview iframe renders them instead of triggering a download.
 *
 *   tsx scripts/repromote-pdfs-to-image.ts
 *
 * Safe to re-run — skips anything already on `/image/` or that fails to
 * fetch from the previous URL.
 */
import { PrismaClient } from "@prisma/client";
import { deleteByUrl, uploadBuffer } from "../src/lib/cloudinary";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.cuttingList.findMany({
    where: { fileType: "application/pdf" },
    select: { id: true, productId: true, fileName: true, filePath: true },
  });

  let migrated = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.filePath) {
      skipped++;
      continue;
    }
    // First-run path migrates raw→image. Re-runs catch any image-type PDFs
    // that ended up with `.ai` extension (PDF/AI share `%PDF-` signature) —
    // repromoting again with explicit `format: pdf` fixes the extension.
    const isLegacyRaw = row.filePath.includes("/raw/upload/");
    const isAIByMistake = row.filePath.includes("/image/upload/") && row.filePath.endsWith(".ai");
    if (!isLegacyRaw && !isAIByMistake) {
      skipped++;
      continue;
    }
    console.log(`\n— ${row.fileName} (${row.id})`);
    console.log(`  ← ${row.filePath}`);

    let buf: Buffer;
    try {
      const res = await fetch(row.filePath);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      console.warn(`  ⚠️  could not re-download (${(err as Error).message}); skipping`);
      continue;
    }

    const uploaded = await uploadBuffer(buf, {
      folder: `cutting-lists/${row.productId}`,
      resourceType: "image",
      format: "pdf", // pin format so Cloudinary stores it as .pdf, not .ai
    });
    console.log(`  → ${uploaded.url}`);

    await prisma.cuttingList.update({
      where: { id: row.id },
      data: { filePath: uploaded.url },
    });
    // Best-effort cleanup of the now-orphaned raw copy.
    await deleteByUrl(row.filePath);
    migrated++;
  }
  console.log(`\n✓ ${migrated} re-promoted, ${skipped} already-image`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
