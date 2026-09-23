import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/ui/container";

/** Route-level loading skeleton: a header band, a page title, and a card grid. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="dark h-[var(--header-height)] bg-background" />
      <Container className="py-8 lg:py-12">
        <Skeleton variant="text" className="h-4 w-40" />
        <Skeleton className="mt-4 h-9 w-72 max-w-full" />
        <Skeleton variant="text" className="mt-3 h-4 w-96 max-w-full" />
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton variant="text" className="h-5 w-3/4" />
                <Skeleton variant="text" className="h-4 w-1/2" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
