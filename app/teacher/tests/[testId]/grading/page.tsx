import { Bot, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";

import { approveGradesAction, requestGradeSuggestionsAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { requireProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type GradingPageProps = {
  params: { testId: string };
};

type SubmissionRow = {
  id: string;
  status: "pending" | "graded";
  profiles: { full_name: string; phone: string | null } | null;
  answers: {
    id: string;
    student_answer: string;
    ai_suggested_marks: number | null;
    awarded_marks: number | null;
    ai_feedback: string | null;
    teacher_feedback: string | null;
    questions: {
      question_text: string;
      question_type: "mcq" | "subjective";
      max_marks: number;
      rubric: string | null;
      correct_answer: string | null;
    } | null;
  }[];
};

export default async function GradingPage({ params }: GradingPageProps) {
  await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: visibleTest } = await supabase
    .from("tests")
    .select("id,title")
    .eq("id", params.testId)
    .maybeSingle();

  if (!visibleTest) {
    return (
      <main className="page-shell">
        <Card>Test not available.</Card>
      </main>
    );
  }

  const { data } = await admin
    .from("test_submissions")
    .select(
      "id,status,profiles(full_name,phone),answers(id,student_answer,ai_suggested_marks,awarded_marks,ai_feedback,teacher_feedback,questions(question_text,question_type,max_marks,rubric,correct_answer))"
    )
    .eq("test_id", params.testId)
    .order("submitted_at", { ascending: false });

  const submissions = (data ?? []) as unknown as SubmissionRow[];
  const gradedCount = submissions.filter((submission) => submission.status === "graded").length;
  const reviewCount = submissions.length - gradedCount;

  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Grading · {visibleTest.title}</h1>
          <p className="script-note mt-0.5">Approve → student&apos;s progress updates</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/teacher/tests/${params.testId}/results`}>Results &amp; ranks</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/teacher/tests">Back to tests</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-primary/30">
          <p className="font-serif text-3xl font-semibold text-primary">{gradedCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">graded ✓</p>
        </Card>
        <Card className="border-amber-600/30">
          <p className="font-serif text-3xl font-semibold text-amber-700">{reviewCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">to review</p>
        </Card>
      </div>

      <div className="grid gap-4">
        {submissions.map((submission) => (
          <Card key={submission.id}>
            <CardHeader>
              <div>
                <CardTitle>{submission.profiles?.full_name ?? "Student"}</CardTitle>
                <p className="text-sm text-muted-foreground">{submission.profiles?.phone ?? "—"}</p>
              </div>
              <span
                className={
                  submission.status === "graded"
                    ? "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                    : "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                }
              >
                {submission.status === "graded" ? "graded" : "needs review"}
              </span>
            </CardHeader>

            <form action={requestGradeSuggestionsAction} className="mb-3">
              <input type="hidden" name="submission_id" value={submission.id} />
              <SubmitButton pendingText="Asking AI" variant="secondary">
                <Bot className="h-4 w-4" aria-hidden="true" />
                Suggest marks
              </SubmitButton>
            </form>

            <form action={approveGradesAction} className="grid gap-4">
              <input type="hidden" name="submission_id" value={submission.id} />
              {submission.answers.map((answer, index) => {
                const question = answer.questions;
                const defaultMark = answer.awarded_marks ?? answer.ai_suggested_marks ?? 0;
                // A keyless MCQ could not be auto-scored — it is here for the teacher to mark.
                const keylessMcq =
                  question?.question_type === "mcq" && !question.correct_answer?.trim();

                return (
                  <div key={answer.id} className="rounded-lg border p-3">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">Question {index + 1}</p>
                        <p className="text-sm capitalize text-muted-foreground">
                          {question?.question_type ?? "question"}
                        </p>
                      </div>
                      <span className="flex flex-wrap justify-end gap-1.5">
                        {keylessMcq ? (
                          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                            no answer key · mark by hand
                          </span>
                        ) : null}
                        <span className="rounded-md bg-muted px-2 py-1 text-xs">
                          {question?.max_marks ?? 0} marks
                        </span>
                      </span>
                    </div>
                    <div className="grid gap-3">
                      <p className="text-sm">{question?.question_text}</p>
                      {question?.rubric ? (
                        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{question.rubric}</p>
                      ) : null}
                      <p className="rounded-md border p-3 text-sm">{answer.student_answer || "-"}</p>

                      {answer.ai_suggested_marks !== null || answer.ai_feedback ? (
                        <div className="rounded-lg border border-primary/30 bg-secondary/50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                              <Sparkles className="h-4 w-4" aria-hidden="true" />
                              AI suggestion · not final
                            </p>
                            {answer.ai_suggested_marks !== null ? (
                              <p className="font-serif text-lg font-semibold">
                                {answer.ai_suggested_marks}
                                <span className="text-sm text-muted-foreground"> / {question?.max_marks ?? 0}</span>
                              </p>
                            ) : null}
                          </div>
                          {answer.ai_feedback ? (
                            <p className="mt-1.5 text-sm">{answer.ai_feedback}</p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-[0.4fr_1fr]">
                        <FormField htmlFor={`mark_${answer.id}`} label="Marks">
                          <Input
                            id={`mark_${answer.id}`}
                            name={`mark_${answer.id}`}
                            type="number"
                            min="0"
                            max={question?.max_marks ?? undefined}
                            step="0.5"
                            defaultValue={defaultMark}
                          />
                        </FormField>
                        <FormField htmlFor={`feedback_${answer.id}`} label="Feedback">
                          <Input
                            id={`feedback_${answer.id}`}
                            name={`feedback_${answer.id}`}
                            defaultValue={answer.teacher_feedback ?? ""}
                          />
                        </FormField>
                      </div>
                    </div>
                  </div>
                );
              })}
              <SubmitButton pendingText="Approving">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Approve marks
              </SubmitButton>
            </form>
          </Card>
        ))}

        {submissions.length === 0 ? <Card>No submissions yet.</Card> : null}
      </div>
    </main>
  );
}
