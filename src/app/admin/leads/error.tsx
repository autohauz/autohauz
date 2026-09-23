"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function AdminLeadsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Failed to load leads"
      message="We couldn't load the leads data. Please try again."
      onRetry={reset}
    />
  );
}
