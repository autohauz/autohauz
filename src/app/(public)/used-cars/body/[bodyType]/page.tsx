import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListingPage } from "@/components/listing/listing-page";
import { getVehicleCount } from "@/lib/data/inventory";
import { parseBodySegment, BODY_TYPE_LABELS } from "@/lib/nav";
import { listingMetadata } from "@/lib/seo/listing";
import { bodyTypeTitle, bodyTypeDescription, pluralBodyLabel } from "@/lib/seo/templates";

export const revalidate = 300;

type Params = { bodyType: string };
type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }): Promise<Metadata> {
  const [{ bodyType }, sp] = await Promise.all([params, searchParams]);
  const b = parseBodySegment(bodyType);
  if (!b) return { title: "Used cars", robots: { index: false, follow: true } };

  const label = BODY_TYPE_LABELS[b];
  return listingMetadata({
    basePath: `/used-cars/body/${bodyType}`,
    sp,
    title: bodyTypeTitle(label),
    description: bodyTypeDescription(label),
    keywords: [`used ${pluralBodyLabel(label).toLowerCase()} for sale`, `second hand ${label.toLowerCase()}`],
    thin: { total: await getVehicleCount({ bodyType: b }), kind: "category" },
  });
}

export default async function BodyTypePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const [{ bodyType }, sp] = await Promise.all([params, searchParams]);
  const b = parseBodySegment(bodyType);
  if (!b) notFound();
  const label = BODY_TYPE_LABELS[b];
  const path = `/used-cars/body/${bodyType}`;

  return (
    <ListingPage
      title={bodyTypeTitle(label)}
      description={bodyTypeDescription(label)}
      path={path}
      trail={[["Used cars", "/used-cars"], [label, path]]}
      baseFilters={{ bodyType: b }}
      hideFilters={["body"]}
      sp={sp}
    />
  );
}
