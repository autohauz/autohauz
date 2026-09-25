import type { Metadata } from "next";
import { ListingPage } from "@/components/listing/listing-page";
import { listingMetadata } from "@/lib/seo/listing";
import { withRegion } from "@/config/seo";

const TITLE = withRegion("Used Cars for Sale");
const DESCRIPTION = `${withRegion("Browse quality, inspected used cars for sale")}. Filter by make, model, body type and price, with finance and trade-ins available.`;

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
  });
}

export default async function UsedCarsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  return (
    <ListingPage
      title={TITLE}
      description={DESCRIPTION}
      path="/used-cars"
      trail={[["Used cars", "/used-cars"]]}
      baseFilters={{}}
      sp={sp}
    />
  );
}
