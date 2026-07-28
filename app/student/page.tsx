import { Suspense } from "react";

import Link from "next/link";
import { ClipboardList, Dumbbell, PlusCircle } from "lucide-react";

import { joinBatchAction } from "@/app/actions";
import { ResultReveal } from "@/components/result-reveal";
import { Sparkline } from "@/components/sparkline";
import { StudentActivityHeatmap } from "@/components/student-activity-heatmap";
import { StudentWeekStrip } from "@/components/student-week-strip";
import { SubmitButton } from "@/components/submit-button";
import { TopicSegmentBar } from "@/components/topic-segment-bar";
import { TestCountdown } from "@/components/test-countdown";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import type { ActivityEvent } from "@/lib/activity";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/utils";
import type { Json } from "@/types/database";

type StudentPageProps = {
  searchParams?: { error?: string };
};

type BatchMembership = {
  batch_id: string;
  batches: {
    name: string;
    subject: string;
    exam_target: string;
  } | null;
};

type TestRow = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  closed_at: string | null;
  batches: { name: string } | null;
};

type SubmissionRow = {
  test_id: string;
  status: "pending" | "graded";
  submitted_at: string | null;
};

type ProgressRow = {
  id: string;
  test_id: string;
  score_percent: number;
  topic_breakdown: Json;
  created_at: string;
  tests: { title: string } | null;
  batches: { name: string } | null;
};

export default async function StudentHomePage({ searchParams }: StudentPageProps) {
  const { profile } = await requireProfile("student");
  const supabase = createSupabaseServerClient();
  const [
    { data: membershipData },
    { data: testData },
    { data: submissionData },
    { data: progressData }
  ] = await Promise.all([
    supabase.from("batch_students").select("batch_id,batches(name,subject,exam_target)"),
    supabase
      .from("tests")
      .select("id,title,scheduled_at,duration_minutes,closed_at,batches(name)")
      .order("scheduled_at", { ascending: false }),
    supabase.from("test_submissions").select("test_id,status,submitted_at"),
    supabase
      .from("progress_snapshots")
      .select("id,test_id,score_percent,topic_breakdown,created_at,tests(title),batches(name)")
      .order("created_at", { ascending: false })
  ]);

  const memberships = (membershipData ?? []) as unknown as BatchMembership[];
  const tests = (testData ?? []) as unknown as TestRow[];
  const submissions = (submissionData ?? []) as SubmissionRow[];
  const progress = (progressData ?? []) as unknown as ProgressRow[];
  // An unsubmitted row is an attempt in progress, not a finished one — it must not read as
  // "pending", and it turns the CTA into Resume.
  const submittedByTest = new Map(
    submissions
      .filter((submission) => submission.submitted_at)
      .map((submission) => [submission.test_id, submission.status])
  );
  const inProgress = new Set(
    submissions.filter((submission) => !submission.submitted_at).map((row) => row.test_id)
  );
  const averageScore = progress.length
    ? Math.round(progress.reduce((sum, snapshot) => sum + snapshot.score_percent, 0) / progress.length)
    : null;
  const firstName = profile.full_name.split(/\s+/)[0] || "student";
  const hasBatch = memberships.length > 0;
  // progress is fetched newest-first; delta compares the latest result to the one before it.
  const latestResult = progress[0] ?? null;
  const resultDelta =
    latestResult && progress[1] ? Math.round(latestResult.score_percent - progress[1].score_percent) : null;
  // "Today" hero: a live test wins; else the next upcoming test; else practice.
  const now = Date.now();
  const endOf = (test: TestRow) =>
    new Date(test.scheduled_at).getTime() + test.duration_minutes * 60_000;
  // Students now see scheduled tests before they open, so "takeable" means the window is
  // actually open — an upcoming test is listed but not yet a call to action.
  const isOpen = (test: TestRow) =>
    !submittedByTest.has(test.id) &&
    !test.closed_at &&
    new Date(test.scheduled_at).getTime() <= now &&
    now <= endOf(test);
  const openTests = tests.filter(isOpen).length;
  const firstOpenTestId = tests.find(isOpen)?.id ?? null;
  const liveTest = tests.find(isOpen) ?? null;
  const nextTest = liveTest
    ? null
    : (tests
        .filter(
          (test) =>
            !submittedByTest.has(test.id) &&
            !test.closed_at &&
            new Date(test.scheduled_at).getTime() > now
        )
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null);
  const trendValues = [...progress].reverse().map((snapshot) => snapshot.score_percent);
  // Practice events are fetched inside the streamed heatmap; test events come from
  // the submissions already loaded here.
  const testEvents: ActivityEvent[] = submissions
    .filter((row) => row.submitted_at)
    .map((row) => ({ at: row.submitted_at as string, kind: "test" as const }));

  return (
    <main className="page-shell">
      <div>
        <p className="greeting-eyebrow">Namaskar,</p>
        <h1 className="text-3xl font-semibold">{firstName}</h1>
      </div>

      {searchParams?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}

      {hasBatch && latestResult ? (
        <ResultReveal
          snapshotId={latestResult.id}
          testTitle={latestResult.tests?.title ?? "Latest test"}
          scorePercent={latestResult.score_percent}
          delta={resultDelta}
        />
      ) : null}

      {hasBatch ? (
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
        {liveTest ? (
          <Card className="surface-teal h-full border-primary/50">
            <CardHeader>
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
                  Live now
                </p>
                <CardTitle className="mt-1 text-2xl">{liveTest.title}</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {liveTest.batches?.name ?? "Your batch"} · {liveTest.duration_minutes} min
                </p>
              </div>
              <TestCountdown
                endsAt={new Date(endOf(liveTest)).toISOString()}
                prefix="ends "
              />
            </CardHeader>
            <Button asChild className="h-12 w-full">
              <Link href={`/student/tests/${liveTest.id}`}>
                {inProgress.has(liveTest.id) ? "Resume the test →" : "Take the test →"}
              </Link>
            </Button>
          </Card>
        ) : nextTest ? (
          <Card className="h-full">
            <CardHeader>
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#c98a3c]">
                  Up next
                </p>
                <CardTitle className="mt-1 text-2xl">{nextTest.title}</CardTitle>
              </div>
              <TestCountdown endsAt={nextTest.scheduled_at} prefix="starts in " expiredText="live now" />
            </CardHeader>
            <Button asChild className="mb-3" variant="outline">
              <Link href={`/student/tests/${nextTest.id}`}>Read instructions →</Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(nextTest.scheduled_at)} · until then, keep the streak going.
            </p>
            <Button asChild className="mt-3" variant="outline">
              <Link href="/student/practice">
                <Dumbbell className="h-4 w-4" aria-hidden="true" />
                Practice now
              </Link>
            </Button>
          </Card>
        ) : (
          <Card className="h-full">
            <CardHeader>
              <div>
                <p className="script-note">Nothing scheduled —</p>
                <CardTitle className="text-xl">Perfect day to practice</CardTitle>
              </div>
            </CardHeader>
            <Button asChild>
              <Link href="/student/practice">
                <Dumbbell className="h-4 w-4" aria-hidden="true" />
                Start practicing
              </Link>
            </Button>
          </Card>
        )}
        </div>
        <div className="hidden md:block lg:col-span-2">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <StudentActivityHeatmap testEvents={testEvents} />
          </Suspense>
        </div>
      </div>
      ) : null}

      {hasBatch ? (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Batches</p>
            <p className="mt-1 font-serif text-4xl font-semibold">{memberships.length}</p>
          </Card>
          <Card>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Open tests</p>
            <p className="mt-1 font-serif text-4xl font-semibold">{openTests}</p>
          </Card>
          <Card>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {trendValues.length >= 2 ? "Score trend" : "Avg score"}
            </p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="font-serif text-4xl font-semibold text-primary">
                {averageScore !== null ? `${averageScore}%` : "—"}
              </p>
              <Sparkline className="hidden sm:block" values={trendValues} />
            </div>
          </Card>
        </div>
      ) : null}

      {hasBatch ? (
        <div className="md:hidden">
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <StudentWeekStrip testEvents={testEvents} />
          </Suspense>
        </div>
      ) : null}

      <Card className={hasBatch ? undefined : "border-primary/40"}>
        <CardHeader>
          <div>
            <CardTitle className={hasBatch ? undefined : "text-xl"}>
              {hasBatch ? "Join another batch" : "Join your batch to begin"}
            </CardTitle>
            {!hasBatch ? (
              <p className="script-note mt-0.5">
                Ask your teacher for the invite code — tests and progress appear right after.
              </p>
            ) : null}
          </div>
          <PlusCircle className="h-5 w-5 text-primary" />
        </CardHeader>
        <form action={joinBatchAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <FormField htmlFor="invite_code" label="Invite code">
            <Input id="invite_code" name="invite_code" placeholder="e.g. 6F63S4Y" required />
          </FormField>
          <div className="flex items-end">
            <SubmitButton pendingText="Joining" variant={hasBatch ? "outline" : "default"}>
              Join
            </SubmitButton>
          </div>
        </form>
      </Card>

      {memberships.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2">
          {memberships.map((membership) => (
            <Card key={membership.batch_id}>
              <CardHeader>
                <CardTitle>{membership.batches?.name ?? "Batch"}</CardTitle>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {membership.batches?.exam_target ?? "Exam"}
                </span>
              </CardHeader>
              <p className="text-sm text-muted-foreground">{membership.batches?.subject ?? "-"}</p>
            </Card>
          ))}
        </section>
      ) : null}

      {hasBatch ? (
      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Tests</h2>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/student/tests">All tests →</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {tests.slice(0, 4).map((test) => {
            const submitted = submittedByTest.get(test.id);
            const open = isOpen(test);
            const upcoming =
      !submitted && !test.closed_at && new Date(test.scheduled_at).getTime() > now;
            return (
              <Card key={test.id}>
                <CardHeader>
                  <CardTitle>{test.title}</CardTitle>
                  <span
                    className={
                      submitted === "graded"
                        ? "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                        : submitted === "pending"
                          ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                          : open
                            ? "rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
                            : "rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                    }
                  >
                    {submitted ??
                      (open
                        ? "open"
                        : upcoming
                          ? "upcoming"
                          : test.closed_at
                            ? "closed"
                            : "missed")}
                  </span>
                </CardHeader>
                <dl className="mb-4 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Batch</dt>
                    <dd>{test.batches?.name ?? "-"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Starts</dt>
                    <dd>{formatDateTime(test.scheduled_at)}</dd>
                  </div>
                </dl>
                {open ? (
                  <Button asChild variant={test.id === firstOpenTestId ? "default" : "outline"}>
                    <Link href={`/student/tests/${test.id}`}>
                      {inProgress.has(test.id) ? "Resume test" : "Take test"}
                    </Link>
                  </Button>
                ) : upcoming ? (
                  <div className="grid gap-2">
                    <TestCountdown
                      endsAt={test.scheduled_at}
                      prefix="starts in "
                      expiredText="live now"
                    />
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/student/tests/${test.id}`}>View instructions</Link>
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>
      ) : null}

      {hasBatch ? (
      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Recent results</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {progress.map((snapshot) => (
            <Card key={snapshot.id}>
              <CardHeader>
                <CardTitle>{snapshot.tests?.title ?? "Test"}</CardTitle>
                <span
                  className={
                    snapshot.score_percent >= 75
                      ? "rounded-full bg-secondary px-2.5 py-0.5 font-serif text-sm font-semibold text-secondary-foreground"
                      : "rounded-full bg-[#f6e9d3] px-2.5 py-0.5 font-serif text-sm font-semibold text-[#8a5a1f] dark:bg-[#3a2f1a] dark:text-[#e0b978]"
                  }
                >
                  {snapshot.score_percent}%
                </span>
              </CardHeader>
              <TopicSegmentBar className="mt-2" value={snapshot.topic_breakdown} />
              <p className="mb-3 mt-2 text-sm text-muted-foreground">{snapshot.batches?.name ?? "-"}</p>
              <TopicBreakdown value={snapshot.topic_breakdown} />
              <Button asChild className="mt-3" size="sm" variant="outline">
                <Link href={`/student/results/${snapshot.test_id}`}>Full result &amp; rank</Link>
              </Button>
            </Card>
          ))}
        </div>
        {progress.length === 0 ? (
          <p className="script-note">Your scores will appear here after your first graded test —</p>
        ) : null}
      </section>
      ) : null}
    </main>
  );
}

function TopicBreakdown({ value }: { value: Json }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  return (
    <div className="grid gap-2 text-sm">
      {Object.entries(value).map(([topic, raw]) => {
        const score = raw && typeof raw === "object" && !Array.isArray(raw) ? raw.percent : null;
        const percent = typeof score === "number" ? Math.max(0, Math.min(100, score)) : null;

        return (
          <div key={topic} className="grid gap-1">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{topic}</span>
              <span>{percent !== null ? `${percent}%` : "-"}</span>
            </div>
            {percent !== null ? (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="bar-animate h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
