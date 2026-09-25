import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/** The blog shares the site frame (header, skip-link target, footer). */
export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="min-h-screen bg-background py-12 md:py-20">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
