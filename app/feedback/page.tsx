import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FeedbackForm } from "@/components/feedback-form";

export const metadata = {
  title: "Tell us what you need",
  description:
    "Tell the team building Padho what would make it genuinely useful for your coaching institute."
};

// Public on purpose — no auth, no app shell. The visitors worth hearing from are the ones who
// have not signed up, and putting this behind a login would select for exactly the wrong
// people.
export default function FeedbackPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link className="flex items-center gap-2.5" href="/">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-serif text-lg font-semibold text-primary-foreground">
              प
            </span>
            <span className="font-serif text-xl font-bold">Padho.</span>
          </Link>
          <Link
            className="script-note inline-flex items-center gap-1.5 hover:text-foreground"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="greeting-eyebrow">Help us build it</p>
        <h1 className="mt-2 text-balance font-serif text-3xl font-bold leading-tight sm:text-4xl">
          What would make this worth switching to?
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Padho is early, and it is being built for coaching institutes in Agartala and towns
          like it — not for a generic classroom somewhere else. Three questions, a minute of
          your time, and it shapes what gets built next.
        </p>

        <div className="mt-8">
          <FeedbackForm />
        </div>
      </main>
    </div>
  );
}
