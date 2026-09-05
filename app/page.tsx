import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Globe2,
  Library,
  MessageCircleQuestion,
  Search,
  Send,
  Users
} from "lucide-react";

import {
  OptionDiagramVignette,
  PaletteVignette,
  TopicStrengthVignette
} from "@/components/marketing/vignettes";
import { Button } from "@/components/ui/button";

// The three things a national app structurally cannot offer an institute. These lead the page
// deliberately: every competitor in this market sells "AI", so Padho sells ownership instead.
const DIFFERENTIATORS = [
  {
    title: "It learns how you mark",
    text: "Grading suggestions train on the marks you have already approved for that question. Over a term they converge on your standard, not a generic rubric."
  },
  {
    title: "Built on your own papers",
    text: "Upload a past paper and it becomes a searchable question bank, diagrams included. The material you spent years writing stays yours."
  },
  {
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
    text: "Pull questions out of a PDF, reuse from your bank, or write them yourself. Crop diagrams straight off the page — onto the question or onto a single option."
  },
  {
    title: "Schedule the test",
    text: "Students sit it on an exam-style screen. MCQs score themselves; you mark the writing with a head start."
  }
];

const FEATURES = [
  {
    icon: FileText,
    title: "Papers from a PDF",
    text: "Upload a past paper and it becomes editable questions, diagrams and all."
  },
  {
    icon: ClipboardList,
    title: "Exam-style test screen",
    text: "Question palette, mark for review, resumable if the connection drops."
  },
  {
    icon: Users,
    title: "Batches and roster",
    text: "Invite codes, manual add, and a roster you can actually read."
  },
  {
    icon: MessageCircleQuestion,
    title: "Practice and doubts",
    text: "Publish practice sets from any paper. Students ask doubts between classes."
  }
];

const QUESTION_BANKS = [
  {
    icon: Library,
    eyebrow: "Yours",
    title: "My question bank",
    text: "Every paper you upload becomes searchable questions — stems, options and cropped diagrams. Build the next paper by pulling from the last three instead of starting at a blank page.",
    points: [
      "Private to you. Nobody else on Padho can see it.",
      "Re-import the same paper and it dedupes itself.",
      "A paper takes a copy, so editing one never rewrites a test students already sat."
    ]
  },
  {
    icon: Globe2,
    eyebrow: "Everyone's",
    title: "Shared library",
    text: "Real JEE Main previous-year questions, extracted from the official papers and checked against the official answer keys. Free to pull into any paper you build.",
    points: [
      "Physics, Chemistry and Maths, filterable by subject.",
      "Every question carries the shift it came from, so you can set a real 2025 paper.",
      "Official answer keys and JEE marking — +4 correct, −1 wrong."
    ]
  }
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refund", label: "Refunds" },
  { href: "/contact", label: "Contact" }
];

// Statically rendered. The signed-in redirect and Supabase's auth-param fallback both moved to
// middleware.ts — reading searchParams here would make the route dynamic again.
export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* This page sits outside the app shell, so it carries its own header. */}
      {/* backdrop-blur is sm:-only and the bar is solid on mobile — a blurred sticky layer
          repaints every scroll frame on Android, which is why AppNav does the same. */}
      <header className="sticky top-0 z-40 border-b bg-background sm:bg-background/85 sm:backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-serif text-lg font-semibold text-primary-foreground">
              प
            </span>
            <span className="font-serif text-xl font-bold">Padho.</span>
          </span>
          <nav className="flex items-center gap-1 sm:gap-3">
            <Link
              href="#how-it-works"
              className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
            >
              How it works
            </Link>
            <Button asChild size="sm">
              <Link href="/auth">Sign in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* ── Hero: split, so the product is visible above the fold ── */}
        <section className="hero-gradient relative overflow-hidden border-b">
          {/* Soft depth behind the vignette; purely decorative. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-7">
                <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-[#c98a3c]">
                  For tutors and coaching institutes · Agartala
                </p>
                <h1 className="mt-5 text-balance font-serif text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
                  Your papers. Your marking. Your name on the screen.
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                  Padho runs the teaching side of your institute — batches, tests, grading and
                  progress — on the question papers you already have.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="h-12 px-6 text-base">
                    <Link href="/auth">
                      Get started
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12 px-6 text-base">
                    <Link href="#how-it-works">See how it works</Link>
                  </Button>
                </div>
                <p className="script-note mt-6">
                  Free while we are getting started. No card, no setup fee.
                </p>
              </div>

              <div className="lg:col-span-5">
                <PaletteVignette />
              </div>
            </div>
          </div>
        </section>

        {/* ── The ownership trio: a ruled list, not more cards ── */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <h2 className="text-balance font-serif text-3xl font-semibold leading-tight sm:text-4xl">
                An app can teach a student. It cannot be their teacher.
              </h2>
              <p className="mt-5 text-muted-foreground">
                National apps are built to reach the student directly. Padho is built the other way
                round — so the results, and the trust that follows them, stay with the institute
                that earned them.
              </p>
            </div>

            <dl className="lg:col-span-7">
              {DIFFERENTIATORS.map((item, index) => (
                <div
                  key={item.title}
                  className={`grid gap-2 py-6 sm:grid-cols-[auto_1fr] sm:gap-6 ${
                    index === 0 ? "sm:pt-0" : "border-t"
                  }`}
                >
                  <dt className="font-mono text-xs tabular-nums text-muted-foreground sm:pt-1">
                    {String(index + 1).padStart(2, "0")}
                  </dt>
                  <dd>
                    <p className="font-serif text-xl font-semibold">{item.title}</p>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{item.text}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── How it works: steps beside the thing they produce ── */}
        <section id="how-it-works" className="border-y bg-card/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-7">
                <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  How it works
                </p>
                <h2 className="mt-3 text-balance font-serif text-3xl font-semibold sm:text-4xl">
                  Three steps to your first test.
                </h2>

                <ol className="mt-10 grid gap-8">
                  {STEPS.map((step, index) => (
                    <li key={step.title} className="relative flex gap-5">
                      {/* Connector between the numbered markers. */}
                      {index < STEPS.length - 1 ? (
                        <span
                          aria-hidden="true"
                          className="absolute left-5 top-11 h-[calc(100%+1rem)] w-px bg-border"
                        />
                      ) : null}
                      <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-semibold tabular-nums text-primary-foreground">
                        {index + 1}
                      </span>
                      <div className="pt-1.5">
                        <p className="font-serif text-xl font-semibold">{step.title}</p>
                        <p className="mt-1.5 max-w-md leading-relaxed text-muted-foreground">
                          {step.text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="lg:col-span-5 lg:pt-16">
                <OptionDiagramVignette />
                <p className="script-note mt-4 text-center">
                  Four graphs as the four options — cropped from your own paper.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features: one wide card carrying a visual, then the rest ── */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <h2 className="max-w-2xl text-balance font-serif text-3xl font-semibold sm:text-4xl">
            Everything the teaching side needs.
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* The wide one: grading is the reason a teacher would switch, so it gets the room. */}
            <div className="surface-gradient flex flex-col gap-4 rounded-xl border p-6 shadow-sm sm:col-span-2 sm:flex-row sm:items-center sm:gap-8">
              <div className="flex-1">
                <h3 className="font-serif text-xl font-semibold">Grading that learns your standard</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  MCQs auto-score with negative marking. Written answers arrive with a suggested
                  mark drawn from the ones you have already approved — and you sign off every one.
                </p>
              </div>
              <div className="w-full sm:w-56 sm:shrink-0">
                <TopicStrengthVignette />
              </div>
            </div>

            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group flex flex-col gap-2 rounded-xl border bg-card p-6 shadow-sm transition-colors hover:border-primary/50"
              >
                <feature.icon
                  className="h-5 w-5 text-primary transition-transform group-hover:scale-110"
                  aria-hidden="true"
                />
                <h3 className="mt-1 font-medium">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>


        {/* ── The question banks. A teacher will not upload anything until they understand
            what they get back, and "question bank" means two different things here — their
            own material, and the shared past-paper corpus. Spelled out rather than implied. ── */}
        <section id="question-bank" className="border-y bg-card/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="max-w-2xl">
              <p className="stat-label flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" aria-hidden="true" />
                Question banks
              </p>
              <h2 className="mt-3 text-balance font-serif text-3xl font-semibold sm:text-4xl">
                Two banks to build from. Never start at a blank page.
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Search both at once, or narrow to one. Filter by subject and topic, add what
                fits, and edit it freely — the paper takes its own copy.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              {QUESTION_BANKS.map((bank) => (
                <div
                  key={bank.title}
                  className="surface-gradient flex flex-col rounded-xl border p-6 shadow-sm sm:p-8"
                >
                  <bank.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  <p className="stat-label mt-4">{bank.eyebrow}</p>
                  <h3 className="mt-1 font-serif text-2xl font-semibold">{bank.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{bank.text}</p>
                  <ul className="mt-5 grid gap-2.5 border-t pt-5">
                    {bank.points.map((point) => (
                      <li key={point} className="flex gap-2.5 text-sm leading-relaxed">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        />
                        <span className="text-muted-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── The thesis. Deliberately dark in BOTH themes — the same deep teal the auth brand
            panel uses. bg-primary would not do: in dark mode --primary resolves to a bright mint,
            which inverts the band and makes the loudest element on the page shout. ── */}
        <section className="relative overflow-hidden border-y bg-gradient-to-br from-[#1a6b63] to-[#14544e]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-white/5 blur-3xl"
          />
          <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <p className="max-w-3xl text-balance font-serif text-3xl font-semibold leading-snug text-white sm:text-4xl">
              A student opens Padho because their teacher set a test for Thursday — not because an
              app sent a notification.
            </p>
            <p className="mt-6 max-w-2xl leading-relaxed text-white/75">
              Results, and the trust that comes with them, belong to the institute that earned them.
              Padho is built to keep it that way.
            </p>
            <Button asChild variant="secondary" className="mt-9 h-12 px-6 text-base">
              <Link href="/auth">
                <Send className="h-4 w-4" aria-hidden="true" />
                Start with one batch
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary font-serif text-sm font-semibold text-primary-foreground">
                प
              </span>
              <span className="font-serif text-lg font-bold">Padho.</span>
            </span>
            <p className="script-note mt-2">teaching, tests &amp; progress — in one place</p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <p className="script-note">Made for tutors and small institutes · Agartala</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
