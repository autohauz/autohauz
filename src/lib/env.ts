import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Environment contract — the single place that declares which variables the
 * application reads, how they are typed, and which are required.
 *
 * Why this exists: the codebase previously read `process.env.*` ad hoc, and two
 * variables were spelled differently in `.env.example` and in code
 * (`TURNSTILE_SECRET_KEY` vs `TURNSTILE_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` vs
 * `META_VERIFY_TOKEN`). In production that silently disabled every lead form.
 * Reading through this module makes a misnamed variable a type error.
 *
 * Rules:
 *  - Nothing here is required at *import* time except the Supabase trio, which
 *    the app cannot run without. Everything else is optional and the feature
 *    that uses it degrades gracefully (search, email, Redis, Turnstile…).
 *  - `emptyStringAsUndefined` — `.env` files commonly carry `KEY=` placeholders.
 *  - `SKIP_ENV_VALIDATION=1` lets lint/test/tooling import server modules
 *    without a configured environment (CI's quality job sets it).
 */
export const env = createEnv({
  server: {
    // ── Supabase (required) ──
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    // ── App / admin bootstrap ──
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_EMAIL_ALLOWLIST: z.string().optional(),
    CRON_SECRET: z.string().min(16).optional(),

    // ── Geo restriction ──
    GEO_RESTRICTION_ENABLED: z.enum(["true", "false"]).optional(),
    GEO_ALLOWED_COUNTRIES: z.string().optional(),
    GEO_TRUST_PROXY_HEADERS: z.enum(["true", "false"]).optional(),
    GEO_DEV_COUNTRY: z.string().length(2).optional(),

    // ── Anti-abuse ──
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    TURNSTILE_SKIP: z.enum(["true", "false"]).optional(),
    REDIS_URL: z.string().url().optional(),
    IP_HASH_SECRET: z.string().min(16).optional(),

    // ── Email (SMTP) ──
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    REPLY_TO_EMAIL: z.string().optional(),
    CONTACT_EMAIL_TO: z.string().optional(),
    // Signs unsubscribe / subscription-confirmation links (HMAC-SHA256).
    EMAIL_TOKEN_SECRET: z.string().min(32).optional(),

    // ── Search ──

    // ── Syndication ──
    SYNDICATION_LIVE_PUSH: z.enum(["true", "false"]).optional(),
    FEED_MAX_DROP_PCT: z.coerce.number().min(0).max(1).optional(),
    FEED_STORAGE_BUCKET: z.string().optional(),
    FEED_SIGNING_SECRET: z.string().min(16).optional(),
    GOOGLE_FEED_LIMIT: z.coerce.number().int().positive().optional(),
    META_APP_SECRET: z.string().optional(),
    META_WEBHOOK_VERIFY_TOKEN: z.string().min(8).optional(),
    META_PAGE_ACCESS_TOKEN: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: z.string().optional(),
    NEXT_PUBLIC_SOCIAL_FACEBOOK_URL: z.string().optional(),
    NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL: z.string().optional(),
    NEXT_PUBLIC_SOCIAL_LINKEDIN_URL: z.string().optional(),
    NEXT_PUBLIC_SOCIAL_X_URL: z.string().optional(),
  },
  // Next.js inlines NEXT_PUBLIC_* at build time only when referenced literally,
  // so every client variable must be listed here by name.
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_EMAIL_ALLOWLIST: process.env.ADMIN_EMAIL_ALLOWLIST,
    CRON_SECRET: process.env.CRON_SECRET,
    GEO_RESTRICTION_ENABLED: process.env.GEO_RESTRICTION_ENABLED,
    GEO_ALLOWED_COUNTRIES: process.env.GEO_ALLOWED_COUNTRIES,
    GEO_TRUST_PROXY_HEADERS: process.env.GEO_TRUST_PROXY_HEADERS,
    GEO_DEV_COUNTRY: process.env.GEO_DEV_COUNTRY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    TURNSTILE_SKIP: process.env.TURNSTILE_SKIP,
    REDIS_URL: process.env.REDIS_URL,
    IP_HASH_SECRET: process.env.IP_HASH_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    REPLY_TO_EMAIL: process.env.REPLY_TO_EMAIL,
    CONTACT_EMAIL_TO: process.env.CONTACT_EMAIL_TO,
    EMAIL_TOKEN_SECRET: process.env.EMAIL_TOKEN_SECRET,
    SYNDICATION_LIVE_PUSH: process.env.SYNDICATION_LIVE_PUSH,
    FEED_MAX_DROP_PCT: process.env.FEED_MAX_DROP_PCT,
    FEED_STORAGE_BUCKET: process.env.FEED_STORAGE_BUCKET,
    FEED_SIGNING_SECRET: process.env.FEED_SIGNING_SECRET,
    GOOGLE_FEED_LIMIT: process.env.GOOGLE_FEED_LIMIT,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN,
    META_PAGE_ACCESS_TOKEN: process.env.META_PAGE_ACCESS_TOKEN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    NEXT_PUBLIC_SOCIAL_FACEBOOK_URL: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL,
    NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL,
    NEXT_PUBLIC_SOCIAL_LINKEDIN_URL: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL,
    NEXT_PUBLIC_SOCIAL_X_URL: process.env.NEXT_PUBLIC_SOCIAL_X_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
