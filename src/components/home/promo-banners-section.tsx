import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ResponsiveImage } from "@/components/responsive-image";

export function PromoBannersSection() {
  return (
    <section className="py-12 bg-background" aria-label="Sell your car and finance banners">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Sell Your Car Banner */}
          <div
            className="relative overflow-hidden rounded-2xl bg-[#091b38] text-white p-8 sm:p-10 flex flex-col justify-between min-h-[280px] shadow-lg border border-border/40"
          >
            <div className="absolute inset-0 z-0">
              <ResponsiveImage src="/images/heroes/sell-car-hero.jpg" alt="" fill className="object-cover object-right opacity-35" sizes="(max-width: 1024px) 100vw, 50vw" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#091b38] via-[#091b38]/90 to-transparent" />
            </div>

            <div className="relative z-10 space-y-2 max-w-md">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--azure-300)]">Sell your car</p>
              <h3 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-white">
                A simple way to sell
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mt-2">
                Get a fair, no-obligation offer. We make the process quick, transparent and hassle-free.
              </p>
            </div>

            <div className="relative z-10 mt-6">
              <ButtonLink href="/sell-your-car" size="lg" className="w-fit">
                Get a valuation <ArrowRight className="size-4 ml-1.5" />
              </ButtonLink>
            </div>
          </div>

          {/* Finance Your Next Car Banner */}
          <div
            className="relative overflow-hidden rounded-2xl bg-slate-50 text-slate-900 p-8 sm:p-10 flex flex-col justify-between min-h-[280px] shadow-sm border border-slate-200/80"
          >
            <div className="absolute inset-0 z-0">
              <ResponsiveImage src="/images/heroes/finance-hero.jpg" alt="" fill className="object-cover object-right opacity-30 mix-blend-multiply" sizes="(max-width: 1024px) 100vw, 50vw" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-slate-50/95 to-transparent" />
            </div>

            <div className="relative z-10 space-y-2 max-w-md">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Finance Your Next Car</p>
              <h3 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-slate-900">
                Drive now, pay your way
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mt-2">
                Competitive rates and flexible options to suit your needs. Our team will help you find the right solution.
              </p>
            </div>

            <div className="relative z-10 mt-6">
              <ButtonLink href="/finance" variant="outline" size="lg" className="w-fit bg-white hover:bg-slate-100">
                Explore finance <ArrowRight className="size-4 ml-1.5" />
              </ButtonLink>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
