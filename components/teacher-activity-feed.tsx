import { ActivityFeedList } from "@/components/activity-feed-list";
import { loadActivityEvents } from "@/lib/teacher-activity";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Streamed on the teacher dashboard: loadActivityEvents aggregates three tables
// (submissions, joins, practice) and is the heaviest query on the page, so the
// rest of the card paints first and the feed fills in behind <Suspense>.
export async function TeacherActivityFeed({ limit = 5 }: { limit?: number }) {
  const supabase = createSupabaseServerClient();
  const events = await loadActivityEvents(supabase);
  return <ActivityFeedList events={events.slice(0, limit)} />;
}
