import { CheckCircle2, CircleSlash, Flag, XCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/utils";
import type { Json } from "@/types/database";

type ResponsesPageProps = {
  params: { testId: string; studentId: string };
};

type AnswerRow = {
  id: string;
  student_answer: string;
  marked_for_review: boolean;
  awarded_marks: number | null;
  teacher_feedback: string | null;
  questions: {
    position: number;
    question_text: string;
    question_type: "mcq" | "subjective";
    options: Json | null;
    correct_answer: string | null;
    max_marks: number;
    negative_marks: number;
    topic: string;
  } | null;
};

export default async function StudentResponsesPage({ params }: ResponsesPageProps) {
  await requireProfile("teacher");
  const supabase = createSupabaseServerClient();

  // Visibility gate: tests_select_visible only returns this row to the owning teacher.
  const { data: test } = await supabase
    .from("tests")
    .select("id,title")
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
  const { data: submission } = await admin
    .from("test_submissions")
    .select(
      "id,status,submitted_at,profiles(full_name,phone),answers(id,student_answer,marked_for_review,awarded_marks,teacher_feedback,questions(position,question_text,question_type,options,correct_answer,max_marks,negative_marks,topic))"
    )
    .eq("test_id", params.testId)
    .eq("student_id", params.studentId)
    .not("submitted_at", "is", null)
    .maybeSingle();

  if (!submission) {
    return (
      <main className="page-shell">
        <Card>
          <p className="text-sm text-muted-foreground">
            This student has not submitted this test.
          </p>
          <Button asChild className="mt-3" variant="outline">
            <Link href={`/teacher/tests/${params.testId}/results`}>Back to results</Link>
          </Button>
        </Card>
      </main>
    );
  }

  const student = (
    Array.isArray(submission.profiles) ? submission.profiles[0] : submission.profiles
  ) as { full_name: string; phone: string | null } | null;

  // Same order as the student saw — the paper's own position.
  const answers = ((submission.answers ?? []) as unknown as AnswerRow[])
    .slice()
    .sort((a, b) => (a.questions?.position ?? 0) - (b.questions?.position ?? 0));

  const awarded = answers.reduce((sum, answer) => sum + Number(answer.awarded_marks ?? 0), 0);
  const total = answers.reduce((sum, answer) => sum + Number(answer.questions?.max_marks ?? 0), 0);
  const attempted = answers.filter((answer) => answer.student_answer.trim()).length;

  return (
    <main className="page-shell max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{student?.full_name ?? "Student"}</h1>
          <p className="script-note mt-0.5">
            {test.title} · submitted {formatDateTime(submission.submitted_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/teacher/tests/${params.testId}/results`}>Back to results</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/teacher/tests/${params.testId}/grading`}>Grade</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Score</p>
          <p className="mt-1 font-serif text-3xl font-semibold text-primary">
            {awarded}
            <span className="text-lg text-muted-foreground"> / {total}</span>
          </p>
        </Card>
        <Card>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Attempted
          </p>
          <p className="mt-1 font-serif text-3xl font-semibold">
            {attempted}
            <span className="text-lg text-muted-foreground"> / {answers.length}</span>
          </p>
        </Card>
        <Card>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Status</p>
          <p className="mt-1 font-serif text-3xl font-semibold capitalize">
            {submission.status === "graded" ? "Graded" : "Pending"}
          </p>
        </Card>
      </div>

      <div className="grid gap-4">
        {answers.map((answer) => {
          const question = answer.questions;
          const options = Array.isArray(question?.options)
            ? question.options.filter((option): option is string => typeof option === "string")
            : [];
          const given = answer.student_answer.trim();
          const key = question?.correct_answer?.trim() ?? "";
          const isMcq = question?.question_type === "mcq";
          // Only a keyed MCQ can be called right or wrong here; a keyless one or a written
          // answer is whatever the teacher awarded.
          const correct = isMcq && key ? given.toLowerCase() === key.toLowerCase() : null;

          return (
            <Card key={answer.id}>
              <CardHeader>
                <div>
                  <CardTitle className="text-base">Question {question?.position ?? "?"}</CardTitle>
                  <p className="text-sm text-muted-foreground">{question?.topic}</p>
                </div>
                <span className="flex flex-wrap items-center justify-end gap-1.5">
                  {answer.marked_for_review ? (
                    <span className="flex items-center gap-1 rounded-md bg-violet-600/20 px-2 py-1 text-xs font-medium text-violet-900 dark:text-violet-200">
                      <Flag className="h-3 w-3" aria-hidden="true" />
                      marked
                    </span>
                  ) : null}
                  <span className="rounded-md bg-muted px-2 py-1 text-xs">
                    {answer.awarded_marks ?? "–"} / {question?.max_marks ?? 0}
                    {Number(question?.negative_marks ?? 0) > 0
                      ? ` · −${question?.negative_marks} if wrong`
                      : ""}
                  </span>
                </span>
              </CardHeader>

              <div className="grid gap-3">
                <p className="text-sm">{question?.question_text}</p>

                {isMcq ? (
                  <div className="grid gap-2">
                    {options.map((option, optionIndex) => {
                      const chosen = option === given;
                      const isKey = key && option === key;
                      return (
                        <div
                          key={option}
                          className={`flex items-center gap-3 rounded-lg border p-2.5 text-sm ${
                            isKey
                              ? "border-primary bg-secondary/50"
                              : chosen
                                ? "border-[#c98a3c] bg-[#c98a3c]/10"
                                : ""
                          }`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted font-serif text-xs font-semibold">
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <span className="flex-1">{option}</span>
                          {chosen ? (
                            <span className="text-xs text-muted-foreground">chose</span>
                          ) : null}
                          {isKey ? <span className="text-xs text-primary">key</span> : null}
                        </div>
                      );
                    })}
                    {!given ? (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CircleSlash className="h-4 w-4" aria-hidden="true" />
                        Not answered
                      </p>
                    ) : correct === true ? (
                      <p className="flex items-center gap-1.5 text-sm text-primary">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Correct
                      </p>
                    ) : correct === false ? (
                      <p className="flex items-center gap-1.5 text-sm text-[#8a5a1f] dark:text-[#e5b878]">
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Incorrect
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No answer key — marked by hand.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border p-3 text-sm">
                    {given ? (
                      <p className="whitespace-pre-wrap">{answer.student_answer}</p>
                    ) : (
                      <span className="text-muted-foreground">Not answered</span>
                    )}
                  </div>
                )}

                {answer.teacher_feedback ? (
                  <p className="rounded-md bg-muted p-3 text-sm">
                    <span className="font-medium">Your feedback: </span>
                    {answer.teacher_feedback}
                  </p>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
