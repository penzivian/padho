import Link from "next/link";
import { Dumbbell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/utils";

type PracticeSetRow = {
  id: string;
  title: string;
  published_at: string;
  batches: { name: string } | null;
};

export default async function StudentPracticePage() {
  await requireProfile("student");
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("practice_sets")
    .select("id,title,published_at,batches(name)")
    .order("published_at", { ascending: false });
  const sets = (data ?? []) as unknown as PracticeSetRow[];

  return (
    <main className="page-shell max-w-3xl">
      <div>
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-semibold">Practice</h1>
        </div>
        <p className="script-note mt-0.5">Low stakes, your pace — a safe place to be wrong.</p>
      </div>

      {sets.length === 0 ? (
        <Card>
          <p className="script-note text-lg">
            No practice sets yet — ask your teacher to publish one.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sets.map((set, index) => (
            <Card key={set.id}>
              <CardHeader>
                <CardTitle>{set.title}</CardTitle>
              </CardHeader>
              <p className="mb-4 text-sm text-muted-foreground">
                {set.batches?.name ?? "Batch"} · {formatDateTime(set.published_at)}
              </p>
              <Button asChild variant={index === 0 ? "default" : "outline"}>
                <Link href={`/student/practice/${set.id}`}>Start practice</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
