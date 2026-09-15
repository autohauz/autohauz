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

  const url = new URL("/", request.url);
  return NextResponse.redirect(url, { status: 302 });
}

export const GET = POST;
