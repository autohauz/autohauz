"use client";

import { ErrorState } from "@/components/error-state";

export default function AdminDashboardError({
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
