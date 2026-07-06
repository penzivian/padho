import { PracticeSession } from "@/components/practice-session";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Json, QuestionType } from "@/types/database";

type PracticeSessionPageProps = {
  params: { setId: string };
};

type SafeQuestion = {
  id: string;
  question_text: string;
  question_type: QuestionType;
  topic: string;
  options: Json | null;
  max_marks: number;
};

export default async function PracticeSessionPage({ params }: PracticeSessionPageProps) {
  await requireProfile("student");
  const supabase = createSupabaseServerClient();
  const [{ data: set }, { data: questions }] = await Promise.all([
    supabase.from("practice_sets").select("id,title").eq("id", params.setId).maybeSingle(),
    // Answer-key-safe RPC: never returns correct_answer or rubric.
    supabase.rpc("get_student_practice_questions", { p_set_id: params.setId })
  ]);

  if (!set) {
    return (
      <main className="page-shell max-w-2xl">
        <Card>Practice set not available.</Card>
      </main>
    );
  }

  return (
    <main className="page-shell max-w-2xl">
      <PracticeSession
        setId={set.id}
        title={set.title}
        questions={(questions ?? []) as SafeQuestion[]}
      />
    </main>
  );
}
