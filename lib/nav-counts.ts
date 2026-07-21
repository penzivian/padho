import { cache } from "react";

import { optionalEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Deduped per request: the Tests badge and the profile-menu AI-credits meter
// both need these counts, but `cache` collapses them into one query batch.
export const getTeacherNavCounts = cache(async (teacherId: string) => {
  const supabase = createSupabaseServerClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ count: toGrade }, { count: aiUsed }] = await Promise.all([
    supabase.from("test_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("owner_teacher_id", teacherId)
      .gte("created_at", monthStart.toISOString())
  ]);

  return {
    toGrade: toGrade ?? 0,
    aiCredits: { used: aiUsed ?? 0, limit: Number(optionalEnv("AI_MONTHLY_TEACHER_LIMIT", "200")) }
  };
});
