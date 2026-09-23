"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ErrorState } from "@/components/ui/error-state";
import { site } from "@/config/site";

/** Root error boundary for public routes (the admin tree has its own). */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the digest in the console so it can be matched to server logs.
    console.error("Unhandled route error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="dark bg-background">
        <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--container-page)] items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label={`${site.brandName} home`}>
            <BrandLogo variant="dark" height={44} />
          </Link>
        </div>
      </div>
      <main id="main" className="flex flex-1 items-center justify-center">
        <ErrorState
          title="This page couldn't load"
          message="Something went wrong on our side. Try again, or head back to the cars."
          onRetry={reset}
          homeHref="/used-cars"
          homeLabel="Browse cars"
        />
      </main>
    </div>
  );
}
