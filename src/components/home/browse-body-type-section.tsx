import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BODY_TYPE_LABELS, NAV_BODY_TYPES, bodyTypeHref } from "@/lib/nav";
import { ResponsiveImage } from "@/components/responsive-image";



export function BrowseBodyTypeSection() {
  return (
    <section className="py-12 bg-background" aria-labelledby="body-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h2 id="body-heading" className="speed-line text-2xl sm:text-3xl font-bold font-heading text-foreground">
            Browse by body type
          </h2>
          <Link 
            href="/used-cars" 
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline transition-colors"
          >
            View all body types <ArrowRight className="size-4" />
          </Link>
        </div>

        <div 
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4"
        >
          {NAV_BODY_TYPES.map((b) => (
            <div key={b}>
              <Link
                href={bodyTypeHref(b)}
                className="group relative flex flex-col justify-end overflow-hidden rounded-xl border border-border/60 bg-slate-900 aspect-[4/5] shadow-sm hover:shadow-md transition-all duration-300 block"
              >
                <ResponsiveImage src={`/brand/body-types/${b}.jpg`} alt="" fill className="object-cover" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="relative z-10 p-3.5 text-center">
                  <span className="font-heading text-sm sm:text-base font-bold text-white tracking-wide drop-shadow-md">
                    {BODY_TYPE_LABELS[b]}
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
