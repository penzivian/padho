import { PaperBuilder } from "@/components/teacher/paper-builder";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type BatchOption = {
  id: string;
  name: string;
  subject: string;
  exam_target: string;
};

export default async function NewPaperPage() {
  await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("batches")
    .select("id,name,subject,exam_target")
    .order("created_at", { ascending: false });
  const batches = (data ?? []) as BatchOption[];

  return (
    <main className="page-shell">
      <div>
        <h1 className="text-2xl font-semibold">Make a paper</h1>
        <p className="script-note mt-0.5">Draft it with AI, or upload the one you already have —</p>
      </div>

      {batches.length ? (
        <PaperBuilder batches={batches} />
      ) : (
        <Card>Create a batch before creating a question paper.</Card>
      )}
    </main>
  );
}
