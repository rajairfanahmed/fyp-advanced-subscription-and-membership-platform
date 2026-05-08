"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
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
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-24 bg-[var(--color-paper)]">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center space-y-4">
        <h1 className="text-xl font-black font-display text-[var(--color-ink)]">
          Something went wrong
        </h1>
        <p className="text-sm font-medium text-slate-600 leading-relaxed">
          An unexpected error occurred. You can try again or return home. If this keeps happening,
          contact support with what you were doing when it appeared.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button type="button" variant="primary" onClick={() => reset()}>
            Try again
          </Button>
          <Button variant="outline" href="/contact">
            Contact support
          </Button>
          <Button variant="ghost" href="/">
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
