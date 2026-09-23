import type { Metadata } from "next";
import Image from "next/image";
import { Phone, MessageCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SellTradeForm } from "@/components/leads/sell-trade-form";
import { Container, PageHeader } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import { getPhoneNumbers } from "@/lib/data/settings";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { pageMetadata } from "@/lib/seo/metadata";
import { withRegion } from "@/config/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  path: "/sell-your-car",
  title: withRegion("Sell to AutoHauz — Instant, Secure Appraisals"),
  description: `${withRegion("Trade in or sell your vehicle directly to AutoHauz.")} We offer competitive, transparent valuations with immediate payment upon inspection.`,
  keywords: ["sell my car", "car valuation", "sell used car"],
});

export const revalidate = 3600;

const STEPS = [
  { title: "Provide vehicle details", body: "Enter your make, model, year, kilometres, and overall condition. Photos are recommended for the most accurate appraisal." },
  { title: "Professional appraisal", body: "Our purchasing team evaluates your vehicle against current Australian market data and contacts you to discuss the details." },
  { title: "Secure transaction", body: "Receive a formal, competitive offer. Once accepted, we arrange a secure handover and prompt payment." },
];

export default async function SellYourCarPage() {
  const phones = await getPhoneNumbers();
  const phone = phones.primary || null;
  const whatsappUrl = phones.whatsapp ? buildWhatsAppUrl(phones.whatsapp, "Hi, I'd like to sell my car.") : null;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="relative h-[40vh] min-h-[320px] w-full bg-[#040f24] overflow-hidden">
          <Image
            src="/images/heroes/sell-car-hero.jpg"
            alt="Professional vehicle appraisal"
            fill
            priority
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </section>
        
        <Container className="pb-8 lg:pb-12 relative z-10 -mt-20">
          <div className="mb-10 rounded-xl bg-card border border-border p-6 sm:p-8 shadow-float">
            <PageHeader
              title="Premium valuations, zero hassle"
              description="Skip the private market. Submit your vehicle details for a fast, competitive offer from the AutoHauz purchasing team."
            />
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <div>
              <h2 className="text-xl">How it works</h2>
              <ol className="mt-6 space-y-6">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-4">
                    <span className="tabular flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold">
                        <span className="sr-only">Step {i + 1}: </span>
                        {s.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-body">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {phone || whatsappUrl ? (
                <div className="mt-10 rounded-lg border border-border bg-card p-5">
                  <h2 className="text-base font-semibold">Prefer to talk?</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {phone ? (
                      <a href={`tel:${phone.replace(/\s+/g, "")}`} className={cn(buttonVariants({ variant: "outline" }))}>
                        <Phone aria-hidden="true" /> Call {phone}
                      </a>
                    ) : null}
                    {whatsappUrl ? (
                      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
                        <MessageCircle aria-hidden="true" /> WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <section aria-labelledby="sell-form" className="rounded-lg border border-border bg-card p-5 sm:p-6">
              <h2 id="sell-form" className="text-xl">
                Get your offer
              </h2>
              <p className="mb-6 mt-1 text-sm text-body">Free, no obligation. We reply during business hours.</p>
              <SellTradeForm mode="sell" phone={phone} whatsappUrl={whatsappUrl} />
            </section>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
