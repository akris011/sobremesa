"use client";

import { EmptyState } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="pt-16">
      <EmptyState
        title="Something spilled"
        action={
          <button onClick={reset} className="btn btn-primary">
            Try again
          </button>
        }
      >
        We couldn&rsquo;t load this page. {error.digest ? `(Ref ${error.digest})` : "Check your connection and try again."}
      </EmptyState>
    </main>
  );
}
