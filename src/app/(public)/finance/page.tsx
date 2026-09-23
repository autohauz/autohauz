import type { Metadata } from "next";
import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FinancePanels } from "@/components/finance-panels";
import { Container, PageHeader } from "@/components/ui/container";
import { getFinanceParams, getPhoneNumbers } from "@/lib/data/settings";
import { getVehicleLeadContext } from "@/lib/data/inventory";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  path: "/finance",
  title: "AutoHauz Finance Options — Estimate Your Repayments",
  description: "Explore competitive vehicle finance solutions tailored to your lifestyle. Use our transparent calculator to estimate your weekly commitment.",
  keywords: ["car finance Australia", "used car loan", "car repayment calculator"],
});

export const revalidate = 300;

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  const { vehicle } = await searchParams;
  const [params, phones, ctx] = await Promise.all([getFinanceParams(), getPhoneNumbers(), vehicle ? getVehicleLeadContext(vehicle) : Promise.resolve(null)]);
  const phone = phones.primary || null;
  const whatsappUrl = phones.whatsapp ? buildWhatsAppUrl(phones.whatsapp, "Hi, I'd like to talk about car finance.") : null;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="relative h-[40vh] min-h-[320px] w-full bg-[#040f24] overflow-hidden">
          <Image
            src="/images/heroes/finance-hero.jpg"
            alt="Professional automotive finance consultation"
            fill
            priority
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </section>
        
        <Container className="pb-8 lg:pb-12 relative z-10 -mt-20">
          <div className="mb-10 rounded-xl bg-card border border-border p-6 sm:p-8 shadow-float">
            <PageHeader
              title="Tailored automotive finance"
              description={
                <>
                  Adjust the calculator below for a transparent estimate of your weekly repayments, then reach out to our team to discuss formal options{ctx ? ` for the ${ctx.title}` : ""}. Estimates are a guide only, not an offer of finance.
                </>
              }
            />
          </div>
          <FinancePanels params={params} price={ctx?.price ?? 30000} vehicleId={ctx?.id} phone={phone} whatsappUrl={whatsappUrl} />
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
