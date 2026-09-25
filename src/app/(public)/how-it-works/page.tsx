import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container, PageHeader } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo/metadata";
import { site } from "@/config/site";

export const metadata = pageMetadata({
  path: "/how-it-works",
  title: "How buying a car from us works",
  description: `From browsing to driving away — how buying a used car from ${site.brandName} works: search the stock, inspect the car, sort finance or a trade-in, and drive away.`,
});

const STEPS = [
  {
    title: "Find a car",
    body: "Search by make, model, body type or budget. Every listing shows the real kilometres, the full spec and the price you'll pay.",
    detail: "Save cars you like with the heart icon and come back to them any time.",
  },
  {
    title: "Ask us anything",
    body: "Call, WhatsApp or send an enquiry from the car's page. We answer questions about history, condition and what's included.",
    detail: "Every car is checked before it's listed, and we'll tell you about any imperfections we found.",
  },
  {
    title: "See it in person",
    body: "Book an inspection at a time that suits you. Take your time, take a test drive, bring a friend or your own mechanic.",
    detail: "There's no pressure to decide on the day.",
  },
  {
    title: "Sort the money",
    body: "Pay outright, use our finance calculator to estimate repayments and enquire, or put your current car towards it as a trade-in.",
    detail: "The advertised price is the price — on-road costs are explained up front.",
  },
  {
    title: "Drive away",
    body: "We handle the paperwork and registration transfer. You leave with the keys, a roadworthy certificate and the documents you need.",
    detail: null,
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="py-8 lg:py-12">
        <Container width="prose">
          <PageHeader
            title="How buying a car here works"
            description="Five steps from browsing to driving away — simple, transparent and at your pace."
            className="mb-10"
          />

          <ol className="space-y-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-5">
                <span className="tabular flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="min-w-0 pt-1">
                  <h2 className="text-xl">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h2>
                  <p className="mt-2 leading-relaxed text-body">{s.body}</p>
                  {s.detail ? <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p> : null}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-8">
            <ButtonLink href="/used-cars" size="lg">
              Browse cars
            </ButtonLink>
            <ButtonLink href="/faqs" variant="outline" size="lg">
              Read the FAQs
            </ButtonLink>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
