"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import type { Make } from "@/lib/domain";

// The sheet (and the dialog primitive behind it) is fetched on first intent —
// hover/focus prefetches it, the tap opens it — instead of on every page load.
const loadSheet = () => import("@/components/mobile-nav-sheet").then((m) => m.MobileNavSheet);
const MobileNavSheet = dynamic(loadSheet, { ssr: false });

/** Header menu button (< lg). */
export function MobileNav({ makes, phone }: { makes: Make[]; phone: string | null }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={() => void loadSheet()}
        onFocus={() => void loadSheet()}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        className="inline-flex size-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-white/10 lg:hidden"
      >
        <Menu className="size-6" aria-hidden="true" />
      </button>
      {mounted ? <MobileNavSheet makes={makes} phone={phone} open={open} setOpen={setOpen} triggerRef={triggerRef} /> : null}
    </>
  );
}
