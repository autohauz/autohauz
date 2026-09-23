import { Skeleton } from "@/components/ui/skeleton";

export default function AdminInventoryLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton variant="text" className="h-4 w-80 max-w-full mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </section>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/50 px-4 py-3 flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="text" className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="border-b border-border px-4 py-4 flex gap-4 items-center">
            {Array.from({ length: 6 }).map((_, j) => (
              <Skeleton key={j} variant="text" className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
