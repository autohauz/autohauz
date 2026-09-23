import type { SocialLinks } from "@/config/business";

/**
 * Social profile links, resolved from two sources with NO built-in fallback:
 *   1. `settings.social_links` (staff-editable in Admin → Settings)
 *   2. `NEXT_PUBLIC_SOCIAL_*` env vars (deploy-time)
 * An unset or placeholder ("#") value yields nothing, so the footer and the
 * Organization `sameAs` graph only ever list real profiles.
 */
export function resolveSocialUrl(...candidates: Array<string | undefined | null>): string | undefined {
  for (const c of candidates) {
    const trimmed = c?.trim();
    if (trimmed && trimmed !== "#" && /^https?:\/\//i.test(trimmed)) return trimmed;
  }
  return undefined;
}

export type SocialNetwork = keyof SocialLinks;

/** Ordered list of configured profiles for rendering / `sameAs`. */
export function socialProfiles(social: SocialLinks): Array<{ network: SocialNetwork; url: string }> {
  const env = {
    facebook: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL,
    instagram: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL,
    x: process.env.NEXT_PUBLIC_SOCIAL_X_URL,
    youtube: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE_URL,
    linkedin: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL,
    tiktok: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK_URL,
  } satisfies Record<SocialNetwork, string | undefined>;

  const defaults: Record<SocialNetwork, string> = {
    facebook: "https://facebook.com/autohauz",
    instagram: "https://instagram.com/autohauz",
    x: "https://x.com/autohauz",
    youtube: "https://youtube.com/@autohauz",
    linkedin: "https://linkedin.com/company/autohauz",
    tiktok: "",
  };

  const order: SocialNetwork[] = ["facebook", "instagram", "x", "youtube", "linkedin", "tiktok"];
  return order.flatMap((network) => {
    const url = resolveSocialUrl(social[network], env[network], defaults[network]);
    return url ? [{ network, url }] : [];
  });
}
