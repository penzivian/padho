import { redirect } from "next/navigation";

import { saveAnswerAction, submitTestAction } from "@/app/actions";
import { CbtShell, type CbtQuestion } from "@/components/student/cbt-shell";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import type { AttemptAnswer } from "@/lib/attempt";
import { collectOptionImagePaths, signOptions } from "@/lib/options";
import { signQuestionImages } from "@/lib/question-images";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type AttemptPageProps = {
  params: { testId: string };
};

export default async function AttemptPage({ params }: AttemptPageProps) {
  const { user } = await requireProfile("student");
  const supabase = createSupabaseServerClient();

  const { data: test } = await supabase
    .from("tests")
    .select("id,title,scheduled_at,duration_minutes,closed_at")
    .eq("id", params.testId)
    .maybeSingle();

  if (!test) {
    return (
      <main className="page-shell">
        <Card>Test not available.</Card>
      </main>
    );
  }

  const { data: submission } = await supabase
    .from("test_submissions")
    .select("id,submitted_at")
    .eq("test_id", params.testId)
    .eq("student_id", user.id)
    .maybeSingle();

  // No attempt, or the window shut — the instructions page owns every one of those states,
  // so bounce there rather than duplicating the messaging here.
  const startsAtMs = new Date(test.scheduled_at).getTime();
  const endsAtMs = startsAtMs + test.duration_minutes * 60_000;
  const now = Date.now();
  const isOpen = !test.closed_at && now >= startsAtMs && now <= endsAtMs;

  if (!submission || submission.submitted_at || !isOpen) {
    redirect(`/student/tests/${params.testId}`);
  }

  // Questions come only from the RPC, which omits correct_answer and rubric and checks the
  // test is live. Saved answers are the student's own rows, readable under RLS.
  const [{ data: questionData }, { data: answerData }] = await Promise.all([
    supabase.rpc("get_student_test_questions", { p_test_id: params.testId }),
    supabase
      .from("answers")
      .select("question_id,student_answer,marked_for_review")
      .eq("submission_id", submission.id)
  ]);

  const rawQuestions = (questionData ?? []) as CbtQuestion[];
  // Signed only now — the RPC above already enforced is_test_student + is_test_live, so this
  // is the privileged step that check earns.
  const signed = await signQuestionImages(
    [
      ...rawQuestions.map((question) => question.image_path),
      ...collectOptionImagePaths(rawQuestions.map((question) => question.options))
    ],
    "attempt"
  );
  const questions = rawQuestions.map((question) => ({
    ...question,
    image_url: question.image_path ? (signed.get(question.image_path) ?? null) : null,
    // Resolved server-side so the client never handles a raw storage path.
    options: signOptions(question.options, signed)
  }));
  const initialAnswers: AttemptAnswer[] = (answerData ?? []).map((row) => ({
    questionId: row.question_id,
    studentAnswer: row.student_answer,
    markedForReview: row.marked_for_review
  }));

  return (
    <main className="page-shell max-w-6xl">
      <CbtShell
        testId={test.id}
        title={test.title}
        scheduledAt={test.scheduled_at}
        durationMinutes={test.duration_minutes}
        questions={questions}
        initialAnswers={initialAnswers}
        saveAnswer={saveAnswerAction}
        submitTest={submitTestAction}
      />
    </main>
  );
}
