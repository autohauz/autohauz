import { Container } from "@/components/ui/container";
import { Button, ButtonLink } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Unsubscribed | AutoHauz",
};

export default function UnsubscribedConfirmedPage() {
  return (
    <Container className="py-20 max-w-lg mx-auto">
      <div className="bg-card border border-border p-10 rounded-2xl text-center shadow-sm flex flex-col items-center">
        <CheckCircle2 className="size-16 text-success mb-6" />
        <h1 className="text-3xl font-heading font-extrabold text-foreground mb-4">You've been unsubscribed</h1>
        <p className="text-muted-foreground mb-8">
          We've successfully updated your email preferences. You will no longer receive marketing emails from us.
        </p>
        <ButtonLink href="/" variant="outline">Return to Homepage</ButtonLink>
      </div>
    </Container>
  );
}
