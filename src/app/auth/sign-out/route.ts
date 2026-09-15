import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Clear all session-related cookies so the next login starts clean
  const cookieStore = await cookies();
  cookieStore.delete("admin_session");
  cookieStore.delete("active_role");

  const url = new URL("/auth/sign-in", request.url);
  return NextResponse.redirect(url, { status: 303 });
}

// GET must NOT sign out — Next.js automatically prefetches <Link href> targets
// via GET on hover/render, which would silently log the user out before they
// ever click "Sign out". Sign-out requires an explicit POST form submission.
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to sign out." },
    { status: 405 },
  );
}
