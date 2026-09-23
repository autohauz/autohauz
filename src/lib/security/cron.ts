import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Guard for `/api/cron/*` routes.
 *
 * Fail-closed by design: when `CRON_SECRET` is unset, every call is refused.
 * Missing a scheduled job is recoverable; letting the public trigger
 * side-effecting jobs (email sends, third-party syncs, DB writes) is not.
 *
 * Usage:
 *   const denied = requireCronSecret(request);
 *   if (denied) return denied;
 */
export function requireCronSecret(request: Request): NextResponse | null {
  const secret = env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!secret || !presented) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const a = Buffer.from(secret);
  const b = Buffer.from(presented);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
