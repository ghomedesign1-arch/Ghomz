import { COLOR_AR } from "@/lib/translations";

/**
 * Known Shopify "colour" option values. If a part of a variant title
 * matches (case-insensitive) one of these, the merger treats it as a
 * decorative colour choice that does NOT justify a new ERP variant.
 *
 * Add any new colour name here or in COLOR_AR (translations.ts) to make
 * the dedupe recognise it. Fallback: any part that is clearly not a
 * dimension and not a known mattress/extension flag is kept as-is so it
 * never silently collapses something we don't recognise.
 */
const EXTRA_COLORS = [
  "Baby Blue",
  "Light Beige",
  "Dark Beige",
  "Navy Blue",
  "Dusty Blue",
  "SAGE Green",
  "Mint Green",
  "Dark Coffee",
  "Grey",
  "Gray",
  "Ivory",
  "Beige",
  "White",
  "Black",
  "Pink",
  "Taupe",
  "Cream",
  "Brown",
  "Tan",
  "Olive",
  "Rose",
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Purple",
  "Orange",
  "Silver",
  "Gold",
  "Natural",
];

const COLOR_SET = new Set<string>([
  ...Object.keys(COLOR_AR).map((k) => k.toLowerCase()),
  ...EXTRA_COLORS.map((k) => k.toLowerCase()),
]);

export function isColorValue(part: string): boolean {
  const s = part.trim().toLowerCase();
  if (!s) return false;
  if (COLOR_SET.has(s)) return true;
  // Match "Light Beige / Dark Beige" style qualifiers: last word is a known
  // colour → treat the whole thing as a colour too (e.g. "warm beige").
  const lastWord = s.split(/\s+/).pop();
  if (lastWord && COLOR_SET.has(lastWord)) return true;
  return false;
}

/**
 * Split a variant title into its slash-separated parts and return the parts
 * that are NOT colours (so dimensions + mattress / extension flags remain).
 */
export function nonColorKey(variantTitle: string | null | undefined): string {
  if (!variantTitle) return "";
  return variantTitle
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !isColorValue(s))
    .join(" / ");
}

/**
 * Known 2-letter colour codes used in G-Homz SKUs. These sit at position 4
 * in e.g. "GH-BED-TINY-120-MG-WM" (MG = Mint Green). If a SKU segment
 * matches one of these it's treated as a colour slot during the SKU-based
 * grouping — swap position 4 for "X" and two SKUs with the same prefix
 * differ only in colour.
 */
const SKU_COLOR_CODES = new Set([
  "BB", // Baby Blue
  "LB", // Light Beige
  "DB", // Dusty Blue
  "NB", // Navy Blue
  "SG", // SAGE Green
  "MG", // Mint Green
  "DC", // Dark Coffee
  "IV", // Ivory
  "GY", // Grey
  "WH", // White
  "BK", // Black
  "PK", // Pink
  "TP", // Taupe
  "CM", // Cream
  "BR", // Brown
  "TN", // Tan
  "RD", // Red
  "GR", // Green
  "BL", // Blue
  "YL", // Yellow
  "PR", // Purple
  "OR", // Orange
  "SV", // Silver
  "GD", // Gold
  "NT", // Natural
  "RS", // Rose
]);

/**
 * Build a merge key from a SKU by replacing the colour-code segment with a
 * placeholder. Two SKUs that produce the same key differ only in colour.
 * Falls back to the raw SKU when no segment looks like a colour code.
 *
 *   "GH-BED-SUGER-120-MG-NM" → "GH-BED-SUGER-120-X-NM"
 *   "GH-BED-SUGER-120-BB-NM" → "GH-BED-SUGER-120-X-NM"   // same key
 *   "GH-BED-SUGER-140-MG-WM" → "GH-BED-SUGER-140-X-WM"   // different key
 */
export function skuColorKey(sku: string): string {
  const parts = sku.split("-");
  const idx = parts.findIndex((p) => SKU_COLOR_CODES.has(p.toUpperCase()));
  if (idx < 0) return sku;
  const stripped = parts.slice();
  stripped[idx] = "X";
  return stripped.join("-");
}

/**
 * Combines both signals: group by whichever is more specific. Prefer the
 * title-based key when the variantName clearly contains a colour, otherwise
 * fall back to the SKU-based key for data where variantName has already
 * been rewritten by an earlier dedupe pass.
 */
export function colorMergeKey(opts: {
  variantName: string | null;
  sku: string;
}): { key: string; strippedColor: string | null } {
  const t = (opts.variantName ?? "").trim();
  if (t) {
    const colored = t.split("/").find((s) => isColorValue(s));
    if (colored) {
      return { key: nonColorKey(t), strippedColor: colored.trim() };
    }
  }
  return { key: skuColorKey(opts.sku), strippedColor: null };
}
