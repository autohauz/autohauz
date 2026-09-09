import type { Metadata } from "next";
import { Phone, Mail, MessageCircle, MapPin, Clock } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GeneralContactForm } from "@/components/leads/general-contact-form";
import { getPhoneNumbers, getCompanyProfile } from "@/lib/data/settings";
import { getActiveLocations } from "@/lib/data/locations";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  path: "/contact",
  title: "Contact Cars365 — Lansvale, NSW",
  description:
    "Get in touch — call, WhatsApp, or send us a message. Visit our Lansvale, Sydney showroom. We reply fast during business hours.",
});

export const revalidate = 3600;

const DAY_LABELS: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

export default async function ContactPage() {
  const [phones, company, locations] = await Promise.all([
    getPhoneNumbers(),
    getCompanyProfile(),
    getActiveLocations(),
  ]);
  const phone = phones.primary || null;
  const email = (company.email as string) || null;
  const whatsappUrl = phones.whatsapp ? buildWhatsAppUrl(phones.whatsapp, "Hi, I have a question.") : null;
  const branch = locations[0] ?? null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 max-w-2xl">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Get in touch</h1>
          <p className="mt-3 text-body">Call, WhatsApp, or send a message — a specialist will reply fast during business hours.</p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {phone ? (
                <a href={`tel:${phone}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-md">
                  <Phone className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Call us</p><p className="font-semibold text-foreground">{phone}</p></div>
                </a>
              ) : null}
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-md">
                  <MessageCircle className="size-5 text-success" /><div><p className="text-xs text-muted-foreground">WhatsApp</p><p className="font-semibold text-foreground">Message us</p></div>
                </a>
              ) : null}
              {email ? (
                <a href={`mailto:${email}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-md sm:col-span-2">
                  <Mail className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Email</p><p className="font-semibold text-foreground">{email}</p></div>
                </a>
              ) : null}
            </div>

            {branch ? (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <MapPin className="size-5 flex-none text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">{branch.name}</p>
                    <p className="text-sm text-body">{branch.address}, {branch.city} {branch.state} {branch.postcode}</p>
                  </div>
                </div>
                {Object.keys(branch.hours).length > 0 ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><Clock className="size-4" /> Opening hours</p>
                    <ul className="space-y-1 text-sm text-body">
                      {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].filter((d) => branch.hours[d]).map((d) => (
                        <li key={d} className="grid grid-cols-[100px_1fr] gap-4">
                          <span>{DAY_LABELS[d]}</span>
                          <span className="tabular-nums whitespace-nowrap">
                            {branch.hours[d] === "closed" ? "Closed" : branch.hours[d]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 font-heading text-lg font-bold text-foreground">Send us a message</h2>
            <GeneralContactForm phone={phone} whatsappUrl={whatsappUrl} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
