"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function AdminSettingsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Failed to load settings"
      message="We couldn't load the settings page. Please try again."
      onRetry={reset}
    />
  );
}
