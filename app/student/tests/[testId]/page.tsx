import { Clock3 } from "lucide-react";

import { submitTestAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { TestCountdown } from "@/components/test-countdown";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/utils";
import type { Json, QuestionType } from "@/types/database";

type TestPageProps = {
  params: { testId: string };
};

type SafeQuestion = {
  id: string;
  question_text: string;
  question_type: QuestionType;
  topic: string;
  options: Json | null;
  max_marks: number;
};

export default async function StudentTestPage({ params }: TestPageProps) {
  await requireProfile("student");
  const supabase = createSupabaseServerClient();
  const [{ data: test }, { data: questions }] = await Promise.all([
    supabase
      .from("tests")
      .select("id,title,scheduled_at,duration_minutes")
      .eq("id", params.testId)
      .maybeSingle(),
    supabase.rpc("get_student_test_questions", { p_test_id: params.testId })
  ]);

  if (!test) {
    return (
      <main className="page-shell">
        <Card>Test not available.</Card>
      </main>
    );
  }

  const safeQuestions = (questions ?? []) as SafeQuestion[];
  const startsAtMs = new Date(test.scheduled_at).getTime();
  const endsAt = new Date(startsAtMs + test.duration_minutes * 60_000).toISOString();

  // The test row is visible from the moment it is scheduled, but questions are released
  // only once it opens — so a student arriving early gets a waiting room, not a blank form.
  if (Date.now() < startsAtMs) {
    return (
      <main className="page-shell max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold">{test.title}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            {formatDateTime(test.scheduled_at)} · {test.duration_minutes} min
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Not started yet</CardTitle>
            <TestCountdown
              endsAt={test.scheduled_at}
              prefix="starts in "
              expiredText="starting now"
            />
          </CardHeader>
          <p className="text-sm text-muted-foreground">
            Questions unlock when the test begins. Come back at the scheduled time.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="page-shell max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{test.title}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            {formatDateTime(test.scheduled_at)} · {test.duration_minutes} min ·{" "}
            {safeQuestions.length} questions
          </p>
        </div>
        <TestCountdown endsAt={endsAt} />
      </div>

      <form action={submitTestAction} className="grid gap-4">
        <input type="hidden" name="test_id" value={test.id} />
        {safeQuestions.map((question, index) => (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle className="text-base">Question {index + 1}</CardTitle>
              <span className="rounded-md bg-muted px-2 py-1 text-xs">{question.max_marks} marks</span>
            </CardHeader>
            <div className="grid gap-3">
              <p>{question.question_text}</p>
              {question.question_type === "mcq" ? (
                <div className="grid gap-2">
                  {jsonStringArray(question.options).map((option, optionIndex) => (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-secondary/50"
                    >
                      <input
                        className="peer sr-only"
                        name={`answer_${question.id}`}
                        type="radio"
                        value={option}
                        required
                      />
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted font-serif text-sm font-semibold peer-checked:bg-primary peer-checked:text-primary-foreground">
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                      {option}
                    </label>
                  ))}
                </div>
              ) : (
                <FormField htmlFor={`answer_${question.id}`} label="Your answer">
                  <Textarea id={`answer_${question.id}`} name={`answer_${question.id}`} required />
                </FormField>
              )}
            </div>
          </Card>
        ))}
        <SubmitButton pendingText="Submitting">Submit test</SubmitButton>
      </form>
    </main>
  );
}

function jsonStringArray(value: Json | null) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
