import Link from "next/link";
import { CalendarClock, ClipboardCheck, Lock } from "lucide-react";

import { closeTestAction, rescheduleTestAction, scheduleTestAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireProfile } from "@/lib/auth";
import { findKeylessMcqs } from "@/lib/grading";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { utcIsoToScheduleInput } from "@/lib/time";
import { formatDateTime } from "@/lib/utils";

type BatchOption = {
  id: string;
  name: string;
};

type PaperOption = {
  id: string;
  title: string;
  batch_id: string;
  batches: { name: string } | null;
  questions: { question_type: "mcq" | "subjective"; correct_answer: string | null }[];
};

type TestRow = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "draft" | "scheduled" | "completed";
  batches: { name: string } | null;
  closed_at: string | null;
  test_submissions: { id: string; status: "pending" | "graded"; submitted_at: string | null }[];
};

type TestsPageProps = {
  searchParams?: { error?: string };
};

export default async function TeacherTestsPage({ searchParams }: TestsPageProps) {
  await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const [{ data: batchData }, { data: paperData }, { data: testData }] = await Promise.all([
    supabase.from("batches").select("id,name").order("created_at", { ascending: false }),
    supabase
      .from("question_papers")
      .select("id,title,batch_id,batches(name),questions(question_type,correct_answer)")
      .order("created_at", { ascending: false }),
    supabase
      .from("tests")
      .select(
        "id,title,scheduled_at,duration_minutes,status,closed_at,batches(name),test_submissions(id,status,submitted_at)"
      )
      .order("scheduled_at", { ascending: false })
  ]);

  const batches = (batchData ?? []) as BatchOption[];
  const papers = (paperData ?? []) as unknown as PaperOption[];
  const tests = (testData ?? []) as unknown as TestRow[];
  const nowMs = Date.now();

  return (
    <main className="page-shell">
      <div>
        <h1 className="text-2xl font-semibold">Tests</h1>
        <p className="script-note mt-0.5">Schedule, let students take it, then approve the grades —</p>
      </div>

      {searchParams?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Schedule test</CardTitle>
          <CalendarClock className="h-5 w-5 text-primary" />
        </CardHeader>
        <form action={scheduleTestAction} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_0.7fr_auto]">
          <FormField htmlFor="batch_id" label="Batch">
            <Select id="batch_id" name="batch_id" required>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField htmlFor="question_paper_id" label="Paper">
            <Select id="question_paper_id" name="question_paper_id" required>
              {papers.map((paper) => {
                const keyless = findKeylessMcqs(
                  paper.questions.map((question) => ({
                    type: question.question_type,
                    correctAnswer: question.correct_answer
                  }))
                ).length;

                return (
                  <option key={paper.id} value={paper.id}>
                    {paper.title} · {paper.batches?.name ?? "Batch"}
                    {keyless > 0 ? ` · ${keyless} to grade by hand` : ""}
                  </option>
                );
              })}
            </Select>
          </FormField>
          <FormField htmlFor="title" label="Title">
            <Input id="title" name="title" required />
          </FormField>
          <FormField htmlFor="duration_minutes" label="Minutes">
            <Input id="duration_minutes" name="duration_minutes" type="number" min="1" defaultValue="60" />
          </FormField>
          <div className="grid gap-2 lg:col-span-4">
            <FormField htmlFor="scheduled_at" label="Schedule (IST)">
              <Input id="scheduled_at" name="scheduled_at" type="datetime-local" required />
            </FormField>
          </div>
          <div className="flex items-end">
            <SubmitButton pendingText="Scheduling">Schedule</SubmitButton>
          </div>
          <p className="script-note lg:col-span-5">
            No answer key? Schedule anyway — MCQs without a key land in your grading queue
            instead of auto-scoring.
          </p>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {tests.map((test) => {
          // In-progress attempts carry status "pending" too, so a finished attempt is the
          // one with submitted_at set — otherwise a student mid-test inflates the queue.
          const pending = test.test_submissions.filter(
            (submission) => submission.status === "pending" && submission.submitted_at
          ).length;
          const takingNow = test.test_submissions.filter(
            (submission) => !submission.submitted_at
          ).length;

          const startsAtMs = new Date(test.scheduled_at).getTime();
          const endsAtMs = startsAtMs + test.duration_minutes * 60_000;
          const isLive = !test.closed_at && nowMs >= startsAtMs && nowMs <= endsAtMs;
          const isOver = Boolean(test.closed_at) || nowMs > endsAtMs;
          const phase = test.closed_at
            ? "closed"
            : isLive
              ? "live now"
              : isOver
                ? "ended"
                : "scheduled";

          return (
            <Card key={test.id}>
              <CardHeader>
                <div>
                  <CardTitle>{test.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{test.batches?.name ?? "-"}</p>
                </div>
                <span
                  className={
                    isLive
                      ? "rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
                      : test.closed_at
                        ? "rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                        : "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                  }
                >
                  {phase}
                </span>
              </CardHeader>
              <dl className="mb-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Starts</dt>
                  <dd>{formatDateTime(test.scheduled_at)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd>{test.duration_minutes} min</dd>
                </div>
                {takingNow > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Taking now</dt>
                    <dd>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                        {takingNow}
                      </span>
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Needs review</dt>
                  <dd>
                    {pending > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {pending}
                      </span>
                    ) : (
                      "0"
                    )}
                  </dd>
                </div>
              </dl>

              <details className="mb-3 rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {test.closed_at ? "Reopen / reschedule" : "Reschedule"}
                </summary>
                <form
                  action={rescheduleTestAction}
                  className="mt-3 grid gap-3 sm:grid-cols-[1fr_0.5fr_auto] sm:items-end"
                >
                  <input type="hidden" name="test_id" value={test.id} />
                  <FormField htmlFor={`reschedule_at_${test.id}`} label="New start (IST)">
                    <Input
                      id={`reschedule_at_${test.id}`}
                      name="scheduled_at"
                      type="datetime-local"
                      defaultValue={utcIsoToScheduleInput(test.scheduled_at)}
                      required
                    />
                  </FormField>
                  <FormField htmlFor={`reschedule_mins_${test.id}`} label="Minutes">
                    <Input
                      id={`reschedule_mins_${test.id}`}
                      name="duration_minutes"
                      type="number"
                      min="1"
                      defaultValue={test.duration_minutes}
                    />
                  </FormField>
                  <SubmitButton pendingText="Saving" variant="outline">
                    Save
                  </SubmitButton>
                </form>
                {test.closed_at ? (
                  <p className="script-note mt-2">
                    Saving a new time reopens this test for the batch.
                  </p>
                ) : null}
              </details>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/teacher/tests/${test.id}/grading`}>
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                    Grade
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/teacher/tests/${test.id}/results`}>Results</Link>
                </Button>
                {!test.closed_at ? (
                  <form action={closeTestAction}>
                    <input type="hidden" name="test_id" value={test.id} />
                    <SubmitButton pendingText="Closing" variant="outline">
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      Close test
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
