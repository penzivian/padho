import Link from "next/link";
import { FilePlus2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { findKeylessMcqs } from "@/lib/grading";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/utils";

type PaperRow = {
  id: string;
  title: string;
  source: "uploaded" | "ai_generated";
  created_at: string;
  batches: { name: string } | null;
  questions: { id: string; question_type: "mcq" | "subjective"; correct_answer: string | null }[];
};

export default async function TeacherPapersPage() {
  await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("question_papers")
    .select("id,title,source,created_at,batches(name),questions(id,question_type,correct_answer)")
    .order("created_at", { ascending: false });
  const papers = (data ?? []) as unknown as PaperRow[];

  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Question papers</h1>
          <p className="script-note mt-0.5">Draft with AI or upload your own — then schedule a test.</p>
        </div>
        <Button asChild>
          <Link href="/teacher/papers/new">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            New paper
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {papers.map((paper) => {
          const keylessCount = findKeylessMcqs(
            paper.questions.map((question) => ({
              type: question.question_type,
              correctAnswer: question.correct_answer
            }))
          ).length;

          return (
          <Card key={paper.id}>
            <CardHeader>
              <CardTitle>{paper.title}</CardTitle>
              <span className="flex flex-wrap justify-end gap-1.5">
                {keylessCount > 0 ? (
                  <span
                    className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"
                    title={`${keylessCount} MCQ${keylessCount === 1 ? "" : "s"} missing an answer key — add keys before scheduling`}
                  >
                    needs answer key
                  </span>
                ) : null}
                <span className="rounded-md bg-secondary px-2 py-1 text-xs">{paper.source}</span>
              </span>
            </CardHeader>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Batch</dt>
                <dd>{paper.batches?.name ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Questions</dt>
                <dd>{paper.questions.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDateTime(paper.created_at)}</dd>
              </div>
            </dl>
          </Card>
          );
        })}
      </div>
    </main>
  );
}
