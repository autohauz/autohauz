import type { ReactNode } from "react";

// Staff auth pages carry a per-request nonce CSP (src/proxy.ts), which only
// works on dynamically rendered pages — a prerendered page has no nonce on
// its scripts and would be blocked.
export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
