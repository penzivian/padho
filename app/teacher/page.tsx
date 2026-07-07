import Link from "next/link";
import { AlertCircle, BookOpenCheck, CheckCircle2, Circle, ClipboardList, UsersRound } from "lucide-react";

import { Sparkline } from "@/components/sparkline";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { findKeylessMcqs } from "@/lib/grading";
import { weakestTopics } from "@/lib/topics";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Json } from "@/types/database";

export default async function TeacherHomePage() {
  const { profile } = await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const [
    { count: batchCount },
    { count: paperCount },
    { count: testCount },
    { count: submissionCount },
    { count: gradedCount },
    { count: practiceCount },
    { data: snapshotData },
    { data: pendingData },
    { data: paperData },
    { data: liveTestData }
  ] = await Promise.all([
    supabase.from("batches").select("id", { count: "exact", head: true }),
    supabase.from("question_papers").select("id", { count: "exact", head: true }),
    supabase.from("tests").select("id", { count: "exact", head: true }),
    supabase.from("test_submissions").select("id", { count: "exact", head: true }),
    supabase.from("test_submissions").select("id", { count: "exact", head: true }).eq("status", "graded"),
    supabase
      .from("practice_attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
    supabase
      .from("progress_snapshots")
      .select("student_id,score_percent,created_at,topic_breakdown")
      .order("created_at", { ascending: true }),
    supabase.from("test_submissions").select("id,tests(id,title)").eq("status", "pending"),
    supabase.from("question_papers").select("id,title,questions(question_type,correct_answer)"),
    supabase
      .from("tests")
      .select("id,title,scheduled_at,duration_minutes")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
  ]);

  const firstName = profile.full_name.split(/\s+/)[0] || "teacher";
  const steps = [
    { label: "Create your first batch", hint: "Students join with its invite code", href: "/teacher/batches", done: (batchCount ?? 0) > 0 },
    { label: "Build a question paper", hint: "Draft with AI or upload a PDF", href: "/teacher/papers/new", done: (paperCount ?? 0) > 0 },
    { label: "Schedule a test", hint: "Students take it live; MCQs auto-score", href: "/teacher/tests", done: (testCount ?? 0) > 0 }
  ];
  const setupDone = steps.every((step) => step.done);
  const improvement = improvementStats(snapshotData ?? []);

  // Needs-attention queue: grading waiting, keyless papers, tests live right now.
  const pendingByTest = new Map<string, { title: string; count: number }>();
  for (const row of (pendingData ?? []) as unknown as { tests: { id: string; title: string } | null }[]) {
    if (!row.tests) continue;
    const entry = pendingByTest.get(row.tests.id) ?? { title: row.tests.title, count: 0 };
    entry.count += 1;
    pendingByTest.set(row.tests.id, entry);
  }
  const keylessPapers = (
    (paperData ?? []) as unknown as {
      id: string;
      title: string;
      questions: { question_type: "mcq" | "subjective"; correct_answer: string | null }[];
    }[]
  ).filter(
    (paper) =>
      findKeylessMcqs(
        paper.questions.map((question) => ({
          type: question.question_type,
          correctAnswer: question.correct_answer
        }))
      ).length > 0
  );
  const nowMs = Date.now();
  const liveTests = ((liveTestData ?? []) as { id: string; title: string; scheduled_at: string; duration_minutes: number }[]).filter(
    (test) => nowMs <= new Date(test.scheduled_at).getTime() + test.duration_minutes * 60_000
  );
  const attention: { text: string; href: string; action: string }[] = [
    ...[...pendingByTest.entries()].map(([id, entry]) => ({
      text: `${entry.count} submission${entry.count === 1 ? "" : "s"} waiting in ${entry.title}`,
      href: `/teacher/tests/${id}/grading`,
      action: "Grade"
    })),
    ...keylessPapers.map((paper) => ({
      text: `${paper.title} has MCQs without answer keys`,
      href: "/teacher/papers",
      action: "Fix"
    })),
    ...liveTests.map((test) => ({
      text: `${test.title} is live right now`,
      href: `/teacher/tests/${test.id}/results`,
      action: "Watch"
    }))
  ].slice(0, 4);

  // Batch trend: average score per calendar day of graded snapshots, oldest → newest.
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const snapshot of snapshotData ?? []) {
    const key = new Date(snapshot.created_at).toDateString();
    const entry = byDay.get(key) ?? { sum: 0, count: 0 };
    entry.sum += snapshot.score_percent;
    entry.count += 1;
    byDay.set(key, entry);
  }
  const trend = [...byDay.values()].map((entry) => Math.round(entry.sum / entry.count));
  const weakest = weakestTopics(
    ((snapshotData ?? []) as unknown as { topic_breakdown: Json }[]).map(
      (snapshot) => snapshot.topic_breakdown
    )
  );

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

      {attention.length > 0 ? (
        <Card className="border-amber-600/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-amber-700" aria-hidden="true" />
              Needs your attention
            </CardTitle>
          </CardHeader>
          <ul className="grid gap-2">
            {attention.map((item) => (
              <li key={item.text} className="flex items-center justify-between gap-3 text-sm">
                <span>{item.text}</span>
                <Button asChild size="sm" variant="outline">
                  <Link href={item.href}>{item.action}</Link>
                </Button>
              </li>
            ))}
          </ul>
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
            {(practiceCount ?? 0) > 0 ? (
              <span>
                <strong className="font-serif text-lg">{practiceCount}</strong> practice answers this week
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

      {weakest.length > 0 || trend.length >= 2 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {weakest.length > 0 ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="text-base">Reteach radar</CardTitle>
                  <p className="script-note mt-0.5">What the batch finds hardest —</p>
                </div>
              </CardHeader>
              <div className="grid gap-2.5">
                {weakest.map((topic) => (
                  <div key={topic.topic} className="grid gap-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <span>{topic.topic}</span>
                      <span
                        className={
                          topic.percent < 60 ? "font-serif font-semibold text-amber-700" : "font-serif font-semibold"
                        }
                      >
                        {topic.percent}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          topic.percent < 60
                            ? "bar-animate h-full rounded-full bg-amber-500"
                            : "bar-animate h-full rounded-full bg-primary"
                        }
                        style={{ width: `${topic.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          {trend.length >= 2 ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="text-base">Batch trend</CardTitle>
                  <p className="script-note mt-0.5">Average score over time —</p>
                </div>
              </CardHeader>
              <div className="flex items-end justify-between gap-3">
                <p className="font-serif text-4xl font-semibold">{trend[trend.length - 1]}%</p>
                <Sparkline className="h-12 w-40" values={trend} />
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

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
