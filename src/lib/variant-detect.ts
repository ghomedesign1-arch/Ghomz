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
 * Two variants with the same return value differ only in colour and are safe
 * to merge into a single canonical ERP product.
 *
 *   "W120 x D230 cm / Baby Blue / Without"  → "W120 x D230 cm / Without"
 *   "W120 x D230 cm / Light Beige / Without" → "W120 x D230 cm / Without"
 *   "W140 x D230 cm / Baby Blue / With"      → "W140 x D230 cm / With"
 */
export function nonColorKey(variantTitle: string | null | undefined): string {
  if (!variantTitle) return "";
  return variantTitle
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !isColorValue(s))
    .join(" / ");
}
