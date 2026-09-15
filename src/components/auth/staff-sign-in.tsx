"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Staff-only sign-in (there are no buyer accounts). Email + password. */
export function StaffSignIn() {
  const params = useSearchParams();
  const redirectedFrom = params.get("redirectedFrom");
  const urlError = params.get("error");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError === "unauthorized" 
      ? "You do not have permission to access the admin panel with this account. Please sign in with an administrator account." 
      : urlError === "auth_failed" 
      ? "Authentication failed. Please try again."
      : null
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      // Full navigation so the server picks up the new session cookies.
      window.location.href = redirectedFrom || "/admin";
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <img src="/LOGO.png" alt="Cars365" className="h-12 w-auto object-contain" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Staff sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cars365 admin panel</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Email</span>
          <input
            type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Password</span>
          <input
            type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit" disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : null}
          Sign in
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <button
        type="button"
        onClick={async () => {
          setLoading(true);
          const supabase = createClient();
          const next = redirectedFrom || "/admin";
          try {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                queryParams: { prompt: "select_account" }
              },
            });
            if (error) {
              setError(error.message);
              setLoading(false);
            }
          } catch (err: any) {
            setError(err instanceof Error ? err.message : "Network error. Please try again.");
            setLoading(false);
          }
        }}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 font-semibold text-foreground hover:bg-muted disabled:opacity-60 transition-colors"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Google
      </button>
    </div>
  );
}
