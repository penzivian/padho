import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown via each route's loading.tsx while the server component streams.
 * Mirrors the common page-shell layout (heading → stat row → two-column body)
 * so navigation feels instant instead of blank. Deliberately generic — one
 * skeleton for every dashboard/list page rather than bespoke per-route shapes.
 */
export function PageSkeleton() {
  return (
    <main className="page-shell" aria-hidden="true">
      {/* Header band */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="section-band space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="section-band space-y-4 lg:col-span-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
        <div className="section-band space-y-3 lg:col-span-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
