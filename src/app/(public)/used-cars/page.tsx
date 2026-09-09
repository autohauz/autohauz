import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { InventoryListingView } from "@/components/inventory-listing-view";
import { ListingBreadcrumbs } from "@/components/listing-breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { collectionPageSchema } from "@/lib/seo/jsonld";
import { listingMetadata } from "@/lib/seo/listing";

const TITLE = "Used Cars for Sale in Sydney, NSW";
const DESCRIPTION =
  "Browse quality, inspected used cars for sale in Lansvale, Sydney. Filter by make, model, body type and price, with finance and trade-ins available Australia-wide.";

export const revalidate = 60;

type SP = Record<string, string | string[] | undefined>;

/**
 * Metadata is generated per-request because indexability depends on the query
 * string: the clean hub is indexable and self-canonical, while filtered/sorted
 * permutations are `noindex, follow` and canonicalise back here.
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  return listingMetadata({
    basePath: "/used-cars",
    sp: await searchParams,
    title: TITLE,
    description: DESCRIPTION,
    keywords: ["used cars for sale", "second hand cars Sydney", "used car dealer NSW", "cheap used cars Australia"],
  });
}

export default async function UsedCarsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  return (
    <>
      <JsonLd schema={collectionPageSchema({ name: TITLE, description: DESCRIPTION, path: "/used-cars" })} />
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8">
        <ListingBreadcrumbs trail={[["Used Cars", "/used-cars"]]} />
        <header className="relative mb-8 overflow-hidden rounded-2xl bg-slate-50 border border-slate-200 p-8 shadow-sm dark:bg-card dark:border-border lg:p-12">
          <div className="relative z-10 max-w-3xl">
            <span className="mb-3 inline-block rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white dark:bg-white dark:text-black">
              Premium Inventory
            </span>
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              Used cars for sale in Sydney
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-700 dark:text-slate-300 sm:text-xl">
              Quality, inspected cars ready to drive away — every vehicle comes with a roadworthy
              certificate, transparent pricing and finance options.
            </p>
          </div>
          {/* Subtle elegant dark accents in the background */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-slate-900/10 blur-3xl dark:bg-white/10"></div>
          <div className="pointer-events-none absolute right-20 top-20 h-32 w-32 rounded-full bg-slate-900/5 blur-2xl dark:bg-white/5"></div>
        </header>
        <InventoryListingView baseFilters={{}} sp={sp} basePath="/used-cars" />
      </main>
      <SiteFooter />
    </>
  );
}
