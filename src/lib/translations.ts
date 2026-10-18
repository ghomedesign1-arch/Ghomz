// Arabic translations for G-Homz product names and common variant colours.
// Keys match the exact English strings Shopify stores. If a term is missing,
// callers fall back to showing the English string only.
//
// Add or correct translations here — nothing else needs to change.

export const PRODUCT_AR: Record<string, string> = {
  "Tiny Cloud": "تايني كلاود",
  "The Nest Bed": "ذا نست بيد",
  "Suger Snap": "شوجر سناب",
  "Baby Bloom": "بيبي بلووم",
  "Baby Bloom With Extension": "بيبي بلووم مع إضافة",
  "Butter Sofa": "بتر صوفا",
  "Butter Chair": "بتر تشير",
  "Cooking Comfort": "كوكينج كومفورت",
};

export const COLOR_AR: Record<string, string> = {
  "Baby Blue": "أزرق سماوي",
  "Light Beige": "بيج فاتح",
  "Dark Beige": "بيج غامق",
  "Navy Blue": "كحلي",
  "Dusty Blue": "أزرق باهت",
  "SAGE Green": "أخضر زيتي",
  "Mint Green": "أخضر مينت",
  "Dark Coffee": "بني غامق",
  "Grey": "رمادي",
  "Ivory": "عاجي",
  "Beige": "بيج",
  "White": "أبيض",
  "Black": "أسود",
  "Pink": "وردي",
};

export function translateProduct(name: string): string | null {
  return PRODUCT_AR[name] ?? null;
}

export function translateColor(color: string | null): string | null {
  if (!color) return null;
  return COLOR_AR[color] ?? null;
}

/** "Light Beige" → "Light Beige / بيج فاتح" or just the English if no match. */
export function bilingualColor(color: string | null): string {
  if (!color) return "";
  const ar = translateColor(color);
  return ar ? `${color} / ${ar}` : color;
}

export function bilingualProduct(name: string): string {
  const ar = translateProduct(name);
  return ar ? `${name} / ${ar}` : name;
}

/** "120" → "W120 / عرض 120 سم" */
export function bilingualWidth(width: string): string {
  if (!width || width === "—") return "";
  return `W${width} / عرض ${width} سم`;
}

/** "120" + "230" → "W120 × D230 / 120 × 230 سم" */
export function bilingualDimension(
  width: string | null | undefined,
  depth: string | null | undefined,
): string {
  const hasW = width && width !== "—";
  const hasD = depth && depth !== "—";
  if (!hasW && !hasD) return "";
  if (hasW && hasD) return `W${width} × D${depth} / ${width} × ${depth} سم`;
  if (hasW) return `W${width} / عرض ${width} سم`;
  return `D${depth} / عمق ${depth} سم`;
}

const WITH_WITHOUT_AR: Record<string, string> = {
  with: "مع",
  without: "بدون",
  yes: "نعم",
  no: "لا",
  none: "بدون",
};

export function bilingualFlag(flag: string): string | null {
  const ar = WITH_WITHOUT_AR[flag.toLowerCase().trim()];
  return ar ? `${flag} / ${ar}` : null;
}

/**
 * Translate a full Shopify variant string like
 * "W120 x D230 cm / Baby Blue / Without" into a bilingual form:
 * "W120 x D230 cm / 120 × 230 سم · Baby Blue / أزرق سماوي · Without / بدون"
 */
export function bilingualVariant(variant: string | null | undefined): string {
  if (!variant) return "";
  const parts = variant.split("/").map((s) => s.trim()).filter(Boolean);
  const widthRegex = /W\s*(\d+)/i;
  const depthRegex = /D\s*(\d+)/i;
  const out: string[] = [];
  for (const p of parts) {
    const wMatch = widthRegex.exec(p);
    const dMatch = depthRegex.exec(p);
    if (wMatch || dMatch) {
      const dim = bilingualDimension(
        wMatch ? wMatch[1] : null,
        dMatch ? dMatch[1] : null,
      );
      if (dim) out.push(dim);
      continue;
    }
    const flag = bilingualFlag(p);
    if (flag) {
      out.push(flag);
      continue;
    }
    const color = bilingualColor(p);
    out.push(color);
  }
  return out.join(" · ");
}
