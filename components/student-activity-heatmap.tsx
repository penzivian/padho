import { ActivityHeatmap } from "@/components/activity-heatmap";
import type { ActivityEvent } from "@/lib/activity";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Streamed on the student dashboard: the practice-attempts scan (up to 400 rows)
// is the heaviest query and feeds only this band, so it loads behind <Suspense>
// while the hero/today card paints first. Test events come from the page's main
// fetch (already needed elsewhere) and are passed in.
export async function StudentActivityHeatmap({ testEvents }: { testEvents: ActivityEvent[] }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("practice_attempts")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(400);

  const events: ActivityEvent[] = [
    ...(data ?? []).map((row) => ({ at: row.created_at as string, kind: "practice" as const })),
    ...testEvents
  ];

  return <ActivityHeatmap events={events} />;
}
