import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    title: "Tests & auto-grading",
    text: "Schedule tests; MCQs score themselves and AI drafts the rest for your approval."
  },
  { title: "Practice", text: "Publish practice sets students can drill at their own pace." },
  { title: "Progress parents can see", text: "Every result becomes a shareable update home." }
];

// Statically rendered. The signed-in redirect and Supabase's auth-param fallback both moved to
// middleware.ts — reading searchParams here would make the route dynamic again.
export default function HomePage() {
  return (
    <main className="flex min-h-screen">
      {/* Brand panel — desktop only, matches the auth screen so the transition feels continuous */}
      <aside className="hidden w-[45%] flex-col justify-between bg-gradient-to-br from-[#1a6b63] to-[#14544e] p-10 lg:flex">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/10 font-serif text-xl font-semibold text-primary-foreground">
          प
        </span>
        <div>
          <p className="font-serif text-6xl font-bold text-primary-foreground">Padho.</p>
          <p className="mt-3 text-lg text-primary-foreground/80">
            teaching, tests &amp; progress — in one place
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">
          Made for tutors and small institutes · Agartala
        </p>
      </aside>

      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <p className="font-serif text-4xl font-bold text-primary">Padho.</p>
            <p className="script-note mt-1 text-base">teaching, tests &amp; progress — in one place</p>
          </div>

          <h1 className="font-serif text-3xl font-semibold">Run your coaching, not spreadsheets.</h1>
          <p className="mt-2 text-muted-foreground">
            Create batches, run tests, and share progress parents can see — with AI helping you grade.
          </p>

          <ul className="mt-6 grid gap-3">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="font-medium">{feature.title}</span>
                  <span className="block text-sm text-muted-foreground">{feature.text}</span>
                </span>
              </li>
            ))}
          </ul>

          <Button asChild className="mt-8 h-11 w-full">
            <Link href="/auth">Sign in</Link>
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground lg:hidden">
            Made for tutors and small institutes · Agartala
          </p>
        </div>
      </section>
    </main>
  );
}
