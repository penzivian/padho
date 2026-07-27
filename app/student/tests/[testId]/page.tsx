import { Clock3, ListChecks } from "lucide-react";
import Link from "next/link";

import { startTestAction } from "@/app/actions";
import { DeclarationGate } from "@/components/student/declaration-gate";
import { TestCountdown } from "@/components/test-countdown";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/utils";

type TestPageProps = {
  params: { testId: string };
  searchParams?: { error?: string };
};

export default async function TestInstructionsPage({ params, searchParams }: TestPageProps) {
  const { user } = await requireProfile("student");
  const supabase = createSupabaseServerClient();

  // Visibility gate on the RLS-respecting client first; only then read aggregates with admin.
  const { data: test } = await supabase
    .from("tests")
    .select("id,title,scheduled_at,duration_minutes,closed_at,batches(name)")
    .eq("id", params.testId)
    .maybeSingle();

  if (!test) {
    return (
      <main className="page-shell">
        <Card>Test not available.</Card>
      </main>
    );
  }

  const admin = createSupabaseAdminClient();
  // Counts and marks only — never question text, options, keys or rubrics. Those are served
  // exclusively by get_student_test_questions, which checks the test is open.
  const [{ data: paper }, { data: submission }] = await Promise.all([
    admin
      .from("tests")
      .select("question_paper_id,questions:question_papers(questions(question_type,max_marks))")
      .eq("id", params.testId)
      .single(),
    supabase
      .from("test_submissions")
      .select("id,submitted_at")
      .eq("test_id", params.testId)
      .eq("student_id", user.id)
      .maybeSingle()
  ]);

  const questions =
    (paper?.questions as unknown as { questions: { question_type: string; max_marks: number }[] } | null)
      ?.questions ?? [];
  const mcqCount = questions.filter((question) => question.question_type === "mcq").length;
  const subjectiveCount = questions.length - mcqCount;
  const totalMarks = questions.reduce((sum, question) => sum + Number(question.max_marks), 0);

  // Supabase types the embedded relation as an array; it is one row here.
  const batch = Array.isArray(test.batches) ? test.batches[0] : test.batches;
  const batchName = (batch as { name: string } | null | undefined)?.name;

  const startsAtMs = new Date(test.scheduled_at).getTime();
  const endsAtMs = startsAtMs + test.duration_minutes * 60_000;
  const now = Date.now();
  const isClosed = Boolean(test.closed_at);
  const hasStarted = now >= startsAtMs;
  const hasEnded = now > endsAtMs;
  const isOpen = !isClosed && hasStarted && !hasEnded;
  const alreadySubmitted = Boolean(submission?.submitted_at);
  const isResuming = Boolean(submission && !submission.submitted_at);

  return (
    <main className="page-shell max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">{test.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
          {formatDateTime(test.scheduled_at)} · {test.duration_minutes} min ·{" "}
          {batchName ?? "Your batch"}
        </p>
      </div>

      {searchParams?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
            Paper at a glance
          </CardTitle>
          {!isClosed && !hasStarted ? (
            <TestCountdown
              endsAt={test.scheduled_at}
              prefix="starts in "
              expiredText="starting now"
            />
          ) : null}
        </CardHeader>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Questions" value={String(questions.length)} />
          <Row label="Total marks" value={String(totalMarks)} />
          <Row label="Objective (MCQ)" value={String(mcqCount)} />
          <Row label="Descriptive" value={String(subjectiveCount)} />
          <Row label="Duration" value={`${test.duration_minutes} minutes`} />
          <Row label="Starts" value={formatDateTime(test.scheduled_at)} />
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General instructions</CardTitle>
        </CardHeader>
        <ol className="grid list-decimal gap-2 pl-5 text-sm text-muted-foreground">
          <li>
            The countdown at the top right shows the time remaining. The test submits itself
            automatically when the clock reaches zero.
          </li>
          <li>
            One question shows at a time. Use <strong>Save &amp; Next</strong> to record your
            answer and move on, or click any number in the question palette to jump straight to
            that question.
          </li>
          <li>
            The palette colours every question by its status:{" "}
            <strong>answered</strong>, <strong>not answered</strong>,{" "}
            <strong>marked for review</strong>, or <strong>not visited</strong>. A legend sits
            below the palette.
          </li>
          <li>
            <strong>Mark for review</strong> flags a question to come back to. A question that
            is answered <em>and</em> marked for review is still counted — the flag is only a
            reminder for you.
          </li>
          <li>
            <strong>Clear response</strong> removes your answer for the current question.
          </li>
          <li>
            Every answer is saved to the server as you go, so refreshing the page, losing your
            connection or switching device will not lose your work. Sign in again and resume.
          </li>
          <li>
            You may change any answer as often as you like until you submit or the time ends.
          </li>
          {subjectiveCount > 0 ? (
            <li>
              Descriptive answers are reviewed by your teacher, so they will not appear in your
              result until they are graded.
            </li>
          ) : null}
        </ol>
      </Card>

      {alreadySubmitted ? (
        <Card>
          <CardHeader>
            <CardTitle>Already submitted</CardTitle>
          </CardHeader>
          <p className="text-sm text-muted-foreground">
            You have submitted this test. Your result appears on your dashboard once it is graded.
          </p>
          <Button asChild className="mt-3" variant="outline">
            <Link href="/student">Back to dashboard</Link>
          </Button>
        </Card>
      ) : isClosed ? (
        <Card>
          <CardHeader>
            <CardTitle>Closed by your teacher</CardTitle>
          </CardHeader>
          <p className="text-sm text-muted-foreground">
            This test is no longer accepting answers.
          </p>
          <Button asChild className="mt-3" variant="outline">
            <Link href="/student/tests">Back to tests</Link>
          </Button>
        </Card>
      ) : hasEnded ? (
        <Card>
          <CardHeader>
            <CardTitle>Time is up</CardTitle>
          </CardHeader>
          <p className="text-sm text-muted-foreground">
            The window for this test has closed.
          </p>
          <Button asChild className="mt-3" variant="outline">
            <Link href="/student/tests">Back to tests</Link>
          </Button>
        </Card>
      ) : (
        <DeclarationGate
          action={startTestAction}
          testId={test.id}
          isOpen={isOpen}
          isResuming={isResuming}
          scheduledAt={test.scheduled_at}
        />
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
