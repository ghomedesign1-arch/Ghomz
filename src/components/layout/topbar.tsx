"use client";

import { Bell, Globe, LogOut, Moon, Search, Sun } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";

interface TopbarProps {
  user: { name: string; email: string; role: string };
  /** Same brand logo passed to the desktop Sidebar — forwarded to the mobile
   *  drawer so both surfaces stay visually consistent. */
  logoUrl?: string | null;
}

export function Topbar({ user, logoUrl }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const initials =
    user.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "G";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:gap-3 sm:px-6">
      {/* Mobile-only hamburger that opens the slide-in nav drawer */}
      <MobileSidebar logoUrl={logoUrl} />

      <div className="relative hidden w-full max-w-md sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products, sponges, fabrics…"
          className="pl-9"
        />
      </div>
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {/* Hide the cosmetic icons on tight screens so the avatar isn't crowded. */}
        <Button variant="ghost" size="icon" aria-label="Language" className="hidden sm:inline-flex">
          <Globe className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="hidden sm:inline-flex">
          <Bell className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              aria-label="Account"
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium text-foreground">
                {user.name || "Account"}
              </div>
              <div className="text-xs font-normal text-muted-foreground">
                {user.email} · {user.role}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
