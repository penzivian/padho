import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { TestCountdown } from "@/components/test-countdown";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/utils";

type TestRow = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  batches: { name: string } | null;
};

type SubmissionRow = {
  test_id: string;
  status: "pending" | "graded";
};

export default async function StudentTestsPage() {
  await requireProfile("student");
  const supabase = createSupabaseServerClient();
  const [{ data: testData }, { data: submissionData }] = await Promise.all([
    supabase
      .from("tests")
      .select("id,title,scheduled_at,duration_minutes,batches(name)")
      .order("scheduled_at", { ascending: false }),
    supabase.from("test_submissions").select("test_id,status")
  ]);

  const tests = (testData ?? []) as unknown as TestRow[];
  const submissions = (submissionData ?? []) as SubmissionRow[];
  const statusByTest = new Map(submissions.map((row) => [row.test_id, row.status]));
  const now = Date.now();

  const endOf = (test: TestRow) =>
    new Date(test.scheduled_at).getTime() + test.duration_minutes * 60_000;
  const live = tests.filter(
    (test) =>
      !statusByTest.has(test.id) &&
      new Date(test.scheduled_at).getTime() <= now &&
      now <= endOf(test)
  );
  const upcoming = tests
    .filter((test) => !statusByTest.has(test.id) && new Date(test.scheduled_at).getTime() > now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const done = tests.filter((test) => statusByTest.has(test.id) || now > endOf(test));

  return (
    <main className="page-shell max-w-3xl">
      <div>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-semibold">Tests</h1>
        </div>
        <p className="script-note mt-0.5">Live ones first — results land on your dashboard.</p>
      </div>

      <Section title="Live now" emptyNote={live.length === 0 ? "Nothing live right now." : null}>
        {live.map((test, index) => (
          <Card key={test.id} className="border-primary/40">
            <CardHeader>
              <CardTitle>{test.title}</CardTitle>
              <TestCountdown
                endsAt={new Date(endOf(test)).toISOString()}
                prefix="ends in "
                expiredText="Time up"
              />
            </CardHeader>
            <TestMeta test={test} />
            <Button asChild className="mt-3" variant={index === 0 ? "default" : "outline"}>
              <Link href={`/student/tests/${test.id}`}>Take test</Link>
            </Button>
          </Card>
        ))}
      </Section>

      <Section title="Upcoming" emptyNote={upcoming.length === 0 ? "No tests scheduled yet." : null}>
        {upcoming.map((test) => (
          <Card key={test.id}>
            <CardHeader>
              <CardTitle>{test.title}</CardTitle>
              <TestCountdown endsAt={test.scheduled_at} prefix="starts in " expiredText="live now" />
            </CardHeader>
            <TestMeta test={test} />
          </Card>
        ))}
      </Section>

      <Section title="Done" emptyNote={done.length === 0 ? "Taken tests will appear here." : null}>
        {done.map((test) => {
          const status = statusByTest.get(test.id);
          return (
            <Card key={test.id}>
              <CardHeader>
                <CardTitle>{test.title}</CardTitle>
                <span
                  className={
                    status === "graded"
                      ? "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                      : status === "pending"
                        ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                        : "rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  }
                >
                  {status ?? "missed"}
                </span>
              </CardHeader>
              <TestMeta test={test} />
              {status === "graded" ? (
                <Button asChild className="mt-3" size="sm" variant="outline">
                  <Link href={`/student/results/${test.id}`}>Full result &amp; rank</Link>
                </Button>
              ) : null}
            </Card>
          );
        })}
      </Section>
    </main>
  );
}

function Section({
  title,
  emptyNote,
  children
}: {
  title: string;
  emptyNote: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {emptyNote ? <p className="script-note">{emptyNote}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function TestMeta({ test }: { test: TestRow }) {
  return (
    <dl className="grid gap-1.5 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">Batch</dt>
        <dd>{test.batches?.name ?? "-"}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">Starts</dt>
        <dd>{formatDateTime(test.scheduled_at)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-muted-foreground">Duration</dt>
        <dd>{test.duration_minutes} min</dd>
      </div>
    </dl>
  );
}
