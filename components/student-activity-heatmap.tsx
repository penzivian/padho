import { ActivityHeatmap } from "@/components/activity-heatmap";
import type { ActivityEvent } from "@/lib/activity";
import { getStudentPracticeEvents } from "@/lib/student-practice-events";

// Desktop-only full 12-week heatmap (the page wraps it `hidden md:block`). Test
// events come from the page's main fetch; practice events from the cached scan
// shared with the mobile week strip.
export async function StudentActivityHeatmap({ testEvents }: { testEvents: ActivityEvent[] }) {
  const practiceEvents = await getStudentPracticeEvents();
  return <ActivityHeatmap events={[...practiceEvents, ...testEvents]} />;
}
