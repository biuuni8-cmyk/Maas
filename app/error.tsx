"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({
  error,
  reset,
}: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          The error was recorded. Retry the operation, and contact an
          administrator if it continues.
        </p>

        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}