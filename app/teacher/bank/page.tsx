import Link from "next/link";
import { Library, Trash2 } from "lucide-react";

import { deleteBankQuestionAction } from "@/app/actions";
import { LibraryIngest } from "@/components/teacher/library-ingest";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { optionTexts } from "@/lib/options";
import { groupTopics } from "@/lib/question-bank";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata = { title: "My question bank" };

// A teacher's own questions, in one place.
//
// The bank has existed since the question-bank work, but the only way to reach it was the
// picker buried in the New paper screen and the only way to fill it was saving a whole paper.
// This is its home: what is in it, where each question came from, and a way to add more.
export default async function MyBankPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  await requireProfile("teacher");
  const supabase = createSupabaseServerClient();

  // `is_public = false` is the important filter, not just a tidy-up. RLS returns own-plus-
  // public, so without it the platform owner would see the 300 shared-library questions
  // listed here as if they were their personal bank — and could delete them from this screen.
  const { data } = await supabase
    .from("bank_questions")
    .select("id,question_text,question_type,topic,subject,options,correct_answer,max_marks,source_label,created_at")
    .eq("is_public", false)
    .order("created_at", { ascending: false })
    .limit(200);

  const questions = data ?? [];
  const topics = groupTopics(questions.map((question) => question.topic));

  // `source_label` is already how a teacher names a batch of questions when they save one, so
  // it doubles as "which of my banks is this from" without inventing a second concept.
  const banks = new Map<string, number>();
  for (const question of questions) {
    const label = question.source_label?.trim() || "Untitled";
    banks.set(label, (banks.get(label) ?? 0) + 1);
  }

  return (
    <main className="page-shell">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="greeting-eyebrow">Your material</p>
          <h1 className="font-serif text-3xl font-semibold">My question bank</h1>
          <p className="script-note mt-1">
            Questions you own. Private to you, and reusable in any paper you build.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/teacher/papers/new">Build a paper</Link>
        </Button>
      </header>

      {searchParams.error ? (
        <p className="rounded-md border bg-muted p-3 text-sm">{searchParams.error}</p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="stat-label">Questions</p>
          <p className="mt-1 font-serif text-3xl font-semibold">{questions.length}</p>
        </Card>
        <Card>
          <p className="stat-label">Banks</p>
          <p className="mt-1 font-serif text-3xl font-semibold">{banks.size}</p>
        </Card>
        <Card>
          <p className="stat-label">Topics</p>
          <p className="mt-1 font-serif text-3xl font-semibold">{topics.length}</p>
        </Card>
      </section>

      <LibraryIngest destination="mine" />

      {banks.size > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Library className="h-5 w-5 text-primary" aria-hidden="true" />
              Your banks
            </CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {[...banks.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1 text-sm"
                >
                  {label}
                  <span className="font-mono text-xs text-muted-foreground">{count}</span>
                </span>
              ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {questions.length > 0 ? "All your questions" : "Nothing here yet"}
          </CardTitle>
        </CardHeader>

        {questions.length === 0 ? (
          <p className="script-note">
            Upload a paper above to fill your bank, or save one you have already built from the{" "}
            <Link className="underline" href="/teacher/papers">
              Question papers
            </Link>{" "}
            screen.
          </p>
        ) : (
          <div className="grid gap-2">
            {questions.map((question) => (
              <div
                key={question.id}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="line-clamp-2">{question.question_text}</p>
                  <p className="script-note mt-1">
                    {question.subject && question.subject !== question.topic
                      ? `${question.subject} · `
                      : ""}
                    {question.topic} · {question.question_type === "mcq" ? "MCQ" : "Subjective"} ·{" "}
                    {question.correct_answer ? "keyed" : "no key"} · {Number(question.max_marks)}{" "}
                    marks
                    {question.question_type === "mcq"
                      ? ` · ${optionTexts(question.options).length} options`
                      : ""}
                  </p>
                  {question.source_label ? (
                    <span className="script-note mt-1 block">from {question.source_label}</span>
                  ) : null}
                </div>
                {/* Deleting is safe: a paper COPIES from the bank rather than referencing it,
                    so removing a question here never changes a paper already built. */}
                <form action={deleteBankQuestionAction}>
                  <input type="hidden" name="question_id" value={question.id} />
                  <SubmitButton
                    aria-label="Remove from my bank"
                    size="icon"
                    variant="ghost"
                    pendingText=""
                  >
                    <Trash2 className="h-4 w-4" />
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
