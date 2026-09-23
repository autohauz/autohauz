import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { site } from "@/config/site";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="dark bg-background">
        <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--container-page)] items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label={`${site.brandName} home`}>
            <BrandLogo variant="dark" height={44} priority />
          </Link>
        </div>
      </div>
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="tabular text-sm font-semibold text-accent">404</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">We can&apos;t find that page</h1>
        <p className="mt-3 max-w-md text-body">The link may be out of date, or the car may have been sold and removed. The stock changes every week.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/used-cars" size="cta">
            Browse cars for sale
          </ButtonLink>
          <ButtonLink href="/" variant="outline" size="cta">
            Go to the homepage
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
