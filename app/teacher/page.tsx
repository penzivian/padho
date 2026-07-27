import { Suspense } from "react";

import Link from "next/link";
import { CalendarClock, CheckCircle2, Circle, Sparkles, UsersRound } from "lucide-react";

import { CopyChip } from "@/components/copy-chip";
import { Sparkline } from "@/components/sparkline";
import { TeacherActivityFeed } from "@/components/teacher-activity-feed";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { findKeylessMcqs } from "@/lib/grading";
import { weakestTopics } from "@/lib/topics";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Json } from "@/types/database";

type BatchRow = {
  id: string;
  name: string;
  exam_target: string;
  invite_code: string;
  batch_students: { count: number }[];
};

export default async function TeacherHomePage() {
  const { profile } = await requireProfile("teacher");
  const supabase = createSupabaseServerClient();

  const [
    { count: paperCount },
    { count: testCount },
    { count: studentCount },
    { count: submissionCount },
    { count: gradedCount },
    { count: practiceCount },
    { data: snapshotData },
    { data: pendingData },
    { data: paperData },
    { data: liveTestData },
    { data: batchData }
  ] = await Promise.all([
    supabase.from("question_papers").select("id", { count: "exact", head: true }),
    supabase.from("tests").select("id", { count: "exact", head: true }),
    supabase.from("batch_students").select("student_id", { count: "exact", head: true }),
    supabase
      .from("test_submissions")
      .select("id", { count: "exact", head: true })
      .not("submitted_at", "is", null),
    supabase
      .from("test_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "graded")
      .not("submitted_at", "is", null),
    supabase
      .from("practice_attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
    supabase
      .from("progress_snapshots")
      .select("student_id,batch_id,score_percent,created_at,topic_breakdown")
      .order("created_at", { ascending: true }),
    supabase
      .from("test_submissions")
      .select("id,tests(id,title)")
      .eq("status", "pending")
      .not("submitted_at", "is", null),
    supabase.from("question_papers").select("id,title,questions(question_type,correct_answer)"),
    supabase
      .from("tests")
      .select("id,title,scheduled_at,duration_minutes")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString()),
    supabase
      .from("batches")
      .select("id,name,exam_target,invite_code,batch_students(count)")
      .order("created_at", { ascending: false })
  ]);

  const batches = (batchData ?? []) as unknown as BatchRow[];
  const batchCount = batches.length;
  const pendingCount = (submissionCount ?? 0) - (gradedCount ?? 0);
  const firstName = profile.full_name.split(/\s+/)[0] || "teacher";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning," : hour < 17 ? "Good afternoon," : "Good evening,";

  const steps = [
    { label: "Create your first batch", hint: "Students join with its invite code", href: "/teacher/batches", done: batchCount > 0 },
    { label: "Build a question paper", hint: "Draft with AI or upload a PDF", href: "/teacher/papers/new", done: (paperCount ?? 0) > 0 },
    { label: "Schedule a test", hint: "Students take it live; MCQs auto-score", href: "/teacher/tests", done: (testCount ?? 0) > 0 }
  ];
  const setupDone = steps.every((step) => step.done);

  const batchAverages = new Map<string, { sum: number; count: number }>();
  for (const snapshot of snapshotData ?? []) {
    const entry = batchAverages.get(snapshot.batch_id) ?? { sum: 0, count: 0 };
    entry.sum += snapshot.score_percent;
    entry.count += 1;
    batchAverages.set(snapshot.batch_id, entry);
  }

  // Actionable todos (distinct from the passive activity feed).
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
        paper.questions.map((question) => ({ type: question.question_type, correctAnswer: question.correct_answer }))
      ).length > 0
  );
  const nowMs = Date.now();
  const liveTests = (
    (liveTestData ?? []) as { id: string; title: string; scheduled_at: string; duration_minutes: number }[]
  ).filter((test) => nowMs <= new Date(test.scheduled_at).getTime() + test.duration_minutes * 60_000);

  const actions = [
    ...[...pendingByTest.entries()].map(([id, entry]) => ({
      text: `${entry.count} answer${entry.count === 1 ? " needs" : "s need"} grading in ${entry.title}`,
      href: `/teacher/tests/${id}/grading`,
      action: "Grade"
    })),
    ...keylessPapers.map((paper) => ({
      text: `${paper.title} has MCQs without answer keys — add keys to auto-score them`,
      href: "/teacher/papers",
      action: "Add keys"
    })),
    ...liveTests.map((test) => ({
      text: `${test.title} is live right now`,
      href: `/teacher/tests/${test.id}/results`,
      action: "Watch"
    }))
  ].slice(0, 3);

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
    ((snapshotData ?? []) as unknown as { topic_breakdown: Json }[]).map((snapshot) => snapshot.topic_breakdown)
  );
  const improvement = improvementStats(snapshotData ?? []);

  return (
    <main className="page-shell">
      <div className="hero-gradient flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 shadow-sm">
        <div>
          <p className="greeting-eyebrow">{greeting}</p>
          <h1 className="text-3xl font-semibold">{firstName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/teacher/batches">
              <UsersRound className="h-4 w-4" aria-hidden="true" />
              Create batch
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/teacher/tests">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Schedule test
            </Link>
          </Button>
          <Button asChild>
            <Link href="/teacher/papers/new">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              New paper
            </Link>
          </Button>
        </div>
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard href="/teacher/batches" label="Batches" value={batchCount} />
        <StatCard href="/teacher/batches" label="Students" value={studentCount ?? 0} />
        <StatCard href="/teacher/papers" label="Papers" value={paperCount ?? 0} />
        <StatCard href="/teacher/tests" label="To grade" value={pendingCount} highlight={pendingCount > 0} />
      </div>

      {(submissionCount ?? 0) > 0 ? (
        <div className="surface-teal rounded-lg border px-4 py-3">
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

      {setupDone ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
          <div className="grid grid-cols-1 gap-4 lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Your batches</CardTitle>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/teacher/batches">View all →</Link>
                </Button>
              </CardHeader>
              <div className="grid gap-3">
                {batches.slice(0, 4).map((batch) => {
                  const average = batchAverages.get(batch.id);
                  const percent = average ? Math.round(average.sum / average.count) : null;
                  const studentTotal = batch.batch_students[0]?.count ?? 0;

                  return (
                    <div key={batch.id} className="surface-gradient rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-serif text-base font-semibold">{batch.name}</p>
                        <CopyChip value={batch.invite_code} />
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {batch.exam_target} · {studentTotal} {studentTotal === 1 ? "student" : "students"}
                      </p>
                      {percent !== null ? (
                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={
                                percent >= 60
                                  ? "bar-animate h-full rounded-full bg-primary"
                                  : "bar-animate h-full rounded-full bg-[#c98a3c]"
                              }
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="font-serif text-sm font-semibold">{percent}%</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <Button asChild className="mt-3 w-full" variant="outline">
                <Link href="/teacher/batches">
                  <UsersRound className="h-4 w-4" aria-hidden="true" />
                  Create a new batch
                </Link>
              </Button>
            </Card>

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
                            topic.percent < 60 ? "font-serif font-semibold text-[#c98a3c]" : "font-serif font-semibold"
                          }
                        >
                          {topic.percent}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={
                            topic.percent < 60
                              ? "bar-animate h-full rounded-full bg-[#c98a3c]"
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
          </div>

          <div className="grid grid-cols-1 gap-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/teacher/activity">View all →</Link>
                </Button>
              </CardHeader>
              {actions.length > 0 ? (
                <ul className="mb-3 grid grid-cols-1 gap-2 border-b pb-3 text-sm">
                  {actions.map((item) => (
                    <li key={item.text} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#c98a3c]" />
                        <span className="truncate">{item.text}</span>
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <Link href={item.href}>{item.action}</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Suspense
                fallback={
                  <div className="grid gap-2.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-5 w-full" />
                    ))}
                  </div>
                }
              >
                <TeacherActivityFeed limit={5} />
              </Suspense>
            </Card>

            {trend.length >= 2 ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle className="text-base">Batch trend</CardTitle>
                    <p className="script-note mt-0.5">Average score over time —</p>
                  </div>
                </CardHeader>
                <div className="flex items-end justify-between gap-3">
                  <p className="font-serif text-4xl font-semibold text-primary">{trend[trend.length - 1]}%</p>
                  <Sparkline className="h-12 w-40" values={trend} />
                </div>
              </Card>
            ) : null}
          </div>
        </div>
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
  label,
  value,
  highlight = false
}: {
  href: string;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <Card
        className={
          highlight
            ? "border-primary bg-primary text-primary-foreground transition hover:bg-primary/90"
            : "surface-gradient transition hover:border-primary/40"
        }
      >
        <p
          className={
            highlight
              ? "font-mono text-xs uppercase tracking-widest text-primary-foreground/70"
              : "font-mono text-xs uppercase tracking-widest text-muted-foreground"
          }
        >
          {label}
        </p>
        <p className="mt-1 font-serif text-4xl font-semibold">{value}</p>
      </Card>
    </Link>
  );
}
