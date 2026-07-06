import Link from "next/link";
import { CalendarClock, ClipboardCheck } from "lucide-react";

import { scheduleTestAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/utils";

type BatchOption = {
  id: string;
  name: string;
};

type PaperOption = {
  id: string;
  title: string;
  batch_id: string;
  batches: { name: string } | null;
};

type TestRow = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "draft" | "scheduled" | "completed";
  batches: { name: string } | null;
  test_submissions: { id: string; status: "pending" | "graded" }[];
};

type TestsPageProps = {
  searchParams?: { error?: string };
};

export default async function TeacherTestsPage({ searchParams }: TestsPageProps) {
  await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const [{ data: batchData }, { data: paperData }, { data: testData }] = await Promise.all([
    supabase.from("batches").select("id,name").order("created_at", { ascending: false }),
    supabase
      .from("question_papers")
      .select("id,title,batch_id,batches(name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("tests")
      .select("id,title,scheduled_at,duration_minutes,status,batches(name),test_submissions(id,status)")
      .order("scheduled_at", { ascending: false })
  ]);

  const batches = (batchData ?? []) as BatchOption[];
  const papers = (paperData ?? []) as unknown as PaperOption[];
  const tests = (testData ?? []) as unknown as TestRow[];

  return (
    <main className="page-shell">
      <div>
        <h1 className="text-2xl font-semibold">Tests</h1>
        <p className="script-note mt-0.5">Schedule, let students take it, then approve the grades —</p>
      </div>

      {searchParams?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Schedule test</CardTitle>
          <CalendarClock className="h-5 w-5 text-primary" />
        </CardHeader>
        <form action={scheduleTestAction} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_0.7fr_auto]">
          <FormField htmlFor="batch_id" label="Batch">
            <Select id="batch_id" name="batch_id" required>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField htmlFor="question_paper_id" label="Paper">
            <Select id="question_paper_id" name="question_paper_id" required>
              {papers.map((paper) => (
                <option key={paper.id} value={paper.id}>
                  {paper.title} · {paper.batches?.name ?? "Batch"}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField htmlFor="title" label="Title">
            <Input id="title" name="title" required />
          </FormField>
          <FormField htmlFor="duration_minutes" label="Minutes">
            <Input id="duration_minutes" name="duration_minutes" type="number" min="1" defaultValue="60" />
          </FormField>
          <div className="grid gap-2 lg:col-span-4">
            <FormField htmlFor="scheduled_at" label="Schedule">
              <Input id="scheduled_at" name="scheduled_at" type="datetime-local" required />
            </FormField>
          </div>
          <div className="flex items-end">
            <SubmitButton pendingText="Scheduling">Schedule</SubmitButton>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {tests.map((test) => {
          const pending = test.test_submissions.filter((submission) => submission.status === "pending").length;

          return (
            <Card key={test.id}>
              <CardHeader>
                <div>
                  <CardTitle>{test.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{test.batches?.name ?? "-"}</p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {test.status}
                </span>
              </CardHeader>
              <dl className="mb-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Starts</dt>
                  <dd>{formatDateTime(test.scheduled_at)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd>{test.duration_minutes} min</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Needs review</dt>
                  <dd>
                    {pending > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {pending}
                      </span>
                    ) : (
                      "0"
                    )}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/teacher/tests/${test.id}/grading`}>
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                    Grade
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/teacher/tests/${test.id}/results`}>Results</Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
