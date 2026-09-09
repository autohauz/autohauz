import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "sonner";
import { MobileStateProvider } from "@/components/mobile-state-provider";
import { MobileAnimationProvider } from "@/components/mobile-animation-provider";
import { ScrollToTop } from "@/components/scroll-to-top";
import { WhatsAppFloat } from "@/components/whatsapp-float";
import { siteBaseUrl } from "@/lib/seo/site";
import { AnnouncementBanner } from "@/components/announcement-banner";

// Both faces are variable fonts on Google Fonts. Omitting `weight` makes
// next/font serve the single variable woff2 that covers the whole axis instead
// of one static file per listed weight — fewer font requests competing with the
// LCP image, and no risk of a heading falling back to a synthesised weight.
// `fallback` supplies metric-adjacent system faces so the swap doesn't shift
// layout (CLS) before the webfont lands.
//
// NOTE: next/font options must be explicitly written literals — the loader is
// evaluated at build time and cannot resolve a shared constant, so the fallback
// array is repeated rather than extracted.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

// SRS §12.2: a modern grotesque with automotive character for headings (600–800).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFCC00",
};

export const metadata: Metadata = {
  title: {
    default: "Cars365 — Quality Used Cars in Australia",
    template: "%s | Cars365 Australia",
  },
  description:
    "Browse quality, inspected used cars for sale in Australia. Transparent pricing, finance available, trade-ins welcome, and a team that answers fast in Lansvale, NSW.",
  keywords: ["used cars Australia", "cars for sale NSW", "second hand cars Sydney", "used SUV", "used ute", "car finance", "trade-in Lansvale"],
  metadataBase: new URL(siteBaseUrl()),
  // NOTE: no `alternates.canonical` here — on purpose.
  // Next.js inherits layout metadata into every descendant route, so declaring
  // `canonical: "/"` at the root made every listing, landing page and vehicle
  // detail page emit a canonical pointing at the homepage. Google treats that
  // as "this URL is a duplicate of the homepage" and drops the page from the
  // index. Each route now declares its own self-referencing canonical via
  // `canonical()` from `@/lib/seo/site`.
  applicationName: "Cars365",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },

  // Legacy iOS (< 16.4) reads the apple-prefixed flag for standalone launch;
  // Next emits the modern `mobile-web-app-capable`, so add the legacy one too.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    // No `url` here: like canonical, a hardcoded homepage URL would be
    // inherited by every route. Each page sets its own via `pageMetadata`.
    siteName: "Cars365 Australia",
    title: "Cars365 — Quality Used Cars in Australia",
    description:
      "Browse premium, pre-inspected used cars with transparent pricing in Lansvale, NSW. Every vehicle includes a PPSR check, RWC, and statutory warranty.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Cars365 — Quality Used Cars for Sale",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cars365 — Quality Used Cars, Honestly Inspected",
    description:
      "Quality, inspected used cars for sale with transparent pricing, finance, and trade-ins welcome.",
    images: ["/og-image.jpg"],
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
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "vdZAgv7uS9NQbHjKoE-Dtl1N-OOLr--wd4pmSHPSGmA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-AU"
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground font-sans tracking-tight">
        <div className="dark">
          <AnnouncementBanner />
        </div>
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
        <MobileStateProvider>
          <MobileAnimationProvider>
            {children}
            <ScrollToTop />
            <WhatsAppFloat phone="61451344477" />
          </MobileAnimationProvider>
        </MobileStateProvider>
        <Toaster richColors position="top-right" />

        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
