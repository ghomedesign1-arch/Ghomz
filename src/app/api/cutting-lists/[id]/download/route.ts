import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, requireRole, withApi } from "@/lib/rbac";

/**
 * GET /api/cutting-lists/[id]/download
 *
 * Proxy download for a cutting-list file. The cross-origin <a download="..">
 * trick doesn't work when the link points at Cloudinary, so the browser saves
 * the file as the raw publicId with no extension ("file_xxxxx"). This route
 * streams the asset back through our origin with a proper
 * Content-Disposition: attachment; filename="..." header so the browser
 * always saves it with its original name + extension.
 */
export const GET = withApi(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  await requireRole("ADMIN", "MANAGER", "PRODUCTION", "VIEWER");

  const list = await prisma.cuttingList.findUnique({ where: { id: params.id } });
  if (!list) throw new HttpError(404, "Cutting list not found");

  let upstream: Response;
  try {
    upstream = await fetch(list.filePath);
  } catch {
    throw new HttpError(502, "Failed to fetch file from storage");
  }
  if (!upstream.ok || !upstream.body) {
    throw new HttpError(502, `Storage returned ${upstream.status}`);
  }

  // Force the filename the user uploaded. RFC 5987 `filename*` carries the
  // UTF-8 version so non-ASCII names survive; legacy `filename` covers older
  // clients with a safe ASCII fallback.
  const safeAscii = list.fileName.replace(/[^\x20-\x7E]/g, "_");
  const headers = new Headers();
  headers.set(
    "Content-Type",
    list.fileType || upstream.headers.get("content-type") || "application/octet-stream",
  );
  headers.set(
    "Content-Disposition",
    `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(list.fileName)}`,
  );
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");

  return new NextResponse(upstream.body, { status: 200, headers });
});
