"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Failed to load admin dashboard"
      message={error.message || "We couldn't load the admin dashboard data. Please try again."}
      onRetry={reset}
    />
  );
}
