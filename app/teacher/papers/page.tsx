import Link from "next/link";
import { FilePlus2, Library, X } from "lucide-react";

import {
  publishPracticeAction,
  savePaperToBankAction,
  unpublishPracticeAction,
  updateAnswerKeyAction
} from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  questions: {
    id: string;
    question_type: "mcq" | "subjective";
    correct_answer: string | null;
    position: number;
  }[];
};

type PracticeSetRow = {
  id: string;
  paper_id: string;
  batch_id: string;
  batches: { name: string } | null;
};

type PapersPageProps = {
  searchParams?: { error?: string; applied?: string; banked?: string; of?: string };
};

export default async function TeacherPapersPage({ searchParams }: PapersPageProps) {
  await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const [{ data }, { data: batchData }, { data: setData }] = await Promise.all([
    supabase
      .from("question_papers")
      .select("id,title,source,created_at,batches(name),questions(id,question_type,correct_answer,position)")
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

      {searchParams?.banked ? (
        <p className="rounded-md border border-primary/30 bg-secondary/50 p-3 text-sm">
          Added {searchParams.banked} of {searchParams.of} questions to your bank
          {Number(searchParams.banked) < Number(searchParams.of ?? 0)
            ? " — the rest were already in it."
            : "."}{" "}
          Reuse them from the New paper screen.
        </p>
      ) : null}

      {searchParams?.applied ? (
        <p className="rounded-md border border-primary/30 bg-secondary/50 p-3 text-sm">
          Answer key applied to {searchParams.applied} question
          {searchParams.applied === "1" ? "" : "s"}. Marks already approved by hand were left
          untouched; everything else was re-scored.
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
                    title={`${keylessCount} MCQ${keylessCount === 1 ? "" : "s"} have no answer key — you can still schedule this paper, but you'll grade those by hand. Add keys to auto-score them.`}
                  >
                    manual grading
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

            <details className="mt-4 rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {keylessCount > 0 ? `Add answer key (${keylessCount} missing)` : "Edit answer key"}
              </summary>
              <form action={updateAnswerKeyAction} className="mt-3 grid gap-2">
                <input type="hidden" name="paper_id" value={paper.id} />
                <Textarea
                  name="answer_key"
                  rows={3}
                  required
                  placeholder="1:B, 2:C, 3:A …"
                  aria-label="Answer key"
                />
                <p className="script-note">
                  Numbered by the paper&apos;s own order — the same numbering your students see.
                  Applying a key re-scores submitted attempts, except answers you already
                  approved by hand.
                </p>
                <SubmitButton pendingText="Applying" variant="secondary">
                  Apply answer key
                </SubmitButton>
              </form>
            </details>

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
              <form action={savePaperToBankAction}>
                <input type="hidden" name="paper_id" value={paper.id} />
                <SubmitButton pendingText="Saving" variant="outline">
                  <Library className="h-4 w-4" aria-hidden="true" />
                  Save {paper.questions.length} to my bank
                </SubmitButton>
              </form>
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
