import { CheckCircle2, CircleSlash, Clock3, Flag, XCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { signQuestionImages } from "@/lib/question-images";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Json } from "@/types/database";

type ResponsesPageProps = {
  params: { testId: string };
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
    image_path: string | null;
  } | null;
};

export default async function StudentResponsesPage({ params }: ResponsesPageProps) {
  const { user } = await requireProfile("student");
  const supabase = createSupabaseServerClient();

  // Visibility gate on the RLS-respecting client: the student must be able to see the test
  // at all (tests_select_visible → their own batch).
  const { data: test } = await supabase
    .from("tests")
    .select("id,title,scheduled_at,duration_minutes,closed_at")
    .eq("id", params.testId)
    .maybeSingle();

  if (!test) {
    return (
      <main className="page-shell max-w-2xl">
        <Card>Test not available.</Card>
      </main>
    );
  }

  const { data: submission } = await supabase
    .from("test_submissions")
    .select("id,status,submitted_at")
    .eq("test_id", params.testId)
    .eq("student_id", user.id)
    .maybeSingle();

  const endsAtMs = new Date(test.scheduled_at).getTime() + test.duration_minutes * 60_000;
  const testIsOver = Boolean(test.closed_at) || Date.now() > endsAtMs;

  if (!submission?.submitted_at) {
    return (
      <main className="page-shell max-w-2xl">
        <Card>
          <CardTitle>Nothing to review</CardTitle>
          <p className="script-note mt-2">You did not submit this test.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/student/tests">Back to tests</Link>
          </Button>
        </Card>
      </main>
    );
  }

  // A student who finishes early must not be handed the answer key while classmates are
  // still writing — that is a leak. Review unlocks only once the test is over for everyone.
  if (!testIsOver) {
    return (
      <main className="page-shell max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Answers unlock when the test ends</CardTitle>
            <Clock3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <p className="script-note mt-2">
            Your paper is submitted. You can go through your answers once the test window
            closes for everyone.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/student/tests">Back to tests</Link>
          </Button>
        </Card>
      </main>
    );
  }

  // Students cannot SELECT questions (teacher-only policy), so the paper is read with admin
  // only after the two gates above. Rubrics and AI-suggested marks are deliberately not
  // selected — a rubric is the teacher's marking guide and an AI mark is not final.
  const admin = createSupabaseAdminClient();
  const { data: answerData } = await admin
    .from("answers")
    .select(
      "id,student_answer,marked_for_review,awarded_marks,teacher_feedback,questions(position,question_text,question_type,options,correct_answer,max_marks,negative_marks,topic,image_path)"
    )
    .eq("submission_id", submission.id);

  const answers = ((answerData ?? []) as unknown as AnswerRow[])
    .slice()
    .sort((a, b) => (a.questions?.position ?? 0) - (b.questions?.position ?? 0));

  const awarded = answers.reduce((sum, answer) => sum + Number(answer.awarded_marks ?? 0), 0);
  const total = answers.reduce((sum, answer) => sum + Number(answer.questions?.max_marks ?? 0), 0);
  const correctCount = answers.filter((answer) => {
    const key = answer.questions?.correct_answer?.trim();
    return (
      answer.questions?.question_type === "mcq" &&
      key &&
      answer.student_answer.trim().toLowerCase() === key.toLowerCase()
    );
  }).length;
  const awaitingTeacher = answers.some((answer) => answer.awarded_marks === null);
  // Signed only after both gates above (own submitted attempt + test over).
  const signedImages = await signQuestionImages(
    answers.map((answer) => answer.questions?.image_path)
  );

  return (
    <main className="page-shell max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Your answers</h1>
          <p className="script-note mt-0.5">{test.title}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/student/results/${params.testId}`}>Result &amp; rank</Link>
        </Button>
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
            Correct
          </p>
          <p className="mt-1 font-serif text-3xl font-semibold">
            {correctCount}
            <span className="text-lg text-muted-foreground"> / {answers.length}</span>
          </p>
        </Card>
        <Card>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Status
          </p>
          <p className="mt-1 font-serif text-3xl font-semibold">
            {submission.status === "graded" ? "Graded" : "Pending"}
          </p>
        </Card>
      </div>

      {awaitingTeacher ? (
        <p className="rounded-md border border-primary/30 bg-secondary/50 p-3 text-sm">
          Some answers are still with your teacher. Those marks appear once they are approved.
        </p>
      ) : null}

      <div className="grid gap-4">
        {answers.map((answer) => {
          const question = answer.questions;
          const options = Array.isArray(question?.options)
            ? question.options.filter((option): option is string => typeof option === "string")
            : [];
          const given = answer.student_answer.trim();
          const key = question?.correct_answer?.trim() ?? "";
          const isMcq = question?.question_type === "mcq";
          const correct = isMcq && key ? given.toLowerCase() === key.toLowerCase() : null;
          const imageUrl = question?.image_path ? signedImages.get(question.image_path) : null;

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
                      you marked this
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

                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
                  <img
                    src={imageUrl}
                    alt={`Diagram for question ${question?.position ?? ""}`}
                    className="max-h-80 w-auto max-w-full rounded-lg border bg-white object-contain"
                  />
                ) : null}


                {isMcq ? (
                  <div className="grid gap-2">
                    {options.map((option, optionIndex) => {
                      const chosen = option === given;
                      const isKey = Boolean(key) && option === key;
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
                            <span className="text-xs text-muted-foreground">your answer</span>
                          ) : null}
                          {isKey ? <span className="text-xs text-primary">correct</span> : null}
                        </div>
                      );
                    })}
                    {!given ? (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CircleSlash className="h-4 w-4" aria-hidden="true" />
                        You did not answer this one.
                      </p>
                    ) : correct === true ? (
                      <p className="flex items-center gap-1.5 text-sm text-primary">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Correct
                      </p>
                    ) : correct === false ? (
                      <p className="flex items-center gap-1.5 text-sm text-[#8a5a1f] dark:text-[#e5b878]">
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Not this one — the correct option is highlighted above.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Your teacher marks this one by hand.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border p-3 text-sm">
                    {given ? (
                      <p className="whitespace-pre-wrap">{answer.student_answer}</p>
                    ) : (
                      <span className="text-muted-foreground">You did not answer this one.</span>
                    )}
                  </div>
                )}

                {answer.teacher_feedback ? (
                  <p className="rounded-md bg-muted p-3 text-sm">
                    <span className="font-medium">Teacher&apos;s note: </span>
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
