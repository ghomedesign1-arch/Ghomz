import {
  BarChart3,
  Boxes,
  ClipboardList,
  Factory,
  FileText,
  LayoutDashboard,
  Layers,
  ReceiptText,
  Scissors,
  Settings,
  ShoppingBag,
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

/** Single source of truth for sidebar / mobile-drawer navigation. */
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
    ],
  },
  {
    section: "Operations",
    items: [
      { href: "/production",    label: "Production",        icon: Factory },
      { href: "/custom-orders", label: "Custom orders",     icon: ClipboardList },
      { href: "/pricing",       label: "Pricing scenarios", icon: Tags },
      { href: "/purchases",     label: "Purchases",         icon: ReceiptText },
      { href: "/suppliers",     label: "Suppliers",         icon: Truck },
    ],
  },
  {
    section: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

/**
 * Active-state predicate shared by desktop + mobile nav.
 *
 * Rules:
 *   - "/" only lights up on the exact root pathname
 *   - Any other href lights up when the pathname matches it or starts with
 *     `href + "/"` — UNLESS a sibling in the same group has a longer prefix
 *     match. That way `/sponges/intake` doesn't also highlight `/sponges`.
 */
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
