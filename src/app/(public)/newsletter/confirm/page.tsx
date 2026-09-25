import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Button, ButtonLink } from "@/components/ui/button";
import { verifyEmailToken } from "@/lib/email/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateTags } from "@/lib/cache";

export const metadata = {
  title: "Confirm your subscription",
  robots: { index: false, follow: false },
};

async function confirmSubscription(formData: FormData) {
  "use server";
  const t = String(formData.get("t") ?? "");
  const payload = verifyEmailToken(t, "confirm");
  if (!payload) redirect("/newsletter/confirm?error=invalid");

  const { data, error } = await createAdminClient().rpc("confirm_subscription", { p_contact_id: payload.c });
  if (error || !data) {
    if (error) console.error("[email] confirm_subscription failed:", error.message);
    redirect(`/newsletter/confirm?t=${encodeURIComponent(t)}&error=failed`);
  }
  updateTags("email_contacts");
  redirect("/newsletter/confirm?done=1");
}

/**
 * Double opt-in step 2. The subscription is completed by the button, not by
 * opening the link, so an email security scanner cannot confirm on
 * someone's behalf.
 */
export default async function ConfirmSubscriptionPage(props: { searchParams: Promise<{ t?: string; error?: string; done?: string }> }) {
  const { t, error, done } = await props.searchParams;
  const valid = verifyEmailToken(t, "confirm") !== null;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <Container className="max-w-lg py-16 sm:py-20">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
            {done ? (
              <div role="status" className="flex flex-col items-center">
                <CheckCircle2 className="mb-5 size-14 text-success" aria-hidden="true" />
                <h1 className="mb-3 text-2xl font-bold text-foreground">You&apos;re subscribed</h1>
                <p className="text-muted-foreground">
                  Thanks for confirming. Every email includes an unsubscribe link if you change your mind.
                </p>
                <ButtonLink href="/used-cars" className="mt-6">
                  Browse cars
                </ButtonLink>
              </div>
            ) : valid ? (
              <>
                <h1 className="mb-3 text-2xl font-bold text-foreground">Confirm your subscription</h1>
                <p className="mb-8 text-muted-foreground">
                  Confirm that you&apos;d like occasional emails about new stock and offers. You can unsubscribe at any time.
                </p>
                {error === "failed" ? (
                  <p role="alert" className="mb-6 text-sm text-danger">
                    We couldn&apos;t confirm this subscription. Please try again, or sign up again from our website.
                  </p>
                ) : null}
                <form action={confirmSubscription}>
                  <input type="hidden" name="t" value={t} />
                  <Button type="submit" className="w-full">
                    Yes, subscribe me
                  </Button>
                </form>
              </>
            ) : (
              <>
                <h1 className="mb-3 text-2xl font-bold text-foreground">This link has expired</h1>
                <p className="text-muted-foreground">Confirmation links last 7 days. Sign up again and we&apos;ll send a new one.</p>
                <ButtonLink href="/#newsletter-heading" variant="outline" className="mt-6">
                  Sign up again
                </ButtonLink>
              </>
            )}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
