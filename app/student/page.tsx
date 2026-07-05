import Link from "next/link";
import { ClipboardList, PlusCircle } from "lucide-react";

import { joinBatchAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { requireProfile } from "@/lib/auth";
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
  batches: { name: string } | null;
};

type SubmissionRow = {
  test_id: string;
  status: "pending" | "graded";
};

type ProgressRow = {
  id: string;
  score_percent: number;
  topic_breakdown: Json;
  created_at: string;
  tests: { title: string } | null;
  batches: { name: string } | null;
};

export default async function StudentHomePage({ searchParams }: StudentPageProps) {
  const { profile } = await requireProfile("student");
  const supabase = createSupabaseServerClient();
  const [{ data: membershipData }, { data: testData }, { data: submissionData }, { data: progressData }] =
    await Promise.all([
      supabase.from("batch_students").select("batch_id,batches(name,subject,exam_target)"),
      supabase
        .from("tests")
        .select("id,title,scheduled_at,duration_minutes,batches(name)")
        .order("scheduled_at", { ascending: false }),
      supabase.from("test_submissions").select("test_id,status"),
      supabase
        .from("progress_snapshots")
        .select("id,score_percent,topic_breakdown,created_at,tests(title),batches(name)")
        .order("created_at", { ascending: false })
    ]);

  const memberships = (membershipData ?? []) as unknown as BatchMembership[];
  const tests = (testData ?? []) as unknown as TestRow[];
  const submissions = (submissionData ?? []) as SubmissionRow[];
  const progress = (progressData ?? []) as unknown as ProgressRow[];
  const submittedByTest = new Map(submissions.map((submission) => [submission.test_id, submission.status]));
  const openTests = tests.filter((test) => !submittedByTest.has(test.id)).length;
  const averageScore = progress.length
    ? Math.round(progress.reduce((sum, snapshot) => sum + snapshot.score_percent, 0) / progress.length)
    : null;
  const firstName = profile.full_name.split(/\s+/)[0] || "student";

  return (
    <main className="page-shell">
      <div>
        <p className="script-note text-lg">Namaskar,</p>
        <h1 className="text-3xl font-semibold">{firstName}</h1>
      </div>

      {searchParams?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="font-serif text-4xl font-semibold">{memberships.length}</p>
          <p className="mt-1 text-sm text-muted-foreground">Batches</p>
        </Card>
        <Card>
          <p className="font-serif text-4xl font-semibold">{openTests}</p>
          <p className="mt-1 text-sm text-muted-foreground">Open tests</p>
        </Card>
        <Card>
          <p className="font-serif text-4xl font-semibold">
            {averageScore !== null ? `${averageScore}%` : "—"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Average score</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Join a batch</CardTitle>
          <PlusCircle className="h-5 w-5 text-primary" />
        </CardHeader>
        <form action={joinBatchAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <FormField htmlFor="invite_code" label="Invite code">
            <Input id="invite_code" name="invite_code" placeholder="e.g. 6F63S4Y" required />
          </FormField>
          <div className="flex items-end">
            <SubmitButton pendingText="Joining">Join</SubmitButton>
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

      <section className="grid gap-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Tests</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {tests.map((test) => {
            const submitted = submittedByTest.get(test.id);
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
                          : "rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
                    }
                  >
                    {submitted ?? "open"}
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
                {!submitted ? (
                  <Button asChild>
                    <Link href={`/student/tests/${test.id}`}>Take test</Link>
                  </Button>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Progress</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {progress.map((snapshot) => (
            <Card key={snapshot.id}>
              <CardHeader>
                <CardTitle>{snapshot.tests?.title ?? "Test"}</CardTitle>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 font-serif text-sm font-semibold text-secondary-foreground">
                  {snapshot.score_percent}%
                </span>
              </CardHeader>
              <p className="mb-3 text-sm text-muted-foreground">{snapshot.batches?.name ?? "-"}</p>
              <TopicBreakdown value={snapshot.topic_breakdown} />
            </Card>
          ))}
        </div>
        {progress.length === 0 ? (
          <p className="script-note">Your scores will appear here after your first graded test —</p>
        ) : null}
      </section>
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
