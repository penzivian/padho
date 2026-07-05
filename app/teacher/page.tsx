import Link from "next/link";
import { BookOpenCheck, CheckCircle2, Circle, ClipboardList, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function TeacherHomePage() {
  const { profile } = await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const [
    { count: batchCount },
    { count: paperCount },
    { count: testCount },
    { count: submissionCount },
    { count: gradedCount },
    { data: snapshotData }
  ] = await Promise.all([
    supabase.from("batches").select("id", { count: "exact", head: true }),
    supabase.from("question_papers").select("id", { count: "exact", head: true }),
    supabase.from("tests").select("id", { count: "exact", head: true }),
    supabase.from("test_submissions").select("id", { count: "exact", head: true }),
    supabase.from("test_submissions").select("id", { count: "exact", head: true }).eq("status", "graded"),
    supabase
      .from("progress_snapshots")
      .select("student_id,score_percent,created_at")
      .order("created_at", { ascending: true })
  ]);

  const firstName = profile.full_name.split(/\s+/)[0] || "teacher";
  const steps = [
    { label: "Create your first batch", hint: "Students join with its invite code", href: "/teacher/batches", done: (batchCount ?? 0) > 0 },
    { label: "Build a question paper", hint: "Draft with AI or upload a PDF", href: "/teacher/papers/new", done: (paperCount ?? 0) > 0 },
    { label: "Schedule a test", hint: "Students take it live; MCQs auto-score", href: "/teacher/tests", done: (testCount ?? 0) > 0 }
  ];
  const setupDone = steps.every((step) => step.done);
  const improvement = improvementStats(snapshotData ?? []);

  return (
    <main className="page-shell">
      <div>
        <p className="script-note text-lg">Namaskar,</p>
        <h1 className="text-3xl font-semibold">{firstName}</h1>
      </div>

      {!setupDone ? (
        <Card className="border-primary/40">
          <h2 className="text-xl font-semibold">Set up your coaching in 3 steps</h2>
          <p className="script-note mt-0.5">Five minutes from empty to your first live test —</p>
          <ol className="mt-4 grid gap-3">
            {steps.map((step, index) => {
              const isNext = !step.done && steps.slice(0, index).every((previous) => previous.done);
              return (
                <li key={step.href} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="flex items-center gap-3">
                    {step.done ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                    )}
                    <span>
                      <span className={step.done ? "text-muted-foreground line-through" : "font-medium"}>
                        {step.label}
                      </span>
                      {!step.done ? <span className="block text-sm text-muted-foreground">{step.hint}</span> : null}
                    </span>
                  </span>
                  {isNext ? (
                    <Button asChild>
                      <Link href={step.href}>Start</Link>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Card>
      ) : null}

      {(submissionCount ?? 0) > 0 ? (
        <div className="rounded-lg border bg-secondary/40 px-4 py-3">
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span>
              <strong className="font-serif text-lg">{submissionCount}</strong> tests taken
            </span>
            <span>
              <strong className="font-serif text-lg">{gradedCount ?? 0}</strong> graded
            </span>
            <span>
              <strong className="font-serif text-lg">{formatGradingTime(gradedCount ?? 0)}</strong> of grading automated
            </span>
            {improvement ? (
              <span>
                <strong className="font-serif text-lg">
                  {improvement.improving} of {improvement.total}
                </strong>{" "}
                students improving
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard href="/teacher/batches" icon={<UsersRound className="h-5 w-5" />} label="Batches" value={batchCount ?? 0} />
        <StatCard href="/teacher/papers" icon={<BookOpenCheck className="h-5 w-5" />} label="Papers" value={paperCount ?? 0} />
        <StatCard href="/teacher/tests" icon={<ClipboardList className="h-5 w-5" />} label="Tests" value={testCount ?? 0} />
      </div>

      {setupDone ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <QuickAction href="/teacher/papers/new" title="Create paper" hint="AI draft or upload a PDF" primary />
          <QuickAction href="/teacher/tests" title="Schedule test" hint="From any saved paper" />
          <QuickAction href="/teacher/batches" title="Manage batches" hint="Roster and invite codes" />
        </section>
      ) : null}
    </main>
  );
}

// Per-student trend from time-ordered snapshots: improving = latest score above their first.
function improvementStats(snapshots: { student_id: string; score_percent: number }[]) {
  const byStudent = new Map<string, { first: number; last: number }>();
  for (const snapshot of snapshots) {
    const entry = byStudent.get(snapshot.student_id);
    if (!entry) byStudent.set(snapshot.student_id, { first: snapshot.score_percent, last: snapshot.score_percent });
    else entry.last = snapshot.score_percent;
  }

  const students = [...byStudent.values()];
  if (students.length === 0) return null;

  const improving = students.filter((entry) => entry.last > entry.first).length;
  return improving > 0 ? { improving, total: students.length } : null;
}

function formatGradingTime(gradedSubmissions: number) {
  const minutes = gradedSubmissions * 6; // ~6 min of manual checking per submission
  if (minutes < 90) return `≈${minutes} min`;
  return `≈${Math.round(minutes / 6) / 10} hrs`;
}

function StatCard({
  href,
  icon,
  label,
  value
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Link href={href}>
      <Card className="transition hover:border-primary/40 hover:bg-secondary/30">
        <p className="font-serif text-4xl font-semibold">{value}</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {label}
        </p>
      </Card>
    </Link>
  );
}

function QuickAction({
  href,
  title,
  hint,
  primary = false
}: {
  href: string;
  title: string;
  hint: string;
  primary?: boolean;
}) {
  return (
    <Link
      className={
        primary
          ? "rounded-lg bg-primary p-4 text-primary-foreground shadow-sm transition hover:bg-primary/90"
          : "rounded-lg border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:bg-secondary/30"
      }
      href={href}
    >
      <p className="font-medium">{title}</p>
      <p className={primary ? "mt-0.5 text-sm text-primary-foreground/75" : "mt-0.5 text-sm text-muted-foreground"}>
        {hint}
      </p>
    </Link>
  );
}
