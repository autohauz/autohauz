import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Clear all session-related cookies so the next login starts clean
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  const url = new URL("/auth/sign-in", request.url);
  const response = NextResponse.redirect(url, { status: 303 });
  
  // Expire all Supabase auth cookies (prefixed with "sb-") and any admin cookies
  for (const cookie of allCookies) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name.includes("supabase") ||
      cookie.name === "admin_session" ||
      cookie.name === "active_role"
    ) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }
  
  return response;
}

// GET: clears stale auth cookies and redirects to sign-in (safe: read-only, no data destroyed).
// Used by the sign-in page itself to flush broken sessions (e.g. after a DB reset).
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  const url = new URL("/auth/sign-in", request.url);
  const response = NextResponse.redirect(url, { status: 303 });
  
  for (const cookie of allCookies) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name.includes("supabase") ||
      cookie.name === "admin_session" ||
      cookie.name === "active_role"
    ) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }
  
  return response;
}
