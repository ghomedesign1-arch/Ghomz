import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const session = await auth();
  if (session) redirect(searchParams.next ?? "/");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-sand-100 to-sand-300 p-12 dark:from-sand-800 dark:to-sand-900 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <span className="font-display text-lg font-bold">G</span>
          </div>
          <div>
            <div className="font-display text-base font-semibold leading-none">
              G-Homz
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Production ERP
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-semibold leading-tight">
            Comfort, engineered.
            <br />
            Costed to the gram.
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Sponge cuts, fabric meters, fiber grams and labor — all stitched
            into one cost graph so every sofa is priced with intent.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} G-Homz Manufacturing
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Sign in
            </h2>
            <p className="text-sm text-muted-foreground">
              Use your G-Homz workspace credentials.
            </p>
          </div>
          <LoginForm
            next={searchParams.next}
            initialError={searchParams.error}
          />
          <div className="rounded-xl border bg-secondary/40 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Seeded admin</div>
            <div className="mt-1 tabular-nums">
              founder@g-homz.com · changeme123
            </div>
            <div className="mt-1">
              Run <code className="rounded bg-secondary px-1">npm run db:seed</code> to provision.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
