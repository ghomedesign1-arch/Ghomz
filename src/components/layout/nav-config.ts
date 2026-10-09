import {
  BarChart3,
  Boxes,
  Circle,
  ClipboardList,
  Factory,
  FileText,
  LayoutDashboard,
  Layers,
  ReceiptText,
  Scissors,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tags,
  Truck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    section: "Overview",
    items: [
      { href: "/",          label: "Dashboard", icon: LayoutDashboard },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    section: "Catalog",
    items: [
      { href: "/products",       label: "Products",       icon: ShoppingBag },
      { href: "/sponges",        label: "Sponges",        icon: Layers },
      { href: "/sponges/intake", label: "Sponge intake",  icon: ReceiptText },
      { href: "/cutting-lists",  label: "Cutting lists",  icon: FileText },
      { href: "/fabrics",        label: "Fabrics",        icon: Scissors },
      { href: "/materials",      label: "Bulk materials", icon: Boxes },
      { href: "/pocket-coils",   label: "Pocket coils",   icon: Circle },
    ],
  },
  {
    section: "Operations",
    items: [
      { href: "/shopify-orders", label: "Shopify orders",    icon: ShoppingCart },
      { href: "/production",     label: "Production",        icon: Factory },
      { href: "/custom-orders",  label: "Custom orders",     icon: ClipboardList },
      { href: "/pricing",        label: "Pricing scenarios", icon: Tags },
      { href: "/purchases",      label: "Purchases",         icon: ReceiptText },
      { href: "/suppliers",      label: "Suppliers",         icon: Truck },
    ],
  },
  {
    section: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function isActive(
  href: string,
  pathname: string,
  groupItems?: readonly { href: string }[],
): boolean {
  const matches =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");
  if (!matches) return false;
  if (!groupItems) return true;
  return !groupItems.some(
    (other) =>
      other.href !== href &&
      other.href.length > href.length &&
      (pathname === other.href || pathname.startsWith(other.href + "/")),
  );
}
