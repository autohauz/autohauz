"use server";

import { createClient } from "@/lib/supabase/server";
import { getStaffRole } from "@/lib/security/auth";

export async function signInAction(email: string, password: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    const role = await getStaffRole(data.user);
    if (!role) {
      await supabase.auth.signOut();
      return { 
        error: "You do not have permission to access the admin panel with this account. Please sign in with an administrator account." 
      };
    }
  }

  return { success: true };
}
