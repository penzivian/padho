import { Library } from "lucide-react";
import Link from "next/link";

import { LibraryIngest } from "@/components/teacher/library-ingest";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { isPlatformOwner } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { groupTopics } from "@/lib/question-bank";

// Owner-only: everything published here is visible to EVERY teacher on the platform, so the
// gate is an env allow-list rather than the teacher role.
export default async function LibraryPage() {
  const { user } = await requireProfile("teacher");

  if (!isPlatformOwner(user.email)) {
    return (
      <main className="page-shell max-w-2xl">
        <Card>
          <CardTitle>Not available</CardTitle>
          <p className="script-note mt-2">
            The shared library is managed by the platform owner. Your own question bank lives
            on the New paper screen.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/teacher/papers/new">Go to New paper</Link>
          </Button>
        </Card>
      </main>
    );
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("bank_questions")
    .select("topic,subject,source_label")
    .eq("is_public", true);

  const rows = data ?? [];
  const sources = [...new Set(rows.map((row) => row.source_label).filter(Boolean))];
  const topics = groupTopics(rows.map((row) => row.topic));

  return (
    <main className="page-shell max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Library className="h-6 w-6 text-primary" aria-hidden="true" />
            Shared library
          </h1>
          <p className="script-note mt-0.5">
            Published here, a question is available to every teacher on Padho.
          </p>
        </div>
        {/* Both owner-only screens; linked to each other because neither is in the nav. */}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/teacher/feedback">Feedback</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/teacher/papers">Question papers</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Questions
          </p>
          <p className="mt-1 font-serif text-3xl font-semibold text-primary">{rows.length}</p>
        </Card>
        <Card>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Sources
          </p>
          <p className="mt-1 font-serif text-3xl font-semibold">{sources.length}</p>
        </Card>
        <Card>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Topics
          </p>
          <p className="mt-1 font-serif text-3xl font-semibold">{topics.length}</p>
        </Card>
      </div>

      <LibraryIngest />

      {topics.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What is in the library</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <span key={topic.key} className="rounded-md bg-muted px-2 py-1 text-xs">
                {topic.label} · {topic.count}
              </span>
            ))}
          </div>
          {sources.length > 0 ? (
            <p className="script-note mt-3">Sources: {sources.join(" · ")}</p>
          ) : null}
        </Card>
      ) : null}
    </main>
  );
}
