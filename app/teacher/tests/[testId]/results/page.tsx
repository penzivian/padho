import { MessageCircle } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";

import { toggleRankVisibilityAction } from "@/app/actions";
import { CopyMessagesButton } from "@/components/copy-messages-button";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { computeRankList } from "@/lib/ranks";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildResultMessage, buildWaLink } from "@/lib/whatsapp";
import type { Json } from "@/types/database";

type ResultsPageProps = {
  params: { testId: string };
  searchParams?: { error?: string };
};

type SubmissionRow = {
  id: string;
  status: "pending" | "graded";
  student_id: string;
  profiles: { full_name: string; phone: string | null } | null;
  answers: {
    awarded_marks: number | null;
    questions: { max_marks: number } | null;
  }[];
};

type SnapshotRow = {
  student_id: string;
  topic_breakdown: Json;
};

const BUCKETS = [
  { label: "<40", test: (p: number) => p < 40 },
  { label: "40–60", test: (p: number) => p >= 40 && p < 60 },
  { label: "60–80", test: (p: number) => p >= 60 && p < 80 },
  { label: "80–100", test: (p: number) => p >= 80 }
];

export default async function TestResultsPage({ params, searchParams }: ResultsPageProps) {
  const { profile } = await requireProfile("teacher");
  const supabase = createSupabaseServerClient();

  const { data: test } = await supabase
    .from("tests")
    .select("id,title,show_full_ranks")
    .eq("id", params.testId)
    .maybeSingle();

  if (!test) {
    return (
      <main className="page-shell">
        <Card>Test not available.</Card>
      </main>
    );
  }

  const [{ data: submissionData }, { data: snapshotData }] = await Promise.all([
    supabase
      .from("test_submissions")
      .select("id,status,student_id,profiles(full_name,phone),answers(awarded_marks,questions(max_marks))")
      .eq("test_id", params.testId),
    supabase.from("progress_snapshots").select("student_id,topic_breakdown").eq("test_id", params.testId)
  ]);

  const submissions = (submissionData ?? []) as unknown as SubmissionRow[];
  const snapshots = (snapshotData ?? []) as unknown as SnapshotRow[];
  const bestTopicByStudent = new Map(
    snapshots.map((snapshot) => [snapshot.student_id, bestTopic(snapshot.topic_breakdown)])
  );

  const { ranked, pending } = computeRankList(
    submissions.map((submission) => ({
      studentId: submission.student_id,
      name: submission.profiles?.full_name ?? "Student",
      awarded: submission.answers.reduce((sum, answer) => sum + (answer.awarded_marks ?? 0), 0),
      max: submission.answers.reduce((sum, answer) => sum + (answer.questions?.max_marks ?? 0), 0),
      graded: submission.status === "graded"
    }))
  );

  const phoneByStudent = new Map(
    submissions.map((submission) => [submission.student_id, submission.profiles?.phone ?? null])
  );
  const resultUrl = (studentTestId: string) => `${requestOrigin()}/student/results/${studentTestId}`;
  const messages = ranked.map((row) =>
    buildResultMessage({
      studentName: row.name.split(/\s+/)[0] || row.name,
      testTitle: test.title,
      score: row.awarded,
      maxScore: row.max,
      percentage: row.percentage,
      rank: test.show_full_ranks ? row.rank : null,
      totalStudents: test.show_full_ranks ? ranked.length : null,
      resultUrl: resultUrl(test.id),
      teacherName: profile.full_name.split(/\s+/)[0] || profile.full_name
    })
  );

  const bucketCounts = BUCKETS.map((bucket) => ranked.filter((row) => bucket.test(row.percentage)).length);
  const maxBucket = Math.max(1, ...bucketCounts);

  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Results · {test.title}</h1>
          <p className="script-note mt-0.5">
            {ranked.length} graded{pending.length > 0 ? ` · ${pending.length} awaiting grading` : ""} —
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/teacher/tests/${test.id}/grading`}>Grading</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/teacher/tests">Back to tests</Link>
          </Button>
        </div>
      </div>

      {searchParams?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}

      {ranked.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Score distribution</CardTitle>
          </CardHeader>
          <div className="grid gap-2">
            {BUCKETS.map((bucket, index) => (
              <div key={bucket.label} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-3 text-sm">
                <span className="text-muted-foreground">{bucket.label}%</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="bar-animate h-full rounded-full bg-primary"
                    style={{ width: `${(bucketCounts[index] / maxBucket) * 100}%` }}
                  />
                </div>
                <span className="text-right font-serif font-semibold">{bucketCounts[index]}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Rank list</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              When off, students see their own rank and the top 3.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyMessagesButton messages={messages} />
            <form action={toggleRankVisibilityAction}>
              <input type="hidden" name="test_id" value={test.id} />
              <input type="hidden" name="show_full_ranks" value={test.show_full_ranks ? "false" : "true"} />
              <SubmitButton pendingText="Saving" variant={test.show_full_ranks ? "default" : "outline"}>
                {test.show_full_ranks ? "Full rank list visible to students" : "Show full rank list to students"}
              </SubmitButton>
            </form>
          </div>
        </CardHeader>

        {ranked.length === 0 ? (
          <p className="script-note">No graded submissions yet — approve grades first.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">Rank</th>
                  <th className="py-2 pr-2 font-medium">Student</th>
                  <th className="py-2 pr-2 font-medium">Score</th>
                  <th className="py-2 pr-2 font-medium">%</th>
                  <th className="py-2 pr-2 font-medium">Strongest topic</th>
                  <th className="py-2 text-right font-medium">Send</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, index) => {
                  const phone = phoneByStudent.get(row.studentId);
                  return (
                    <tr
                      key={row.studentId}
                      className={
                        row.rank <= 3
                          ? "border-b border-l-4 border-l-primary bg-secondary/20 last:border-b-0"
                          : "border-b last:border-b-0"
                      }
                    >
                      <td className="py-2.5 pl-2 pr-2 font-serif text-lg font-semibold">{row.rank}</td>
                      <td className="py-2.5 pr-2">{row.name}</td>
                      <td className="py-2.5 pr-2 font-serif font-semibold">
                        {row.awarded}
                        <span className="text-xs text-muted-foreground"> / {row.max}</span>
                      </td>
                      <td className="py-2.5 pr-2 font-serif font-semibold">{row.percentage}%</td>
                      <td className="py-2.5 pr-2 text-muted-foreground">
                        {bestTopicByStudent.get(row.studentId) ?? "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        {phone ? (
                          <a
                            aria-label={`Send ${row.name}'s result on WhatsApp`}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border text-primary transition hover:border-primary/40 hover:bg-secondary/40 active:scale-95"
                            href={buildWaLink(phone, messages[index])}
                            rel="noopener noreferrer"
                            target="_blank"
                            title="Send on WhatsApp"
                          >
                            <MessageCircle className="h-5 w-5" aria-hidden="true" />
                          </a>
                        ) : (
                          <span
                            className="inline-flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-lg border text-muted-foreground/40"
                            title="No phone on record"
                          >
                            <MessageCircle className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pending.length > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Awaiting grading: {pending.map((row) => row.name).join(", ")}
          </p>
        ) : null}
      </Card>
    </main>
  );
}

function bestTopic(breakdown: Json): string | null {
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return null;

  let best: { topic: string; percent: number } | null = null;
  for (const [topic, raw] of Object.entries(breakdown)) {
    const percent =
      raw && typeof raw === "object" && !Array.isArray(raw) && typeof raw.percent === "number"
        ? raw.percent
        : null;
    if (percent !== null && (!best || percent > best.percent)) best = { topic, percent };
  }
  return best ? best.topic : null;
}

function requestOrigin() {
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}
