import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";

export const metadata = {
  title: "Unsubscribed",
  robots: { index: false, follow: false },
};

export default function UnsubscribedConfirmedPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Container className="max-w-lg py-16 sm:py-20">
          <div role="status" className="flex flex-col items-center rounded-2xl border border-border bg-card p-10 text-center shadow-card">
            <CheckCircle2 className="mb-6 size-14 text-success" aria-hidden="true" />
            <h1 className="mb-4 text-2xl font-bold text-foreground">You&apos;ve been unsubscribed</h1>
            <p className="mb-8 text-muted-foreground">You won&apos;t receive any more marketing emails from us.</p>
            <ButtonLink href="/" variant="outline">
              Back to the homepage
            </ButtonLink>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
