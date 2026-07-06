import Link from "next/link";
import { FilePlus2, X } from "lucide-react";

import { publishPracticeAction, unpublishPracticeAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
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

type PracticeSetRow = {
  id: string;
  paper_id: string;
  batch_id: string;
  batches: { name: string } | null;
};

type PapersPageProps = {
  searchParams?: { error?: string };
};

export default async function TeacherPapersPage({ searchParams }: PapersPageProps) {
  await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const [{ data }, { data: batchData }, { data: setData }] = await Promise.all([
    supabase
      .from("question_papers")
      .select("id,title,source,created_at,batches(name),questions(id,question_type,correct_answer)")
      .order("created_at", { ascending: false }),
    supabase.from("batches").select("id,name").order("created_at", { ascending: false }),
    supabase.from("practice_sets").select("id,paper_id,batch_id,batches(name)")
  ]);
  const papers = (data ?? []) as unknown as PaperRow[];
  const batches = (batchData ?? []) as { id: string; name: string }[];
  const practiceSets = (setData ?? []) as unknown as PracticeSetRow[];

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

      {searchParams?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}

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

            <div className="mt-4 grid gap-2 border-t pt-3">
              {practiceSets
                .filter((set) => set.paper_id === paper.id)
                .map((set) => (
                  <div key={set.id} className="flex items-center justify-between gap-2">
                    <span className="script-note">practice · {set.batches?.name ?? "batch"}</span>
                    <form action={unpublishPracticeAction}>
                      <input type="hidden" name="set_id" value={set.id} />
                      <SubmitButton aria-label="Unpublish practice set" size="icon" variant="ghost" pendingText="">
                        <X className="h-4 w-4" />
                      </SubmitButton>
                    </form>
                  </div>
                ))}
              {batches.length > 0 ? (
                <form action={publishPracticeAction} className="flex items-end gap-2">
                  <input type="hidden" name="paper_id" value={paper.id} />
                  <Select className="flex-1" name="batch_id" required>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton pendingText="Publishing" variant="secondary">
                    Publish as practice
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
