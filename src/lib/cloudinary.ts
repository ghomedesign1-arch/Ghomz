import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Cloudinary uses three resource kinds. We pick `raw` for non-image documents
 *  (PDF, DWG, DXF) so they round-trip with their original bytes intact. */
export type ResourceKind = "image" | "raw" | "video" | "auto";

export interface UploadResult {
  url: string; // public, secure_url
  publicId: string;
  format: string | null;
  bytes: number;
  resourceType: ResourceKind;
}

interface UploadOpts {
  /** Folder path inside the Cloudinary account (e.g. "cutting-lists/<productId>"). */
  folder: string;
  /** Optional fixed public_id for upsert-style behavior (e.g. "brand/logo"). */
  publicId?: string;
  /** Resource kind. Defaults to "auto" so Cloudinary infers from MIME. */
  resourceType?: ResourceKind;
  /** When true, an existing asset at the same publicId is overwritten. */
  overwrite?: boolean;
  /** Force a specific stored format (e.g. "pdf"). Useful when the source
   *  shares a binary signature with another format Cloudinary may prefer
   *  (PDF vs AI both begin with `%PDF-`, so we have to be explicit). */
  format?: string;
}

/**
 * Uploads a Buffer (eg. from `await file.arrayBuffer()`) to Cloudinary using
 * the streaming uploader. Returns the secure URL + publicId we need to display
 * and later delete the asset.
 */
export async function uploadBuffer(
  buffer: Buffer,
  opts: UploadOpts,
): Promise<UploadResult> {
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder,
        public_id: opts.publicId,
        resource_type: opts.resourceType ?? "auto",
        overwrite: opts.overwrite ?? false,
        use_filename: !opts.publicId, // ignore when publicId is fixed
        unique_filename: !opts.publicId,
        ...(opts.format ? { format: opts.format } : {}),
      },
      (err, res) => {
        if (err || !res) return reject(err ?? new Error("Empty response"));
        resolve(res);
      },
    );
    stream.end(buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format ?? null,
    bytes: result.bytes,
    resourceType: (result.resource_type as ResourceKind) ?? "image",
  };
}

/**
 * True when the URL points at our Cloudinary cloud. Used to decide between
 * filesystem cleanup (legacy `/uploads/...` paths) and the Cloudinary API
 * (new uploads) when removing an asset.
 */
export function isCloudinaryUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("https://res.cloudinary.com/");
}

/**
 * Parses a Cloudinary URL into its (publicId, resourceType) pair so we can
 * call `cloudinary.uploader.destroy()`. Returns null if the URL isn't a
 * Cloudinary asset URL.
 *
 *   https://res.cloudinary.com/<cloud>/<resource>/upload/v<version>/<publicId>.<ext>
 *
 * publicId can contain slashes (folders) and there may not be a version
 * segment for transformed URLs — both branches are handled.
 */
export function parseCloudinaryUrl(
  url: string,
): { publicId: string; resourceType: ResourceKind } | null {
  if (!isCloudinaryUrl(url)) return null;
  // Cut everything up through "/upload/"
  const idx = url.indexOf("/upload/");
  if (idx < 0) return null;
  const head = url.slice(0, idx);
  const tail = url.slice(idx + "/upload/".length);
  // Resource kind is the path segment between the cloud name and "upload".
  // e.g. ".../<cloud>/image" — split and take the last segment.
  const headParts = head.split("/");
  const resourceType = (headParts[headParts.length - 1] as ResourceKind) || "image";
  // Strip optional version (`v1234567890/`) then strip the file extension.
  const withoutVersion = tail.replace(/^v\d+\//, "");
  // Strip extension only when it's a known short alphanumeric (avoids munging
  // publicIds that contain dots like `brand.logo`).
  const publicId = withoutVersion.replace(/\.[a-zA-Z0-9]{2,5}$/, "");
  return { publicId, resourceType };
}

/**
 * Deletes an asset by its full Cloudinary URL. No-ops (and returns false) if
 * the URL isn't a Cloudinary URL — so this is safe to call on legacy
 * filesystem paths too.
 */
export async function deleteByUrl(url: string | null | undefined): Promise<boolean> {
  if (!url) return false;
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return false;
  try {
    await cloudinary.uploader.destroy(parsed.publicId, {
      resource_type: parsed.resourceType === "auto" ? "image" : parsed.resourceType,
      invalidate: true,
    });
    return true;
  } catch (err) {
    console.warn(`[cloudinary] delete failed for ${parsed.publicId}:`, err);
    return false;
  }
}

/** Picks the right Cloudinary resource kind given a MIME type.
 *
 *  PDFs are deliberately routed to `image` even though they're documents:
 *  Cloudinary's image pipeline treats PDF as a first-class format with
 *  proper `Content-Type: application/pdf` + `Content-Disposition: inline`,
 *  so the browser previews them in an <iframe>. Uploading PDFs as `raw`
 *  serves them as `application/octet-stream` and forces a download. */
export function resourceKindFor(mime: string | undefined): ResourceKind {
  if (!mime) return "raw";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "image";
  if (mime.startsWith("video/")) return "video";
  return "raw"; // DWG, DXF, etc. — keep original bytes, accept download UX.
}
