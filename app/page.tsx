import Link from "next/link";
import {
  BookOpenCheck,
  ClipboardList,
  FileText,
  LineChart,
  MessageCircleQuestion,
  PencilRuler,
  Send,
  Users
} from "lucide-react";

import { Button } from "@/components/ui/button";

// The three things a national app structurally cannot offer an institute. These lead the page
// deliberately: every competitor in this market sells "AI", so Padho sells ownership instead.
const DIFFERENTIATORS = [
  {
    icon: PencilRuler,
    title: "It learns how you mark",
    text: "Grading suggestions train on the marks you have already approved for that question, so over a term they converge on your standard — not a generic rubric."
  },
  {
    icon: FileText,
    title: "Built on your own papers",
    text: "Upload a past paper and it becomes a searchable question bank, diagrams included. The material you have spent years writing stays yours."
  },
  {
    icon: BookOpenCheck,
    title: "You approve every grade",
    text: "AI only ever suggests a mark on a written answer. Nothing reaches a student until a teacher has signed it off."
  }
];

const STEPS = [
  {
    title: "Create a batch",
    text: "Add students with an invite code or by phone number. Your roster, your classes."
  },
  {
    title: "Build the paper",
    text: "Upload a PDF and pull the questions out, reuse from your bank, or write them yourself. Crop diagrams straight off the page."
  },
  {
    title: "Schedule the test",
    text: "Students sit it on an exam-style screen. MCQs score themselves; you mark the writing with a head start."
  }
];

const FEATURES = [
  {
    icon: Users,
    title: "Batches and roster",
    text: "Invite codes, manual add, and a roster you can actually read."
  },
  {
    icon: FileText,
    title: "Papers and question bank",
    text: "Extract from a PDF, reuse across papers, dedupe automatically."
  },
  {
    icon: ClipboardList,
    title: "Exam-style test screen",
    text: "Question palette, mark for review, resumable if the connection drops."
  },
  {
    icon: PencilRuler,
    title: "Grading with a head start",
    text: "MCQs auto-score with negative marking. Written answers get a suggestion you approve."
  },
  {
    icon: LineChart,
    title: "Progress and reteach radar",
    text: "Topic-level scores per student, and the three topics your batch is weakest on."
  },
  {
    icon: MessageCircleQuestion,
    title: "Practice and doubts",
    text: "Publish practice sets from any paper. Students ask doubts between classes."
  }
];

// Statically rendered. The signed-in redirect and Supabase's auth-param fallback both moved to
// middleware.ts — reading searchParams here would make the route dynamic again.
export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* This page sits outside the app shell, so it carries its own header. */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-serif text-lg font-semibold text-primary-foreground">
            प
          </span>
          <span className="font-serif text-xl font-bold">Padho.</span>
        </span>
        <Button asChild size="sm">
          <Link href="/auth">Sign in</Link>
        </Button>
      </header>

      <main>
        {/* Hero */}
        <section className="hero-gradient border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-[#c98a3c]">
              For tutors and coaching institutes · Agartala
            </p>
            <h1 className="mt-4 max-w-3xl text-balance font-serif text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
              Your papers. Your marking. Your name on the screen.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Padho runs the teaching side of your institute — batches, tests, grading and progress
              — on the question papers you already have.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 px-6">
                <Link href="/auth">Get started</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 px-6">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="script-note mt-6">
              Free while we are getting started. No card, no setup fee.
            </p>
          </div>
        </section>

        {/* The ownership trio */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="max-w-2xl text-balance font-serif text-2xl font-semibold sm:text-3xl">
            An app can teach a student. It cannot be their teacher.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {DIFFERENTIATORS.map((item) => (
              <div
                key={item.title}
                className="surface-gradient flex flex-col gap-3 rounded-lg border p-5 shadow-sm"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </span>
                <h3 className="font-serif text-lg font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works — a real sequence, so it is numbered */}
        <section id="how-it-works" className="border-y bg-card/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              How it works
            </p>
            <h2 className="mt-3 max-w-2xl text-balance font-serif text-2xl font-semibold sm:text-3xl">
              Three steps to your first test.
            </h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-mono text-sm font-semibold tabular-nums text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="flex flex-col gap-1.5">
                    <span className="font-serif text-lg font-semibold">{step.title}</span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {step.text}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What is in the box */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="max-w-2xl text-balance font-serif text-2xl font-semibold sm:text-3xl">
            Everything the teaching side needs.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col gap-2 rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
              >
                <feature.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="mt-1 font-medium">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The thesis, stated plainly. Deliberately dark in BOTH themes — the same deep teal the
            auth brand panel uses. bg-primary would not do: in dark mode --primary resolves to a
            bright mint, which inverts the band and makes the loudest element on the page shout. */}
        <section className="border-y bg-gradient-to-br from-[#1a6b63] to-[#14544e]">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <p className="max-w-3xl text-balance font-serif text-2xl font-semibold leading-snug text-white sm:text-3xl">
              A student opens Padho because their teacher set a test for Thursday — not because an
              app sent a notification.
            </p>
            <p className="mt-5 max-w-2xl text-white/80">
              Results, and the trust that comes with them, belong to the institute that earned them.
              Padho is built to keep it that way.
            </p>
            <Button asChild variant="secondary" className="mt-8 h-11 px-6">
              <Link href="/auth">
                <Send className="h-4 w-4" aria-hidden="true" />
                Start with one batch
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <span className="font-serif text-lg font-bold">Padho.</span>
            <span className="script-note">teaching, tests &amp; progress — in one place</span>
          </span>
          <p className="script-note">Made for tutors and small institutes · Agartala</p>
        </div>
      </footer>
    </div>
  );
}
