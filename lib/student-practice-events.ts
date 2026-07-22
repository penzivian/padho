import { cache } from "react";

import type { ActivityEvent } from "@/lib/activity";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Deduped per request: the desktop heatmap and the mobile week strip both derive
// from this ≤400-row practice scan, so `cache` collapses them into one query.
export const getStudentPracticeEvents = cache(async (): Promise<ActivityEvent[]> => {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("practice_attempts")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(400);

  return (data ?? []).map((row) => ({ at: row.created_at as string, kind: "practice" as const }));
});
