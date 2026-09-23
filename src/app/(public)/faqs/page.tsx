import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { FaqList } from "@/components/faq-list";
import { Container, PageHeader } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublishedFaqs } from "@/lib/data/content";
import { faqPageSchema, breadcrumbSchema } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { site } from "@/config/site";
import type { Faq } from "@/lib/domain";

// The root layout's title template appends the brand, so titles stay bare.
export const metadata: Metadata = pageMetadata({
  path: "/faqs",
  title: "Frequently Asked Questions",
  description: `Answers to common questions about buying, selling, finance, warranty and inspections at ${site.brandName}.`,
});

export const revalidate = 3600;

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function FaqsPage() {
  const faqs = await getPublishedFaqs();
  // Group by category, preserving the (category, sort_order) order from the query.
  const groups = faqs.reduce<{ category: string; items: Faq[] }[]>((acc, f) => {
    const last = acc[acc.length - 1];
    if (last && last.category === f.category) last.items.push(f);
    else acc.push({ category: f.category, items: [f] });
    return acc;
  }, []);

  return (
    <>
      <JsonLd schema={[faqPageSchema(faqs), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "FAQs", path: "/faqs" }])]} />
      <SiteHeader />
      <main id="main" className="py-8 lg:py-12">
        <Container width="prose">
          <PageHeader title="Questions, answered" description="Everything people ask us about buying, selling, finance and inspections. Can't find it? Ask us directly." className="mb-8" />

          {groups.length > 1 ? (
            <nav aria-label="Question categories" className="mb-8 flex flex-wrap gap-2">
              {groups.map((g) => (
                <a key={g.category} href={`#${slugify(g.category)}`} className="inline-flex min-h-8 items-center rounded-sm bg-accent-soft px-3 text-sm font-medium text-accent-soft-foreground hover:bg-azure-100/70">
                  {g.category}
                </a>
              ))}
            </nav>
          ) : null}

          {groups.length === 0 ? (
            <EmptyState title="No questions published yet" description="We're writing them now. In the meantime, ask us anything." action={{ label: "Contact us", href: "/contact" }} />
          ) : (
            <div className="space-y-12">
              {groups.map((g) => (
                <section key={g.category} id={slugify(g.category)} aria-labelledby={`faq-${slugify(g.category)}`} className="scroll-mt-24">
                  <h2 id={`faq-${slugify(g.category)}`} className="text-xl">
                    {g.category}
                  </h2>
                  <FaqList faqs={g.items} name={`faq-${slugify(g.category)}`} className="mt-4" />
                </section>
              ))}
            </div>
          )}

          <div className="mt-16 rounded-lg border border-border bg-card p-6 sm:p-8">
            <h2 className="text-xl">Still have a question?</h2>
            <p className="mt-2 text-body">Call, WhatsApp or send us a message — we reply during business hours.</p>
            <ButtonLink href="/contact" className="mt-5">
              Contact us
            </ButtonLink>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
