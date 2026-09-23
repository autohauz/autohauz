import { createAdminClient } from "@/lib/supabase/admin";
import { Container } from "@/components/ui/container";
import { Button, ButtonLink } from "@/components/ui/button";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Unsubscribe | AutoHauz",
};

export default async function UnsubscribePage(props: { searchParams: Promise<{ t?: string }> }) {
  const searchParams = await props.searchParams;
  const token = searchParams.t;
  
  if (!token) {
    return (
      <Container className="py-20 text-center max-w-lg">
        <h1 className="text-2xl font-bold text-foreground mb-4">Invalid Link</h1>
        <p className="text-muted-foreground">The unsubscribe link you clicked is invalid or has expired.</p>
      </Container>
    );
  }

  // We do the update via Server Action to avoid GET mutations
  async function confirmUnsubscribe() {
    "use server";
    const supabase = createAdminClient();
    await supabase.from("email_contacts").update({
      subscription_status: "unsubscribed",
      updated_at: new Date().toISOString()
    }).eq("id", token!);
    
    // Log event
    await supabase.from("email_events").insert({
      contact_id: token!,
      event_type: "unsubscribed",
    });

    redirect("/newsletter/unsubscribe/confirmed");
  }

  return (
    <Container className="py-20 max-w-lg mx-auto">
      <div className="bg-card border border-border p-8 rounded-2xl text-center shadow-sm">
        <h1 className="text-2xl font-bold text-foreground mb-4">Unsubscribe</h1>
        <p className="text-muted-foreground mb-8">
          Are you sure you want to stop receiving marketing emails from AutoHauz? You may miss out on special offers and latest news.
        </p>
        
        <form action={confirmUnsubscribe} className="flex flex-col gap-4">
          <Button type="submit" variant="default" className="w-full">
            Yes, Unsubscribe Me
          </Button>
          <ButtonLink href="/" type="button" variant="outline" className="w-full"  >Cancel</ButtonLink>
        </form>
      </div>
    </Container>
  );
}
