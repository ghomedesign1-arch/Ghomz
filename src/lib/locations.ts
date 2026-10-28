import type { ShopifyAddress } from "@/lib/shopify";

/** Areas offered in the ticket's location picker (governorates + resort towns). */
export const EGYPT_AREAS = [
  "Cairo",
  "Giza",
  "Alexandria",
  "North Coast",
  "Sharm El Sheikh",
  "Hurghada",
  "El Gouna",
  "Dahab",
  "Ain Sokhna",
  "Qalyubia",
  "Sharqia",
  "Dakahlia",
  "Gharbia",
  "Monufia",
  "Beheira",
  "Kafr El Sheikh",
  "Damietta",
  "Port Said",
  "Ismailia",
  "Suez",
  "Fayoum",
  "Beni Suef",
  "Minya",
  "Asyut",
  "Sohag",
  "Qena",
  "Luxor",
  "Aswan",
  "Red Sea",
  "South Sinai",
  "North Sinai",
  "Matrouh",
  "New Valley",
] as const;

// Resort towns sit inside bigger governorates, so match them on the city /
// address text first.
const TOWN_KEYWORDS: [string, RegExp][] = [
  ["Sharm El Sheikh", /sharm|شرم/],
  ["Hurghada", /hurghada|ghardaqa|ghardaka|الغردقة/],
  ["El Gouna", /gouna|الجونة/],
  ["Dahab", /dahab|دهب/],
  ["Ain Sokhna", /sokhna|السخنة/],
  ["North Coast", /north coast|sahel|alamein|marassi|الساحل|العلمين/],
];

// Governorate spellings seen in Shopify / customer input → area name.
const GOVERNORATE_KEYWORDS: [string, RegExp][] = [
  ["Giza", /giza|gizeh|october|zayed|الجيزة|اكتوبر|أكتوبر|زايد/],
  ["Alexandria", /alex|إسكندرية|اسكندرية/],
  ["Cairo", /cairo|helwan|القاهرة|حلوان/],
  ["Qalyubia", /qalyub|kalyub|القليوبية/],
  ["Sharqia", /sharq|sharkia|الشرقية/],
  ["Dakahlia", /dakahl|daqahl|الدقهلية/],
  ["Gharbia", /gharbi|الغربية/],
  ["Monufia", /monuf|menouf|minuf|المنوفية/],
  ["Beheira", /beheira|buhayrah|البحيرة/],
  ["Kafr El Sheikh", /kafr|كفر الشيخ/],
  ["Damietta", /damiet|dumyat|دمياط/],
  ["Port Said", /port said|بورسعيد/],
  ["Ismailia", /ismail|الإسماعيلية|الاسماعيلية/],
  ["Suez", /suez|السويس/],
  ["Fayoum", /fayoum|faiyum|fayyum|الفيوم/],
  ["Beni Suef", /beni suef|bani suwayf|بني سويف/],
  ["Minya", /minya|المنيا/],
  ["Asyut", /asyut|assiut|أسيوط|اسيوط/],
  ["Sohag", /sohag|suhag|سوهاج/],
  ["Qena", /qena|قنا/],
  ["Luxor", /luxor|الأقصر|الاقصر/],
  ["Aswan", /aswan|أسوان|اسوان/],
  ["Red Sea", /red sea|البحر الأحمر/],
  ["South Sinai", /south sinai|جنوب سيناء/],
  ["North Sinai", /north sinai|شمال سيناء/],
  ["Matrouh", /matrouh|matruh|مطروح/],
  ["New Valley", /new valley|الوادي الجديد/],
];

/** Area from the Shopify address, or null when nothing recognisable is there. */
export function autoArea(address: ShopifyAddress | null | undefined): string | null {
  if (!address) return null;
  const town = [address.city, address.address1, address.address2]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const [area, re] of TOWN_KEYWORDS) if (re.test(town)) return area;

  const gov = (address.province ?? "").toLowerCase();
  for (const [area, re] of GOVERNORATE_KEYWORDS) if (gov && re.test(gov)) return area;
  // No usable province — try the city as a governorate name.
  const city = (address.city ?? "").toLowerCase();
  for (const [area, re] of GOVERNORATE_KEYWORDS) if (city && re.test(city)) return area;

  return address.province?.trim() || null;
}

/** Manual override first, then the Shopify address. */
export function orderArea(
  order: {
    shipping_address: ShopifyAddress | null;
    billing_address: ShopifyAddress | null;
  },
  meta: { location?: string | null },
): string | null {
  return (
    meta.location ||
    autoArea(order.shipping_address) ||
    autoArea(order.billing_address)
  );
}
