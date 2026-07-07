import Link from "next/link";

import { ShareResultButton } from "@/components/share-result-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { computeRankList } from "@/lib/ranks";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Json } from "@/types/database";

type StudentResultPageProps = {
  params: { testId: string };
};

type CohortSubmission = {
  status: "pending" | "graded";
  student_id: string;
  profiles: { full_name: string } | null;
  answers: {
    awarded_marks: number | null;
    questions: { max_marks: number } | null;
  }[];
};

export default async function StudentResultPage({ params }: StudentResultPageProps) {
  const { user } = await requireProfile("student");
  const supabase = createSupabaseServerClient();

  // Visibility gate: the student's own graded snapshot for this test (RLS-scoped).
  // Only after it exists is the cohort read with the admin client to compute ranks.
  const { data: snapshotRow } = await supabase
    .from("progress_snapshots")
    .select("score_percent,topic_breakdown,created_at,batch_id,tests(title)")
    .eq("test_id", params.testId)
    .maybeSingle();
  const snapshot = snapshotRow as unknown as {
    score_percent: number;
    topic_breakdown: Json;
    created_at: string;
    batch_id: string;
    tests: { title: string } | { title: string }[] | null;
  } | null;

  if (!snapshot) {
    return (
      <main className="page-shell max-w-2xl">
        <Card>
          <CardTitle>Result not ready yet</CardTitle>
          <p className="script-note mt-2">
            Your teacher is still grading — check back soon.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/student">Back to dashboard</Link>
          </Button>
        </Card>
      </main>
    );
  }

  const admin = createSupabaseAdminClient();
  const [{ data: testRow }, { data: cohortData }, { data: historyData }] = await Promise.all([
    admin.from("tests").select("title,show_full_ranks").eq("id", params.testId).single(),
    admin
      .from("test_submissions")
      .select("status,student_id,profiles(full_name),answers(awarded_marks,questions(max_marks))")
      .eq("test_id", params.testId),
    supabase
      .from("progress_snapshots")
      .select("test_id,score_percent,created_at")
      .eq("batch_id", snapshot.batch_id)
      .order("created_at", { ascending: true })
  ]);

  const cohort = (cohortData ?? []) as unknown as CohortSubmission[];
  const { ranked } = computeRankList(
    cohort.map((submission) => ({
      studentId: submission.student_id,
      name: submission.profiles?.full_name ?? "Student",
      awarded: submission.answers.reduce((sum, answer) => sum + (answer.awarded_marks ?? 0), 0),
      max: submission.answers.reduce((sum, answer) => sum + (answer.questions?.max_marks ?? 0), 0),
      graded: submission.status === "graded"
    }))
  );

  const mine = ranked.find((row) => row.studentId === user.id);
  const showFullRanks = testRow?.show_full_ranks === true;
  const joinedTest = Array.isArray(snapshot.tests) ? snapshot.tests[0] : snapshot.tests;
  const testTitle = joinedTest?.title ?? testRow?.title ?? "Test";

  // Delta vs the previous test in this batch (existing pattern).
  const history = historyData ?? [];
  const position = history.findIndex((row) => row.test_id === params.testId);
  const delta =
    position > 0 ? Math.round(snapshot.score_percent - history[position - 1].score_percent) : null;

  return (
    <main className="page-shell max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{testTitle}</h1>
        <div className="flex flex-wrap gap-2">
          <ShareResultButton
            percentage={snapshot.score_percent}
            rank={mine?.rank ?? null}
            testTitle={testTitle}
            totalStudents={mine ? ranked.length : null}
          />
          <Button asChild variant="outline">
            <Link href="/student">Back</Link>
          </Button>
        </div>
      </div>

      <Card className="border-primary/30">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="font-serif text-6xl font-semibold">{snapshot.score_percent}%</p>
          {delta !== null ? (
            <span
              className={
                delta >= 0
                  ? "rounded-full bg-primary px-2.5 py-0.5 text-sm font-medium text-primary-foreground"
                  : "rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800"
              }
            >
              {delta >= 0 ? `+${delta}%` : `${delta}%`} vs last test
            </span>
          ) : null}
        </div>
        {mine ? (
          <p className="mt-2 font-medium">
            Rank {mine.rank} of {ranked.length}
            <span className="text-muted-foreground"> · top {mine.percentile}%</span>
          </p>
        ) : null}
        <p className="script-note mt-2 text-lg">
          {snapshot.score_percent >= 80
            ? "Top form. Consistency like this compounds."
            : snapshot.score_percent >= 50
              ? "Solid base — one focused revision pass and this jumps."
              : "Now you know exactly what to revise. That's an advantage."}
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Topic breakdown</CardTitle>
        </CardHeader>
        <TopicBars value={snapshot.topic_breakdown} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{showFullRanks ? "Rank list" : "Top 3"}</CardTitle>
        </CardHeader>
        <ol className="grid gap-2">
          {(showFullRanks ? ranked : ranked.slice(0, 3)).map((row) => (
            <li
              key={row.studentId}
              className={
                row.studentId === user.id
                  ? "flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-secondary/40 px-3 py-2"
                  : "flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              }
            >
              <span className="flex items-center gap-3">
                <span className="font-serif text-lg font-semibold">{row.rank}</span>
                <span>{row.studentId === user.id ? `${row.name} (you)` : row.name}</span>
              </span>
              <span className="font-serif font-semibold">{row.percentage}%</span>
            </li>
          ))}
        </ol>
        {!showFullRanks ? (
          <p className="script-note mt-3">Your teacher shares the top 3 — the full list stays with them.</p>
        ) : null}
      </Card>
    </main>
  );
}

function TopicBars({ value }: { value: Json }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  return (
    <div className="grid gap-2 text-sm">
      {Object.entries(value).map(([topic, raw]) => {
        const score = raw && typeof raw === "object" && !Array.isArray(raw) ? raw.percent : null;
        const percent = typeof score === "number" ? Math.max(0, Math.min(100, score)) : null;
        if (percent === null) return null;

        return (
          <div key={topic} className="grid gap-1">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{topic}</span>
              <span className="font-serif font-semibold">{percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="bar-animate h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
