import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Shimmer className="h-7 w-64" />
        <Shimmer className="h-4 w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6 space-y-3">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-8 w-32" />
            <Shimmer className="h-3 w-20" />
          </Card>
        ))}
      </div>
      <Card className="p-6 space-y-3">
        <Shimmer className="h-4 w-48" />
        <Shimmer className="h-60 w-full" />
      </Card>
    </div>
  );
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-md bg-gradient-to-r from-secondary via-muted to-secondary bg-[length:200%_100%] animate-shimmer ${className ?? ""}`}
    />
  );
}
