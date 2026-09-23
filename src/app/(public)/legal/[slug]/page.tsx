import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Container, PageHeader } from "@/components/ui/container";
import { pageMetadata } from "@/lib/seo/metadata";
import { getBusinessProfile } from "@/lib/data/business";
import { site } from "@/config/site";

type PolicySection = {
  heading: string;
  body: string[];
  bullets?: string[];
};

type Policy = {
  title: string;
  summary: string;
  sections: PolicySection[];
};

const updatedAt = "14 July 2026";

/**
 * DRAFT — these documents were adapted from a template and have not been
 * reviewed by an Australian solicitor for this business. The entity name is
 * substituted from Admin → Settings at render time; jurisdiction wording is
 * deliberately generic until the trading state is confirmed (OPEN_DECISIONS D-15).
 */
const DRAFT_NOTICE = "Draft — this document is pending review by an Australian solicitor and may change.";

function fill(text: string, entity: string): string {
  return text.split("{{ENTITY}}").join(entity);
}

const policies: Record<string, Policy> = {
  terms: {
    title: "Terms of Service",
    summary:
      "These terms govern your use of the {{ENTITY}} website, where we advertise quality used vehicles for sale and invite you to enquire about them. By accessing our website, you agree to these terms.",
    sections: [
      {
        heading: "About {{ENTITY}}",
        body: [
          "{{ENTITY}} is a licensed used-vehicle dealer operating in Australia. We list vehicles we hold or can source for sale, publish their details and pricing, and provide ways for you to contact us with an enquiry, finance request, trade-in request, or inspection booking.",
          "The website is an advertisement and an invitation to treat. It is not an offer capable of legally binding acceptance, and submitting an enquiry does not create a contract of sale. A binding contract of sale is formed only when both parties sign a written Motor Vehicle Dealer's Contract of Sale.",
        ],
      },
      {
        heading: "Vehicle information, pricing, and holding deposits",
        body: [
          "We take reasonable care to describe each vehicle accurately, including make, model, year, odometer reading, body type, fuel, transmission, and features. However, details may occasionally contain errors or become out of date, and a vehicle may sell before a listing is removed.",
          "Advertised prices are in Australian Dollars (AUD) and exclude government statutory charges such as stamp duty, registration, and transfer fees, unless explicitly advertised as 'Drive Away'. We reserve the right to correct pricing or availability errors at any time before a contract of sale is executed.",
          "Any holding deposit placed on a vehicle is subject to a separate written agreement and may be fully or partially refundable in accordance with the motor dealer legislation of the state or territory in which {{ENTITY}} is licensed."
        ],
      },
      {
        heading: "Enquiries and third-party finance",
        body: [
          "When you submit an enquiry, you must provide accurate contact details. We use those details to respond to your request about the relevant vehicle and related services.",
          "Any finance repayment figures shown are indicative estimates only, do not constitute an offer of credit, and are subject to lender approval, credit criteria, fees, and your personal circumstances. We operate as an authorised representative for our finance partners. Trade-in valuations provided online are estimates only and are contingent upon a physical inspection of your vehicle."
        ],
      },
      {
        heading: "Australian Consumer Law and Statutory Warranties",
        body: [
          "Nothing in these terms excludes, restricts, or modifies any consumer guarantee, right, or remedy that cannot lawfully be excluded under the Australian Consumer Law (ACL).",
          "Where we sell a vehicle to you, statutory guarantees under the ACL apply. Furthermore, eligible vehicles are sold with any statutory dealer guarantee prescribed by the motor dealer legislation of the state or territory in which {{ENTITY}} is licensed.",
        ],
      },
      {
        heading: "Acceptable use of the website",
        body: [
          "You must not use the website to break any law, submit false or spam enquiries, impersonate others, scrape data, bypass security controls, distribute malware, or interfere with its availability. We reserve the right to block access to users who violate these conditions.",
        ],
      },
      {
        heading: "Limitation of liability and jurisdiction",
        body: [
          "To the maximum extent permitted by law, our liability for your use of the website is limited to resupplying the affected service. We are not liable for indirect, incidental, or consequential damages arising out of your use of the website.",
          "These Terms of Service are governed by the laws in force in the Australian state or territory in which {{ENTITY}} is licensed to trade, and you submit to the non-exclusive jurisdiction of its courts.",
        ],
      },
      {
        heading: "Contact",
        body: [
          "Questions about these terms can be sent through our contact page. Please include your name, contact details, and enough information for us to identify the relevant vehicle or enquiry.",
        ],
      },
    ],
  },
  "privacy-policy": {
    title: "Privacy Policy",
    summary:
      "This policy explains how {{ENTITY}} collects, uses, discloses, stores, and protects your personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).",
    sections: [
      {
        heading: "Personal information we collect",
        body: [
          "We collect information you provide directly when you enquire, request finance or a trade-in appraisal, book an inspection, or subscribe to updates, together with information generated automatically as you use the website.",
        ],
        bullets: [
          "Contact details you give us, such as your name, phone number, and email address.",
          "Enquiry details, such as the vehicle you are interested in, your message, finance or trade-in information you choose to share (including vehicle registration and VIN), and any photos you upload.",
          "Technical and security data, such as IP-derived identifiers, device and browser metadata, and anti-spam and rate-limit events.",
          "Records of our communications with you and the status of your enquiry in our system.",
        ],
      },
      {
        heading: "How we use information",
        body: [
          "We use personal information to respond to your enquiry, provide information about vehicles and related services, arrange finance or trade-in appraisals where requested, complete a sale, provide support, and meet our legal and regulatory obligations.",
          "With your consent, we may send you updates about new stock or offers in compliance with the Spam Act 2003 (Cth). You can opt out of direct marketing at any time using the unsubscribe link provided. We may also use aggregated or de-identified data to understand demand and improve our services.",
        ],
      },
      {
        heading: "Disclosure to third parties",
        body: [
          "We may share your details with service providers who help us operate, such as hosting, database, email, analytics, and cybersecurity partners. They may use the information only to provide their services to us under strict confidentiality obligations.",
          "If you request us to arrange finance or insurance, we will disclose your information to our licensed finance and insurance partners to process your application.",
          "We do not sell your personal information. We will only disclose your information to government or law enforcement agencies where required or authorised by law (for example, for vehicle registration transfer or under a court order).",
        ],
      },
      {
        heading: "Security and data retention",
        body: [
          "We use robust technical and organisational controls—including role-based access, row-level security, audit logging, rate limiting, and encrypted transport (SSL/TLS)—to protect your personal information from misuse, interference, loss, and unauthorised access.",
          "We comply with the Notifiable Data Breaches (NDB) scheme under the Privacy Act. In the unlikely event of an eligible data breach, we will notify you and the OAIC as required by law.",
          "We keep personal information only for as long as needed to respond to your enquiry, complete any sale, meet statutory accounting obligations, and resolve disputes. Enquiry contact details are securely destroyed or anonymised once they are no longer required.",
        ],
      },
      {
        heading: "Access, correction, and complaints",
        body: [
          "Under the APPs, you have the right to request access to or correction of the personal information we hold about you. We will respond to your request within a reasonable period and may need to verify your identity.",
          "If you believe we have breached the APPs, please contact us first so we can investigate and aim to resolve your complaint within 30 days. If you remain dissatisfied, you may contact the Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au.",
        ],
      },
    ],
  },
  disclaimer: {
    title: "Website Disclaimer",
    summary:
      "This disclaimer outlines the terms of relying on the vehicle information and financial estimates published on the {{ENTITY}} website.",
    sections: [
      {
        heading: "Accuracy of vehicle listings",
        body: [
          "Vehicle listings are provided in good faith to help you decide whether to enquire. While we aim to keep details accurate and current, specifications, features, condition, pricing, and availability can change without notice. A vehicle may be sold before its listing is updated.",
          "We guarantee clear title (no money owing and not written-off) for all vehicles sold, as required by the motor dealer legislation of the state or territory in which {{ENTITY}} is licensed. However, before committing to buy, you should confirm the vehicle's price, on-road costs, condition, service history, and any warranty directly with our sales team and, where relevant, arrange your own independent mechanical inspection.",
        ],
      },
      {
        heading: "Finance and trade-in estimates",
        body: [
          "Finance repayment estimates and trade-in figures shown on the website are indicative only. They do not constitute a formal offer of credit or a binding offer to purchase your vehicle.",
          "All finance is subject to formal approval by the lender, credit checks, and your personal financial circumstances. Trade-in valuations are strictly subject to a physical appraisal of your vehicle by our team.",
        ],
      },
      {
        heading: "Consumer rights preserved",
        body: [
          "This disclaimer does not exclude, restrict, or modify any rights you have under the Australian Consumer Law (ACL) or the motor dealer legislation of the state or territory in which {{ENTITY}} is licensed. Where we supply a vehicle to you, we remain fully responsible for the statutory obligations and guarantees that apply to that sale.",
        ],
      },
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(policies).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const policy = policies[slug];

  if (!policy) {
    return { robots: { index: false, follow: true } };
  }

  return pageMetadata({
    path: `/legal/${slug}`,
    title: policy.title,
    description: fill(policy.summary, site.brandName),
  });
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const policy = policies[slug];

  if (!policy) {
    notFound();
  }

  const business = await getBusinessProfile();
  const entity = business.legalName || business.tradingName || site.brandName;

  return (
    <>
      <SiteHeader />
      <main id="main" className="py-8 lg:py-12">
        <Container width="prose">
          <p role="note" className="rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">
            {DRAFT_NOTICE}
          </p>
          <PageHeader
            className="mt-8"
            above={<p className="mb-2 text-sm text-muted-foreground">Last updated {updatedAt}</p>}
            title={policy.title}
            description={fill(policy.summary, entity)}
          />

          <div className="mt-10 space-y-10">
            {policy.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl">{fill(section.heading, entity)}</h2>
                <div className="mt-3 space-y-3 leading-relaxed text-body">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{fill(paragraph, entity)}</p>
                  ))}
                  {section.bullets ? (
                    <ul className="list-disc space-y-2 pl-5">
                      {section.bullets.map((item) => (
                        <li key={item}>{fill(item, entity)}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
