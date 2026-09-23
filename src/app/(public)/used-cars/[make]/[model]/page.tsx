import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListingPage } from "@/components/listing/listing-page";
import { getMakes, getModelsForMake, getVehicleCount } from "@/lib/data/inventory";
import { listingMetadata } from "@/lib/seo/listing";
import { makeModelTitle, makeModelDescription } from "@/lib/seo/templates";

export const revalidate = 300;

type Params = { make: string; model: string };
type SP = Record<string, string | string[] | undefined>;

async function resolve(makeSlug: string, modelSlug: string) {
  const [makes, models] = await Promise.all([getMakes(), getModelsForMake(makeSlug)]);
  const make = makes.find((m) => m.slug === makeSlug) ?? null;
  const model = models.find((m) => m.slug === modelSlug) ?? null;
  return { make, model };
}

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }): Promise<Metadata> {
  const [{ make, model }, sp] = await Promise.all([params, searchParams]);
  const r = await resolve(make, model);
  if (!r.make || !r.model) return { title: "Used cars", robots: { index: false, follow: true } };

  return listingMetadata({
    basePath: `/used-cars/${r.make.slug}/${r.model.slug}`,
    sp,
    title: makeModelTitle(r.make.name, r.model.name),
    description: makeModelDescription(r.make.name, r.model.name),
    keywords: [`used ${r.make.name} ${r.model.name}`, `${r.make.name} ${r.model.name} for sale`, `second hand ${r.make.name} ${r.model.name}`],
    thin: { total: await getVehicleCount({ make: r.make.slug, model: r.model.slug }), kind: "makeModel" },
  });
}

export default async function ModelPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const [{ make, model }, sp] = await Promise.all([params, searchParams]);
  const { make: mk, model: md } = await resolve(make, model);
  if (!mk || !md) notFound();

  const path = `/used-cars/${mk.slug}/${md.slug}`;
  return (
    <ListingPage
      title={makeModelTitle(mk.name, md.name)}
      description={makeModelDescription(mk.name, md.name)}
      path={path}
      trail={[["Used cars", "/used-cars"], [mk.name, `/used-cars/${mk.slug}`], [md.name, path]]}
      baseFilters={{ make: mk.slug, model: md.slug }}
      hideFilters={["make"]}
      sp={sp}
    />
  );
}
