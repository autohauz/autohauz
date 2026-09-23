"use client";

import { Phone, MessageCircle, Mail, CalendarClock } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { VehicleEnquiryForm } from "@/components/leads/vehicle-enquiry-form";
import { InspectionForm } from "@/components/leads/inspection-form";
import { cn } from "@/lib/utils";

function track(vehicleId: string, channel: "call" | "whatsapp" | "enquire") {
  // Fire-and-forget; never blocks the click.
  try {
    const payload = JSON.stringify({ vehicleId, channel });
    const blob = new Blob([payload], { type: "application/json" });
    const sent = navigator.sendBeacon?.("/api/v1/cta-clicks", blob);
    if (!sent) {
      fetch("/api/v1/cta-clicks", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

type Props = {
  vehicleId: string;
  vehicleTitle: string;
  phone?: string | null;
  whatsappUrl?: string | null;
  showInspection?: boolean;
  showFinance?: boolean;
  showTradeIn?: boolean;
  /** `card` — the full stack in the price panel; `sticky` — the compact bar under lg. */
  variant?: "card" | "sticky";
};

/**
 * The VDP's conversion controls. "Enquire" is the page's single accent action
 * (DESIGN.md §6); call and WhatsApp are primary/outline so they read as
 * alternatives, not competitors.
 */
export function VdpLeadActions({ vehicleId, vehicleTitle, phone, whatsappUrl, showInspection = true, showFinance = true, showTradeIn = true, variant = "card" }: Props) {
  const sticky = variant === "sticky";
  const tel = phone ? `tel:${phone.replace(/\s+/g, "")}` : null;

  const enquire = (
    <Dialog>
      <DialogTrigger
        onClick={() => track(vehicleId, "enquire")}
        className={cn(buttonVariants({ variant: "accent", size: sticky ? "default" : "cta" }), sticky ? "flex-1" : "w-full")}
      >
        <Mail aria-hidden="true" /> Enquire
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enquire about this car</DialogTitle>
          <DialogDescription>{vehicleTitle}</DialogDescription>
        </DialogHeader>
        <VehicleEnquiryForm vehicleId={vehicleId} vehicleTitle={vehicleTitle} phone={phone} whatsappUrl={whatsappUrl} />
      </DialogContent>
    </Dialog>
  );

  if (sticky) {
    return (
      <div className="flex items-center gap-2">
        {tel ? (
          <a href={tel} onClick={() => track(vehicleId, "call")} className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-10 shrink-0")} aria-label={`Call ${phone}`}>
            <Phone aria-hidden="true" />
          </a>
        ) : null}
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track(vehicleId, "whatsapp")}
            className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-10 shrink-0")}
            aria-label="Message us on WhatsApp"
          >
            <MessageCircle aria-hidden="true" />
          </a>
        ) : null}
        {enquire}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {enquire}
      {tel ? (
        <a href={tel} onClick={() => track(vehicleId, "call")} className={cn(buttonVariants({ size: "cta" }), "w-full")}>
          <Phone aria-hidden="true" /> Call {phone}
        </a>
      ) : null}
      {whatsappUrl ? (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => track(vehicleId, "whatsapp")} className={cn(buttonVariants({ variant: "outline", size: "cta" }), "w-full")}>
          <MessageCircle aria-hidden="true" /> WhatsApp
        </a>
      ) : null}

      {showInspection ? (
        <Dialog>
          <DialogTrigger className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            <CalendarClock aria-hidden="true" /> Book an inspection
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Book an inspection</DialogTitle>
              <DialogDescription>{vehicleTitle}</DialogDescription>
            </DialogHeader>
            <InspectionForm vehicleId={vehicleId} phone={phone} whatsappUrl={whatsappUrl} />
          </DialogContent>
        </Dialog>
      ) : null}

      {showFinance || showTradeIn ? (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {showFinance ? (
            <ButtonLink href={`/finance?vehicle=${vehicleId}`} variant="ghost" className="text-accent">
              Finance this car
            </ButtonLink>
          ) : null}
          {showTradeIn ? (
            <ButtonLink href={`/trade-in?vehicle=${vehicleId}`} variant="ghost" className="text-accent">
              Trade in yours
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
