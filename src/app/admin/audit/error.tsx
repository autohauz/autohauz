"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function AdminAuditError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Failed to load audit logs"
      message="We couldn't load the audit log data. Please try again."
      onRetry={reset}
    />
  );
}
