"use client";

import Link from "next/link";

import { MessagePage } from "@/components/marketing/message-page";
import { Button } from "@/components/ui/button";

// Route-level error boundary. `reset` re-renders the segment, which is usually enough for a
// dropped connection — worth offering before sending anyone back to the top.
//
// The error object is deliberately not rendered: students see this screen too, and a stack
// trace or a database message tells them nothing useful while leaking how the app is built.
export default function ErrorBoundary({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <MessagePage
      eyebrow="Something broke"
      title="That did not load."
      action={<Button onClick={reset}>Try again</Button>}
    >
      <p>
        Something went wrong on our side, not yours. Trying again usually works; if it keeps
        happening, tell us at{" "}
        <Link href="/contact" className="text-primary underline underline-offset-2">
          contact
        </Link>
        .
      </p>
      {error.digest ? (
        <p className="script-note mt-3">
          Reference <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </MessagePage>
  );
}
