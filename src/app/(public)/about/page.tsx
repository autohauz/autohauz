import { ShieldCheck, BadgeCheck, Handshake, CircleDollarSign } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ListingBreadcrumbs } from "@/components/listing-breadcrumbs";
import { Container, Section } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { getBusinessProfile } from "@/lib/data/business";
import { pageMetadata } from "@/lib/seo/metadata";
import { site } from "@/config/site";
import { formatAddress, hasAddress } from "@/config/business";
import { formatPhoneForDisplay, telHref } from "@/lib/phone";

/*
 * Config-driven copy with no stock imagery and no claims the business has
 * not made. Address/phone/email appear only when set in Admin → Settings.
 */

export const metadata = pageMetadata({
  path: "/about",
  title: "About us",
  description: `About ${site.brandName} — an Australian used-car dealership: inspected vehicles, upfront pricing, finance and trade-ins.`,
});

export const revalidate = 3600;

const PRINCIPLES = [
  { icon: ShieldCheck, title: "Uncompromising Inspections", body: "Every AutoHauz vehicle undergoes a comprehensive mechanical and structural check before being listed." },
  { icon: BadgeCheck, title: "Transparent Pricing", body: "Prices are shown up front. Unless a price is marked drive-away, government charges such as stamp duty and registration are extra, and we itemise them before you commit." },
  { icon: CircleDollarSign, title: "Competitive Finance", body: "Clear, flexible finance solutions designed around your specific lifestyle and requirements." },
  { icon: Handshake, title: "Seamless Trade-ins", body: "We offer fair, data-backed valuations to make upgrading your vehicle completely effortless." },
];

export default async function AboutPage() {
  const business = await getBusinessProfile();
  const name = business.tradingName || site.brandName;
  const address = hasAddress(business.address) ? formatAddress(business.address) : null;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <Section dark spacing="tight">
          <Container width="prose">
            <ListingBreadcrumbs trail={[["About", "/about"]]} />
            <h1 className="text-3xl sm:text-4xl">Elevating the Australian used-car standard.</h1>
            <p className="mt-5 text-lg leading-relaxed text-body">
              {name} was built to remove the friction from buying and selling premium vehicles. We rigorously inspect every car, price transparently, and guide you through finance and trade-ins without the traditional sales pressure.
            </p>
          </Container>
        </Section>

        <Section aria-labelledby="principles-heading">
          <Container width="prose">
            <h2 id="principles-heading" className="speed-line">
              How we work
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2">
              {PRINCIPLES.map((p) => (
                <li key={p.title} className="flex gap-4">
                  <p.icon className="mt-0.5 size-6 shrink-0 text-accent-bright" aria-hidden="true" />
                  <div>
                    <h3 className="text-base font-semibold">{p.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-body">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            {address || business.phone || business.email ? (
              <section className="mt-14 rounded-lg border border-border bg-card p-6" aria-labelledby="visit-heading">
                <h2 id="visit-heading" className="text-xl">
                  Visit or get in touch
                </h2>
                <dl className="mt-4 space-y-2 text-body">
                  {address ? (
                    <div>
                      <dt className="sr-only">Address</dt>
                      <dd>{address}</dd>
                    </div>
                  ) : null}
                  {business.phone ? (
                    <div>
                      <dt className="sr-only">Phone</dt>
                      <dd>
                        <a href={telHref(business.phone)} className="underline-offset-4 hover:underline">
                          {formatPhoneForDisplay(business.phone)}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {business.email ? (
                    <div>
                      <dt className="sr-only">Email</dt>
                      <dd>
                        <a href={`mailto:${business.email}`} className="underline-offset-4 hover:underline">
                          {business.email}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            <div className="mt-12 flex flex-wrap gap-3">
              <ButtonLink href="/used-cars" size="lg">
                Browse our cars
              </ButtonLink>
              <ButtonLink href="/contact" variant="outline" size="lg">
                Contact us
              </ButtonLink>
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
