// Arabic labels for the printable order tickets (factory / delivery copy).

const COLOR_AR: Record<string, string> = {
  "beige": "بيج",
  "light beige": "بيج فاتح",
  "dark beige": "بيج غامق",
  "ivory": "عاجي",
  "off white": "أوف وايت",
  "white": "أبيض",
  "cream": "كريمي",
  "grey": "رمادي",
  "gray": "رمادي",
  "light grey": "رمادي فاتح",
  "light gray": "رمادي فاتح",
  "dark grey": "رمادي غامق",
  "dark gray": "رمادي غامق",
  "navy": "كحلي",
  "navy blue": "كحلي",
  "baby blue": "لبني",
  "light blue": "أزرق فاتح",
  "blue": "أزرق",
  "mint": "نعناعي",
  "mint green": "أخضر نعناعي",
  "green": "أخضر",
  "olive": "زيتي",
  "olive green": "أخضر زيتي",
  "pink": "وردي",
  "baby pink": "وردي فاتح",
  "rose": "روز",
  "dark coffee": "بني غامق",
  "coffee": "بني قهوة",
  "brown": "بني",
  "camel": "جملي",
  "mustard": "مستردة",
  "yellow": "أصفر",
  "black": "أسود",
  "lilac": "ليلكي",
  "purple": "بنفسجي",
  "red": "أحمر",
  "orange": "برتقالي",
  "terracotta": "تيراكوتا",
};

// Checked in order: "Baby Nest" must match before "Nest".
const PRODUCT_AR: [RegExp, string][] = [
  [/baby\s*nest/i, "بيبي نست"],
  [/baby\s*bloom/i, "بيبي بلوم"],
  [/tiny\s*cloud/i, "تيني كلود"],
  [/sug[ae]r\s*snap/i, "شوجر اسناب"],
  [/sleepy/i, "سليبي بيت"],
  [/milo/i, "ميلو بيد"],
  [/nest/i, "نست"],
];

/** Arabic product name, or null when the product isn't in the list. */
export function arabicProductName(title: string): string | null {
  for (const [re, ar] of PRODUCT_AR) if (re.test(title)) return ar;
  return null;
}

export const STATUS_AR: Record<string, string> = {
  NEW: "جديد",
  SCHEDULED: "مجدول",
  IN_PRODUCTION: "قيد التصنيع",
  READY: "جاهز",
  SHIPPED: "تم الشحن",
  CANCELLED: "ملغي",
};

export const PAYMENT_AR: Record<string, string> = {
  paid: "مدفوع بالكامل",
  deposit: "دفع عربون — الباقي عند الاستلام",
  unpaid: "غير مدفوع",
  refunded: "مسترد",
};

export interface ArabicVariant {
  size: string | null;
  color: string | null;
  /** true = with mattress, false = without, null = not stated / n/a. */
  mattress: boolean | null;
  extra: string[];
}

/** Splits "W120 x D220 cm / Dark Coffee / with" into Arabic fields. */
export function arabicVariant(
  title: string,
  variantTitle: string | null,
  sku: string | null,
): ArabicVariant {
  const parts = (variantTitle ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  let size: string | null = null;
  let color: string | null = null;
  let mattress: boolean | null = null;
  const extra: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    const w = /W\s*(\d+)/i.exec(part);
    const d = /D\s*(\d+)/i.exec(part);
    if (!size && (w || d)) {
      size = [w ? `عرض ${w[1]}` : null, d ? `طول ${d[1]}` : null]
        .filter(Boolean)
        .join(" × ") + " سم";
    } else if (lower === "with" || lower === "with mattress") {
      mattress = true;
    } else if (lower === "without" || lower === "without mattress") {
      mattress = false;
    } else if (!color) {
      const ar = COLOR_AR[lower];
      color = ar ? `${ar} (${part})` : part;
    } else {
      extra.push(part);
    }
  }
  if (mattress === null && sku) {
    const last = sku.split("-").pop()?.toUpperCase();
    if (last === "WM") mattress = true;
    else if (last === "NM") mattress = false;
  }
  // Baby Bloom has no mattress option (same rule as the ticket badge).
  if (/baby\s*bloom/i.test(title)) mattress = null;
  return { size, color, mattress, extra };
}
