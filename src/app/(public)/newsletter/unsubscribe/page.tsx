import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Button, ButtonLink } from "@/components/ui/button";
import { verifyEmailToken } from "@/lib/email/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateTags } from "@/lib/cache";

export const metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

async function unsubscribe(formData: FormData) {
  "use server";
  // Re-verified here: the Server Action is its own endpoint.
  const payload = verifyEmailToken(String(formData.get("t") ?? ""), "unsubscribe");
  if (!payload) redirect("/newsletter/unsubscribe?error=invalid");

  const { error } = await createAdminClient().rpc("unsubscribe_email_contact", {
    p_contact_id: payload.c,
    p_campaign_id: payload.k ?? null,
  });
  if (error) {
    console.error("[email] unsubscribe failed:", error.message);
    redirect(`/newsletter/unsubscribe?t=${encodeURIComponent(String(formData.get("t")))}&error=failed`);
  }
  updateTags("email_contacts", "email_campaigns");
  redirect("/newsletter/unsubscribe/confirmed");
}

/**
 * Human unsubscribe page. Opening the link changes nothing (link scanners
 * open every URL in an email); the button does. Mail clients that support
 * one-click unsubscribe use /api/v1/email/unsubscribe instead.
 */
export default async function UnsubscribePage(props: { searchParams: Promise<{ t?: string; error?: string }> }) {
  const { t, error } = await props.searchParams;
  const valid = verifyEmailToken(t, "unsubscribe") !== null;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <Container className="max-w-lg py-16 sm:py-20">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
            {valid ? (
              <>
                <h1 className="mb-3 text-2xl font-bold text-foreground">Unsubscribe from marketing emails?</h1>
                <p className="mb-8 text-muted-foreground">
                  You&apos;ll stop receiving newsletters and offers. Emails about something you&apos;ve asked us for, like an enquiry
                  or an invoice, aren&apos;t affected.
                </p>
                {error === "failed" ? (
                  <p role="alert" className="mb-6 text-sm text-danger">
                    Something went wrong. Please try again.
                  </p>
                ) : null}
                <form action={unsubscribe} className="flex flex-col gap-3">
                  <input type="hidden" name="t" value={t} />
                  <Button type="submit" className="w-full">
                    Unsubscribe
                  </Button>
                  <ButtonLink href="/" variant="outline" className="w-full">
                    Keep my subscription
                  </ButtonLink>
                </form>
              </>
            ) : (
              <>
                <h1 className="mb-3 text-2xl font-bold text-foreground">This link isn&apos;t valid</h1>
                <p className="text-muted-foreground">
                  It may be incomplete or out of date. Use the unsubscribe link in a recent email from us, or contact us and
                  we&apos;ll remove you straight away.
                </p>
                <ButtonLink href="/contact" variant="outline" className="mt-6">
                  Contact us
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
