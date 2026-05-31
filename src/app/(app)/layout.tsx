import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/auth";
import { getBrandLogoUrl } from "@/lib/brand";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  // Resolve the brand logo on the server so the sidebar paints with the right
  // image on first load — no client-side flash from default to custom.
  const logoUrl = await getBrandLogoUrl();

  return (
    <div className="flex min-h-screen">
      <Sidebar logoUrl={logoUrl} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={{
            name: session.user?.name ?? "",
            email: session.user?.email ?? "",
            role: (session.user as { role?: string }).role ?? "VIEWER",
          }}
          logoUrl={logoUrl}
        />
        <main className="flex-1 px-6 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
