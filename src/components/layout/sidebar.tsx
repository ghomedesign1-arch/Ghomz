"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Factory,
  FileText,
  LayoutDashboard,
  Layers,
  PackageSearch,
  ReceiptText,
  Scissors,
  Settings,
  ShoppingBag,
  Tags,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const NAV = [
  {
    section: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    section: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: ShoppingBag },
      { href: "/sponges", label: "Sponges", icon: Layers },
      { href: "/sponges/intake", label: "Sponge intake", icon: ReceiptText },
      { href: "/cutting-lists", label: "Cutting lists", icon: FileText },
      { href: "/fabrics", label: "Fabrics", icon: Scissors },
      { href: "/materials", label: "Bulk materials", icon: Boxes },
    ],
  },
  {
    section: "Operations",
    items: [
      { href: "/production", label: "Production", icon: Factory },
      { href: "/custom-orders", label: "Custom orders", icon: ClipboardList },
      { href: "/pricing", label: "Pricing scenarios", icon: Tags },
      // { href: "/inventory", label: "Inventory", icon: PackageSearch },  // hidden — re-enable when ready
      { href: "/purchases", label: "Purchases", icon: ReceiptText },
      { href: "/suppliers", label: "Suppliers", icon: Truck },
    ],
  },
  {
    section: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

interface SidebarProps {
  /** Custom brand logo (uploaded via Settings). Falls back to the bundled
   *  G-Homz mark when null. */
  logoUrl?: string | null;
}

export function Sidebar({ logoUrl }: SidebarProps = {}) {
  const pathname = usePathname();
  const resolvedLogo = logoUrl ?? "/g-homz-logo.svg";
  // Custom uploaded logos go through next/image's unoptimized path because
  // they live under /public/uploads and the next/image loader can mis-cache
  // the cache-busted query string. The default bundled SVG keeps the
  // optimized pipeline.
  const isCustom = Boolean(logoUrl);
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card/40 backdrop-blur-sm md:flex md:flex-col">
      <div className="flex h-20 items-center gap-3 border-b px-5">
        <Image
          src={resolvedLogo}
          alt="Brand logo"
          width={112}
          height={112}
          priority
          unoptimized={isCustom}
          className="h-14 w-14 shrink-0 rounded-xl object-contain"
        />
        <div>
          <div className="font-display text-lg font-semibold leading-none tracking-tight">
            G-Homz
          </div>
          <div className="mt-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            Production ERP
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6 scrollbar-thin">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.section}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                // An item is active when its href matches the pathname AND no
                // sibling has a longer matching prefix (so /sponges/intake
                // doesn't also light up /sponges).
                const matches =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                const longerMatch = group.items.some(
                  (other) =>
                    other.href !== item.href &&
                    other.href.length > item.href.length &&
                    (pathname === other.href ||
                      pathname.startsWith(other.href + "/")),
                );
                const active = matches && !longerMatch;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      )}
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t p-4">
        <div className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">v1.0 · ERP</div>
          <div className="mt-0.5">EGP · Egyptian Pound</div>
        </div>
      </div>
    </aside>
  );
}
