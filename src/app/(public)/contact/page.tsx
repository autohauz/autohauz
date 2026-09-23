import type { Metadata } from "next";
import { Phone, Mail, MessageCircle, MapPin, Clock } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GeneralContactForm } from "@/components/leads/general-contact-form";
import { Container, PageHeader } from "@/components/ui/container";
import { getBusinessProfile } from "@/lib/data/business";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { pageMetadata } from "@/lib/seo/metadata";
import { formatAddress, hasAddress } from "@/config/business";
import { site } from "@/config/site";

export const metadata: Metadata = pageMetadata({
  path: "/contact",
  title: `Contact ${site.brandName}`,
  description: "Call, WhatsApp or send us a message. We reply during business hours.",
});

export const revalidate = 3600;

const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;

const channelClass = "flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-input";

export default async function ContactPage() {
  const business = await getBusinessProfile();
  const phone = business.phone || null;
  const email = business.email || null;
  const whatsappUrl = business.whatsapp ? buildWhatsAppUrl(business.whatsapp, "Hi, I have a question.") : null;
  const address = hasAddress(business.address) ? formatAddress(business.address) : null;
  const hours = DAYS.filter(([key]) => business.hours[key]);
  const hasChannels = Boolean(phone || whatsappUrl || email);

  return (
    <>
      <SiteHeader />
      <main id="main" className="py-8 lg:py-12">
        <Container>
          <PageHeader title="Get in touch" description="Call, WhatsApp or send a message. We reply during business hours." className="mb-10" />

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-6">
              {hasChannels ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {phone ? (
                    <a href={`tel:${phone.replace(/\s+/g, "")}`} className={channelClass}>
                      <Phone className="size-5 shrink-0 text-accent-bright" aria-hidden="true" />
                      <span>
                        <span className="block text-xs text-muted-foreground">Call us</span>
                        <span className="font-semibold text-foreground">{phone}</span>
                      </span>
                    </a>
                  ) : null}
                  {whatsappUrl ? (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={channelClass}>
                      <MessageCircle className="size-5 shrink-0 text-accent-bright" aria-hidden="true" />
                      <span>
                        <span className="block text-xs text-muted-foreground">WhatsApp</span>
                        <span className="font-semibold text-foreground">Message us</span>
                      </span>
                    </a>
                  ) : null}
                  {email ? (
                    <a href={`mailto:${email}`} className={`${channelClass} sm:col-span-2`}>
                      <Mail className="size-5 shrink-0 text-accent-bright" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-xs text-muted-foreground">Email</span>
                        <span className="block truncate font-semibold text-foreground">{email}</span>
                      </span>
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-lg border border-border bg-card p-4 text-sm text-body">The quickest way to reach us is the form on this page.</p>
              )}

              {address || hours.length > 0 ? (
                <div className="rounded-lg border border-border bg-card p-5">
                  {address ? (
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 size-5 shrink-0 text-accent-bright" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-foreground">{business.tradingName || site.brandName}</p>
                        <p className="text-sm text-body">{address}</p>
                        <a
                          href={`https://maps.google.com/maps?q=${encodeURIComponent(address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline"
                        >
                          Open in Google Maps
                        </a>
                      </div>
                    </div>
                  ) : null}
                  {hours.length > 0 ? (
                    <div className={address ? "mt-5 border-t border-border pt-5" : ""}>
                      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                        <Clock className="size-4 text-accent-bright" aria-hidden="true" /> Opening hours
                      </h2>
                      <dl className="grid max-w-sm grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
                        {hours.map(([key, label]) => {
                          const value = business.hours[key]!;
                          const closed = value.toLowerCase() === "closed";
                          return (
                            <div key={key} className="contents">
                              <dt className="text-body">{label}</dt>
                              <dd className={`tabular ${closed ? "text-muted-foreground" : "text-foreground"}`}>{closed ? "Closed" : value}</dd>
                            </div>
                          );
                        })}
                      </dl>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <section aria-labelledby="contact-form" className="rounded-lg border border-border bg-card p-5 sm:p-6">
              <h2 id="contact-form" className="text-xl">
                Send us a message
              </h2>
              <p className="mb-6 mt-1 text-sm text-body">Tell us what you need and we&apos;ll get back to you.</p>
              <GeneralContactForm phone={phone} whatsappUrl={whatsappUrl} />
            </section>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
