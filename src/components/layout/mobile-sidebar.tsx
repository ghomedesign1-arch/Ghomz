"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, isActive } from "./nav-config";

interface MobileSidebarProps {
  /** Custom brand logo (uploaded via Settings). */
  logoUrl?: string | null;
}

/**
 * Hamburger trigger + slide-from-left drawer for screens below `md`. The
 * drawer mirrors the desktop sidebar's nav exactly (same `NAV` config) and
 * auto-closes when the user picks a destination.
 *
 * Renders nothing on `md` and up — the desktop `<Sidebar />` takes over.
 */
export function MobileSidebar({ logoUrl }: MobileSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const resolvedLogo = logoUrl ?? "/g-homz-logo.svg";
  const isCustom = Boolean(logoUrl);

  // Auto-close whenever the route changes (covers Link clicks + back button).
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Open navigation"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary"
        >
          <Menu className="h-5 w-5" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r bg-card shadow-elevated md:hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
            "duration-200",
          )}
        >
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>

          {/* ── Header ───────────────────────────────────────────────── */}
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
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg font-semibold leading-none tracking-tight">
                G-Homz
              </div>
              <div className="mt-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                Production ERP
              </div>
            </div>
            <Dialog.Close
              aria-label="Close navigation"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* ── Nav ──────────────────────────────────────────────────── */}
          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6 scrollbar-thin">
            {NAV.map((group) => (
              <div key={group.section}>
                <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group.section}
                </div>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item.href, pathname, group.items);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                            active
                              ? "bg-secondary text-foreground"
                              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                          )}
                        >
                          {active && (
                            <span
                              aria-hidden
                              className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
                            />
                          )}
                          <Icon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
