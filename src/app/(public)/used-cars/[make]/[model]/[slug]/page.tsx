import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { decodeSegment } from "@/lib/routing";
import type { Metadata } from "next";
import { ShieldCheck, BadgeCheck, Handshake, CircleDollarSign, MapPin, Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { VehicleGallery } from "@/components/vehicle-gallery";
import { VehicleCard } from "@/components/vehicle-card";
import { VdpLeadActions } from "@/components/leads/vdp-lead-actions";
import { ListingBreadcrumbs } from "@/components/listing-breadcrumbs";
import { FinanceCalculator } from "@/components/finance-calculator";
import { FavoriteButton } from "@/components/favorite-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getVehicleBySlug, getSimilarVehicles } from "@/lib/data/inventory";
import { getFinanceParams, getPhoneNumbers } from "@/lib/data/settings";
import { resolveRedirect } from "@/lib/data/redirects";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { JsonLd } from "@/components/json-ld";
import { vehicleSchema, breadcrumbSchema } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { BODY_TYPE_LABELS, FUEL_LABELS, TRANSMISSION_LABELS, DRIVE_LABELS, formatKm, formatPrice } from "@/lib/nav";
import type { VehicleImage } from "@/lib/domain";
import { site } from "@/config/site";
import { VEHICLE_PLACEHOLDER } from "@/lib/media";
import { withRegion } from "@/config/seo";

export const revalidate = 900;

// No pages are pre-built; each one is rendered on its first request and then
// served from cache until `revalidate` (on-demand ISR). Without this, a
// dynamic segment is rendered on every request and `revalidate` is ignored.
export async function generateStaticParams() {
  return [];
}

type Params = { make: string; model: string; slug: string };

const FEATURE_GROUP_LABELS = { safety: "Safety", comfort: "Comfort", technology: "Technology", exterior: "Exterior" } as const;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const slug = decodeSegment((await params).slug);
  const v = await getVehicleBySlug(slug);
  if (!v) return { title: "Vehicle not found", robots: { index: false, follow: true } };

  const name = `${v.year} ${v.makeName} ${v.modelName}${v.variant ? ` ${v.variant}` : ""}`;
  // The root layout's template appends the brand; a manual suffix would double
  // it and push the model name past Google's ~60-character truncation.
  const title = `${name} for Sale — ${formatPrice(v.price)}`;
  const baseDesc = `${withRegion(`${name} for sale`)}. ${formatKm(v.mileageKm)}, ${TRANSMISSION_LABELS[v.transmission]}, ${FUEL_LABELS[v.fuelType]}, ${formatPrice(v.price)}.`;
  const extraDesc = v.description ? ` ${v.description.slice(0, 80).trim()}…` : " Inspected before listing and ready to drive away.";
  const path = `/used-cars/${v.makeSlug}/${v.modelSlug}/${v.slug}`;

  return {
    ...pageMetadata({
      path,
      title,
      description: `${baseDesc}${extraDesc} Finance and trade-ins available at ${site.brandName}.`,
      // The car's own cover photo is the strongest social thumbnail and the
      // image Google associates with this vehicle entity.
      image: v.coverImageUrl,
    }),
    // A sold car is expired inventory: crawlable so link equity flows to the
    // model hub, but out of the index. Archived cars 301 to the model page.
    ...(v.status === "sold" ? { robots: { index: false, follow: true, googleBot: { index: false, follow: true } } } : {}),
  };
}

export default async function VehicleDetailPage({ params }: { params: Promise<Params> }) {
  const raw = await params;
  const [make, model, slug] = [raw.make, raw.model, raw.slug].map(decodeSegment);
  const [v, financeParams, phones] = await Promise.all([getVehicleBySlug(slug), getFinanceParams(), getPhoneNumbers()]);
  if (!v) {
    // Sold cars are archived 60 days after sale with a 301 to the model page.
    const rule = await resolveRedirect(`/used-cars/${make}/${model}/${slug}`);
    if (rule && rule.code !== 410) permanentRedirect(rule.toPath);
    notFound();
  }

  // The slug identifies the car; a wrong make/model prefix is a duplicate URL.
  if (make !== v.makeSlug || model !== v.modelSlug) {
    permanentRedirect(`/used-cars/${v.makeSlug}/${v.modelSlug}/${v.slug}`);
  }

  const similar = await getSimilarVehicles({ id: v.id, bodyType: v.bodyType, price: v.price });
  const title = `${v.year} ${v.makeName} ${v.modelName}`;
  const fullTitle = `${title}${v.variant ? ` ${v.variant}` : ""}`;
  const vdpPath = `/used-cars/${v.makeSlug}/${v.modelSlug}/${v.slug}`;
  const modelPath = `/used-cars/${v.makeSlug}/${v.modelSlug}`;

  const jsonLd = [
    // The Offer references the site-wide AutoDealer node by @id, so seller name
    // comes from <SiteEntityGraph /> rather than being redeclared here.
    vehicleSchema(v, { path: vdpPath }),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Used cars", path: "/used-cars" },
      { name: v.makeName, path: `/used-cars/${v.makeSlug}` },
      { name: v.modelName, path: modelPath },
      { name: fullTitle, path: vdpPath },
    ]),
  ];

  const galleryImages: VehicleImage[] =
    v.images && v.images.length > 0 ? v.images : [{ id: "cover", url: v.coverImageUrl || VEHICLE_PLACEHOLDER, altText: v.coverImageAlt, sortOrder: 0, isCover: true }];

  const phone = phones.primary || null;
  const whatsapp = phones.whatsapp || null;
  const whatsappUrl = whatsapp ? buildWhatsAppUrl(whatsapp, `Hi, I'm interested in the ${fullTitle} (stock ${v.stockId}).`) : null;
  const isSold = v.status === "sold";
  const isReserved = v.status === "reserved";
  const reduced = v.previousPrice != null && v.previousPrice > v.price;

  const specs: { label: string; value: string | null }[] = [
    { label: "Kilometres", value: formatKm(v.mileageKm) },
    { label: "Year", value: String(v.year) },
    { label: "Transmission", value: TRANSMISSION_LABELS[v.transmission] },
    { label: "Fuel", value: FUEL_LABELS[v.fuelType] },
    { label: "Body", value: BODY_TYPE_LABELS[v.bodyType] },
    { label: "Drive", value: v.driveType ? DRIVE_LABELS[v.driveType] : null },
    { label: "Engine", value: v.engine },
    { label: "Power", value: v.powerKw ? `${v.powerKw} kW` : null },
    { label: "Seats", value: v.seats ? String(v.seats) : null },
    { label: "Doors", value: v.doors ? String(v.doors) : null },
    { label: "Colour", value: v.exteriorColor },
    { label: "Interior", value: v.interior },
    { label: "Registration", value: v.registration },
    { label: "Rego expiry", value: v.regoExpiry ? new Date(v.regoExpiry).toLocaleDateString("en-AU", { month: "short", year: "numeric" }) : null },
    { label: "VIN", value: v.vinMasked ? `…${v.vinMasked}` : null },
    { label: "Stock number", value: v.stockId },
  ].filter((s) => s.value);

  const featureGroups = (["safety", "comfort", "technology", "exterior"] as const)
    .map((cat) => ({ cat, items: v.features.filter((f) => f.category === cat) }))
    .filter((g) => g.items.length > 0);

  const assurances = [
    v.roadworthyIncluded ? { icon: ShieldCheck, text: "Roadworthy certificate included" } : null,
    v.warrantyText ? { icon: ShieldCheck, text: v.warrantyText } : null,
    v.safetyRating ? { icon: ShieldCheck, text: v.safetyRating } : null,
    v.inspectionAvailable ? { icon: BadgeCheck, text: "Inspect it in person before you decide" } : null,
    v.financeAvailable ? { icon: CircleDollarSign, text: "Finance can be arranged" } : null,
    v.tradeInWelcome ? { icon: Handshake, text: "Trade-ins welcome" } : null,
  ].filter((a): a is { icon: typeof ShieldCheck; text: string } => a !== null);

  const priceBlock = (
    <div>
      <p className="tabular text-3xl font-bold leading-none text-foreground">
        {formatPrice(v.price)}
        {reduced ? (
          <span className="ml-2 align-middle text-base font-normal text-muted-foreground line-through" aria-label={`was ${formatPrice(v.previousPrice!)}`}>
            {formatPrice(v.previousPrice!)}
          </span>
        ) : null}
      </p>
      {reduced ? (
        <Badge variant="success" className="mt-2">
          Price drop: {formatPrice(v.previousPrice! - v.price)} off
        </Badge>
      ) : null}
      {v.weeklyEstimate && v.financeAvailable ? (
        <p className="mt-2 text-sm text-body">
          From <span className="tabular font-semibold text-foreground">{formatPrice(v.weeklyEstimate)}</span>/week with finance*
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      <JsonLd schema={jsonLd} />
      <SiteHeader />
      <main id="main" className="py-6 lg:py-10">
        <Container>
          {/* Breadcrumb JSON-LD is bundled with the Vehicle schema above, so this is the visual trail only. */}
          <ListingBreadcrumbs
            trail={[
              ["Used cars", "/used-cars"],
              [v.makeName, `/used-cars/${v.makeSlug}`],
              [v.modelName, modelPath],
              [`${v.year} ${v.variant ?? v.modelName}`, vdpPath],
            ]}
            suppressSchema
          />

          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {isSold ? <Badge variant="neutral">Sold</Badge> : isReserved ? <Badge variant="warning">Reserved</Badge> : v.isNewArrival ? <Badge variant="info">New arrival</Badge> : null}
                {v.isFeatured && !isSold ? <Badge variant="solid">Featured</Badge> : null}
              </div>
              <h1 className="text-2xl sm:text-3xl">{title}</h1>
              {v.variant ? <p className="mt-1 text-lg text-body">{v.variant}</p> : null}
              <ul className="mt-3 flex flex-wrap text-sm text-body [&>li+li]:ml-3 [&>li+li]:border-l [&>li+li]:border-border [&>li+li]:pl-3">
                <li className="tabular">{formatKm(v.mileageKm)}</li>
                <li>{TRANSMISSION_LABELS[v.transmission]}</li>
                <li>{FUEL_LABELS[v.fuelType]}</li>
                <li>{BODY_TYPE_LABELS[v.bodyType]}</li>
                {v.location ? (
                  <li className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {v.location.city}
                  </li>
                ) : null}
              </ul>
            </div>
            <FavoriteButton vehicleId={v.id} label={`Save ${fullTitle}`} className="shrink-0" />
          </header>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
            <div className="min-w-0">
              <VehicleGallery images={galleryImages} title={fullTitle} sold={isSold} />

              {isSold ? (
                <div className="mt-6 rounded-lg border border-border bg-muted p-4 text-sm text-body">
                  This car has been sold.{" "}
                  <Link href={modelPath} className="font-semibold text-accent underline-offset-4 hover:underline">
                    See other {v.makeName} {v.modelName} listings
                  </Link>
                  .
                </div>
              ) : null}

              <section className="mt-10" aria-labelledby="vdp-specs">
                <h2 id="vdp-specs" className="text-2xl font-extrabold tracking-tight text-[#0a1e3f] mb-6">
                  Specifications
                </h2>
                <div className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm overflow-hidden">
                  <dl className="grid grid-cols-1 sm:grid-cols-2">
                    {specs.map((s) => (
                      <div 
                        key={s.label} 
                        className="flex items-center justify-between p-4 sm:px-6 sm:py-5 border-b border-[#e5e7eb] sm:even:border-l sm:even:border-[#e5e7eb] hover:bg-[#f8faff] transition-colors"
                      >
                        <dt className="text-[14px] text-[#6b7280] font-medium">{s.label}</dt>
                        <dd className="tabular-nums text-right text-[15px] font-bold text-[#111827]">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              {featureGroups.length > 0 ? (
                <section className="mt-10" aria-labelledby="vdp-features">
                  <h2 id="vdp-features" className="text-2xl font-extrabold tracking-tight text-[#0a1e3f] mb-6">
                    Features
                  </h2>
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm overflow-hidden p-6 sm:p-8">
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                      {featureGroups.map((g) => (
                        <div key={g.cat}>
                          <h3 className="mb-4 text-[13px] font-bold text-[#0a1e3f] uppercase tracking-wider">{FEATURE_GROUP_LABELS[g.cat]}</h3>
                          <ul className="space-y-3">
                            {g.items.map((f) => (
                              <li key={f.id} className="flex items-start gap-3 text-[14px] text-[#4b5563] font-medium leading-snug">
                                <Check className="mt-[2px] size-4 shrink-0 text-[#0A7AF5]" aria-hidden="true" />
                                {f.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              {v.description ? (
                <section className="mt-10" aria-labelledby="vdp-description">
                  <h2 id="vdp-description" className="text-xl">
                    About this car
                  </h2>
                  <p className="mt-4 max-w-prose whitespace-pre-line leading-relaxed text-body">{v.description}</p>
                </section>
              ) : null}

              {assurances.length > 0 ? (
                <section className="mt-10 rounded-lg border border-border bg-card p-5" aria-labelledby="vdp-assurance">
                  <h2 id="vdp-assurance" className="text-xl">
                    What you get
                  </h2>
                  <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {assurances.map((a) => (
                      <li key={a.text} className="flex items-start gap-2.5 text-sm text-body">
                        <a.icon className="mt-0.5 size-5 shrink-0 text-accent-bright" aria-hidden="true" />
                        {a.text}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            <aside className="lg:relative" aria-label="Price and enquiry">
              <div className="space-y-6 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]">
                <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                  {priceBlock}
                  <div className="mt-5">
                    {!isSold ? (
                      <VdpLeadActions
                        vehicleId={v.id}
                        vehicleTitle={fullTitle}
                        phone={phone}
                        whatsappUrl={whatsappUrl}
                        showInspection={v.inspectionAvailable}
                        showFinance={v.financeAvailable}
                        showTradeIn={v.tradeInWelcome}
                        variant="card"
                      />
                    ) : (
                      <ButtonLink href={modelPath} size="cta" className="w-full">
                        See similar cars
                      </ButtonLink>
                    )}
                  </div>
                  {v.weeklyEstimate && v.financeAvailable ? <p className="mt-4 text-xs text-muted-foreground">*Estimate only. {financeParams.disclaimer}</p> : null}
                </div>

                {v.financeAvailable && !isSold ? <FinanceCalculator price={v.price} params={financeParams} /> : null}
              </div>
            </aside>
          </div>

          {similar.length > 0 ? (
            <section className="mt-16" aria-labelledby="vdp-similar">
              <h2 id="vdp-similar" className="speed-line text-2xl">
                Similar cars
              </h2>
              <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {similar.map((s) => (
                  <li key={s.id} className="flex">
                    <VehicleCard vehicle={s} className="w-full" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </Container>
      </main>

      {/* Sticky enquiry bar under lg: price + call / WhatsApp / Enquire. */}
      {!isSold ? (
        <div className="sticky bottom-0 z-40 border-t border-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm supports-backdrop-filter:bg-card/85 lg:hidden">
          <div className="flex items-center gap-3">
            <p className="tabular min-w-0 flex-1 truncate text-lg font-bold text-foreground">{formatPrice(v.price)}</p>
            <VdpLeadActions vehicleId={v.id} vehicleTitle={fullTitle} phone={phone} whatsappUrl={whatsappUrl} variant="sticky" />
          </div>
        </div>
      ) : null}

      <SiteFooter />
    </>
  );
}
