import type { Metadata } from "next";
import { CheckCircle2, Phone, MessageCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { getPhoneNumbers } from "@/lib/data/settings";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false },
};

const HEADINGS: Record<string, string> = {
  finance: "Thanks — our finance partner will be in touch.",
  inspection: "Inspection requested — we'll confirm your time.",
  sell: "Thanks — we'll come back with an offer.",
  trade_in: "Thanks — we'll value your trade-in.",
};

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const phones = await getPhoneNumbers();
  const phone = phones.primary || null;
  const whatsappUrl = phones.whatsapp ? buildWhatsAppUrl(phones.whatsapp, "Hi, I just submitted an enquiry.") : null;
  const heading = (type && HEADINGS[type]) || "Thanks — we've got your enquiry.";

  return (
    <>
      <SiteHeader />
      <main id="main" className="py-16 lg:py-24">
        <Container width="prose" className="flex flex-col items-center text-center">
          <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden="true">
            <CheckCircle2 className="size-8" />
          </div>
          <h1 className="text-3xl">{heading}</h1>
          <p className="mt-3 max-w-md text-body">We&apos;ll get back to you as soon as we can during business hours. If it&apos;s urgent, call or message us.</p>

          {phone || whatsappUrl ? (
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {phone ? (
                <a href={`tel:${phone.replace(/\s+/g, "")}`} className={cn(buttonVariants({ variant: "outline" }))}>
                  <Phone aria-hidden="true" /> Call {phone}
                </a>
              ) : null}
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
                  <MessageCircle aria-hidden="true" /> WhatsApp us
                </a>
              ) : null}
            </div>
          ) : null}

          <ButtonLink href="/used-cars" variant="link" className="mt-10">
            Keep browsing cars
          </ButtonLink>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
