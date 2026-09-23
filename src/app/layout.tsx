import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { Archivo } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "sonner";
import { WhatsAppFloat } from "@/components/whatsapp-float";
import { siteBaseUrl } from "@/lib/seo/site";
import { site } from "@/config/site";
import { seo } from "@/config/seo";
import { env } from "@/lib/env";
import { getPhoneNumbers } from "@/lib/data/settings";

// One family, two widths (DESIGN.md §3): Archivo is a variable font with a
// width axis, so headings set wide (font-stretch) echo the extended wordmark
// while body text stays at normal width — one webfont file, no second family.
// next/font options must be literal (the loader runs at build time).
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: site.themeColor,
};

export const metadata: Metadata = {
  title: {
    default: seo.defaultTitle,
    template: seo.titleTemplate,
  },
  description: seo.defaultDescription,
  metadataBase: new URL(siteBaseUrl()),
  // NOTE: no `alternates.canonical` here — on purpose.
  // Next.js inherits layout metadata into every descendant route, so declaring
  // `canonical: "/"` at the root would make every listing, landing page and
  // vehicle detail page emit a canonical pointing at the homepage. Each route
  // declares its own self-referencing canonical via `pageMetadata()`.
  applicationName: site.brandName,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: site.assets.favicon, sizes: "any" },
      { url: "/brand/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/brand/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: site.assets.icon192, type: "image/png", sizes: "192x192" },
      { url: site.assets.icon512, type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: site.assets.appleTouchIcon, sizes: "180x180", type: "image/png" }],
  },
  // `appleWebApp` emits the modern `mobile-web-app-capable` meta (Chrome warns
  // on the legacy apple-prefixed one) and the iOS status-bar hint.
  appleWebApp: { capable: true, title: site.brandName, statusBarStyle: "black-translucent" },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: site.ogLocale,
    // No `url` here: like canonical, a hardcoded homepage URL would be
    // inherited by every route. Each page sets its own via `pageMetadata`.
    siteName: site.brandName,
    title: seo.defaultTitle,
    description: seo.defaultDescription,
    images: [
      {
        url: seo.ogImage,
        width: 1200,
        height: 630,
        alt: `${site.brandName} — ${site.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seo.defaultTitle,
    description: seo.defaultDescription,
    images: [seo.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Search Console verification comes from the environment only — never a
  // hard-coded token, which would verify the previous brand's property.
  ...(env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const phones = await getPhoneNumbers();
  return (
    <html
      lang="en-AU"
      className={`${archivo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground font-sans">
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="lazyOnload"
            />
            <Script id="google-analytics" strategy="lazyOnload">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
        {children}
        <WhatsAppFloat phone={phones.whatsapp || null} />
        <Toaster richColors position="top-right" />

        {/* Vercel-hosted scripts; they 404 (and log console errors) anywhere else. */}
        {process.env.VERCEL ? (
          <>
            <SpeedInsights />
            <Analytics />
          </>
        ) : null}
      </body>
    </html>
  );
}
