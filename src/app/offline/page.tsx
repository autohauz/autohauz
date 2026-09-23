"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Offline fallback served by the service worker when the network is unavailable. */
export default function OfflineFallback() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground" aria-hidden="true">
        <WifiOff className="size-8" />
      </div>
      <h1 className="text-2xl">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-body">This page needs a connection. Check your network and try again.</p>
      <Button type="button" size="cta" className="mt-6" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </main>
  );
}
