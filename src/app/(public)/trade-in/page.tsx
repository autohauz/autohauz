import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SellTradeForm } from "@/components/leads/sell-trade-form";
import { Container, PageHeader } from "@/components/ui/container";
import { getPhoneNumbers } from "@/lib/data/settings";
import { getVehicleLeadContext } from "@/lib/data/inventory";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { pageMetadata } from "@/lib/seo/metadata";
import { withRegion } from "@/config/seo";

export const metadata: Metadata = pageMetadata({
  path: "/trade-in",
  title: withRegion("Trade In Your Car — Free Valuation"),
  description: `${withRegion("Trade in your current car against your next one")}. Tell us about it and we'll value it — no obligation.`,
  keywords: ["car trade in", "trade in valuation", "trade in used car"],
});

export const revalidate = 3600;

export default async function TradeInPage({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  const { vehicle } = await searchParams;
  const [phones, ctx] = await Promise.all([getPhoneNumbers(), vehicle ? getVehicleLeadContext(vehicle) : Promise.resolve(null)]);
  const phone = phones.primary || null;
  const whatsappUrl = phones.whatsapp ? buildWhatsAppUrl(phones.whatsapp, "Hi, I'd like to trade in my car.") : null;

  return (
    <>
      <SiteHeader />
      <main id="main" className="py-8 lg:py-12">
        <Container width="prose">
          <PageHeader
            title="Trade in your car"
            description={
              <>
                Put your current car towards your next one{ctx ? ` — like the ${ctx.title}` : ""}. Tell us about it and we&apos;ll value it for you.
              </>
            }
            className="mb-8"
          />
          <section aria-label="Trade-in details" className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <SellTradeForm mode="trade_in" vehicleId={ctx?.id} phone={phone} whatsappUrl={whatsappUrl} />
          </section>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
