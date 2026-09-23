"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function AdminInvoicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      <AlertCircle className="mb-4 size-10 text-danger" />
      <h2 className="mb-2 text-xl font-semibold text-foreground">Something went wrong!</h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        We couldn&apos;t load the invoices list. Please try again or contact support if the problem persists.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
