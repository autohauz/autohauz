import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { seo } from "@/config/seo";

/** Web app manifest (home-screen name, icons, theme colour). No service worker: the site needs a connection. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.brandName,
    short_name: site.brandName,
    description: seo.defaultDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: site.themeColor,
    lang: "en-AU",
    icons: [
      { src: site.assets.icon192, sizes: "192x192", type: "image/png" },
      { src: site.assets.icon512, sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
