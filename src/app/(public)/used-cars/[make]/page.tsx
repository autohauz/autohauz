import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListingPage } from "@/components/listing/listing-page";
import { getMakes, getVehicleCount } from "@/lib/data/inventory";
import { BUDGET_BANDS, formatPrice } from "@/lib/nav";
import { listingMetadata } from "@/lib/seo/listing";
import { makeTitle, makeDescription, budgetTitle, budgetDescription } from "@/lib/seo/templates";

export const revalidate = 300;

type Params = { make: string };
type SP = Record<string, string | string[] | undefined>;

// The [make] segment doubles as the budget landing (`under-{price}`), since both
// are single dynamic segments under /used-cars and can't be separate routes.
// Only the budget bands the site links to exist; any other number is a 404,
// not an infinite set of near-duplicate indexable pages.
const BUDGETS = new Set(BUDGET_BANDS.map((b) => b.max));
function parseBudget(seg: string): number | null {
  const m = /^under-(\d{3,7})$/.exec(seg);
  return m && BUDGETS.has(Number(m[1])) ? Number(m[1]) : null;
}

async function resolveMake(slug: string) {
  const makes = await getMakes();
  return makes.find((m) => m.slug === slug) ?? null;
}

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }): Promise<Metadata> {
  const [{ make }, sp] = await Promise.all([params, searchParams]);
  const budget = parseBudget(make);

  if (budget) {
    return listingMetadata({
      basePath: `/used-cars/under-${budget}`,
      sp,
      title: budgetTitle(budget),
      description: budgetDescription(budget),
      thin: { total: await getVehicleCount({ priceMax: budget }), kind: "category" },
    });
  }

  const m = await resolveMake(make);
  // An unresolved make renders notFound(); keep it out of the index either way.
  if (!m) return { title: "Used cars", robots: { index: false, follow: true } };

  return listingMetadata({
    basePath: `/used-cars/${m.slug}`,
    sp,
    title: makeTitle(m.name),
    description: makeDescription(m.name),
    thin: { total: await getVehicleCount({ make: m.slug }), kind: "makeModel" },
  });
}

export default async function MakeOrBudgetPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const [{ make }, sp] = await Promise.all([params, searchParams]);
  const budget = parseBudget(make);

  if (budget) {
    const path = `/used-cars/under-${budget}`;
    return (
      <ListingPage
        title={budgetTitle(budget)}
        description={budgetDescription(budget)}
        path={path}
        trail={[["Used cars", "/used-cars"], [`Under ${formatPrice(budget)}`, path]]}
        baseFilters={{ priceMax: budget }}
        sp={sp}
      />
    );
  }

  const m = await resolveMake(make);
  if (!m) notFound();

  const path = `/used-cars/${m.slug}`;
  return (
    <ListingPage
      title={makeTitle(m.name)}
      description={makeDescription(m.name)}
      path={path}
      trail={[["Used cars", "/used-cars"], [m.name, path]]}
      baseFilters={{ make: m.slug }}
      hideFilters={["make"]}
      sp={sp}
    />
  );
}
