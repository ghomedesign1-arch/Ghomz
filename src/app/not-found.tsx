import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="font-display text-6xl font-semibold tracking-tight">
        404
      </div>
      <p className="text-muted-foreground">
        We couldn&apos;t find what you were looking for.
      </p>
      <Button asChild>
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
