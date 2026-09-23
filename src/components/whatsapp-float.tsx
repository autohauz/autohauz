"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

/** Routes where the floating button must not appear. */
const HIDDEN_PREFIXES = ["/admin", "/auth", "/geo-blocked"];
/** Vehicle detail pages carry their own sticky enquiry bar under lg. */
const VDP_PATTERN = /^\/used-cars\/[^/]+\/[^/]+\/[^/]+$/;

/**
 * Floating WhatsApp click-to-chat button on public pages. Renders nothing
 * without a configured number. Hidden on vehicle pages below lg, where the
 * sticky enquiry bar already offers WhatsApp and the two would overlap.
 */
export function WhatsAppFloat({ phone }: { phone?: string | null }) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  if (!phone || dismissed) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;
  const onVdp = VDP_PATTERN.test(pathname ?? "");

  const url = buildWhatsAppUrl(phone, "Hi, I have a question about a car you have for sale.");

  return (
    <div className={`group fixed right-4 z-[var(--z-whatsapp,50)] sm:right-6 ${onVdp ? "hidden lg:block" : ""} bottom-[max(1.5rem,env(safe-area-inset-bottom))]`}>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-card transition-opacity hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        aria-label="Hide the WhatsApp button"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="flex h-13 items-center gap-2.5 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white shadow-float transition-colors hover:bg-[#1ebe5d]"
      >
        <svg className="size-6 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        <span className="hidden sm:inline">Chat on WhatsApp</span>
      </a>
    </div>
  );
}
