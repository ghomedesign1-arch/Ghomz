"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProductTab {
  id: string;
  name: string;
  sku: string;
}

interface ProductTabsProps {
  products: ProductTab[];
}

/**
 * Horizontal pill bar across the top of every /products page. The "All
 * products" tab links to the catalog list; each subsequent tab links to a
 * product's detail page. Active state is derived from the URL pathname so
 * navigating via Next.js Link, browser back/forward and direct URLs all
 * highlight correctly.
 *
 * Visually: a sand-colored band with rounded pills. The active tab is filled
 * with the brand primary color and uses a Framer Motion `layoutId` so it
 * slides between tabs as you click.
 */
export function ProductTabs({ products }: ProductTabsProps) {
  const pathname = usePathname();
  const isAll = pathname === "/products";

  return (
    <div className="-mx-6 mb-8 md:-mx-10">
      <div className="border-b bg-gradient-to-b from-sand-50/80 to-transparent dark:from-sand-900/40 px-6 py-4 md:px-10">
        <div
          className="scrollbar-thin flex items-center gap-2 overflow-x-auto pb-1"
          role="tablist"
        >
          <TabLink href="/products" active={isAll}>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LayoutGrid className="h-3.5 w-3.5" />
            </span>
            <span>All products</span>
            <span
              className={cn(
                "ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                isAll
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {products.length}
            </span>
          </TabLink>

          {products.map((p) => {
            const href = `/products/${p.id}`;
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <TabLink key={p.id} href={href} active={active}>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold",
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-sand-200 text-sand-800 dark:bg-sand-700 dark:text-sand-100",
                  )}
                  aria-hidden
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate font-medium">{p.name}</span>
                <span
                  className={cn(
                    "ml-1 text-[10px] tracking-wider",
                    active
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground",
                  )}
                >
                  {p.sku.toUpperCase()}
                </span>
              </TabLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className="relative inline-flex max-w-[260px] shrink-0 items-center"
    >
      {active && (
        <motion.span
          layoutId="product-tab-active"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="absolute inset-0 rounded-full bg-primary shadow-soft"
        />
      )}
      <span
        className={cn(
          "relative inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors",
          active
            ? "text-primary-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        {children}
      </span>
    </Link>
  );
}
