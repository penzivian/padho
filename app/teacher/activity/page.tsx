import Link from "next/link";
import { Activity } from "lucide-react";

import { ActivityFeedList } from "@/components/activity-feed-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadActivityEvents } from "@/lib/teacher-activity";

export default async function TeacherActivityPage() {
  await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const events = await loadActivityEvents(supabase);

  return (
    <main className="page-shell max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-semibold">Activity history</h1>
          </div>
          <p className="script-note mt-0.5">Everything your students have been doing —</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/teacher">Back to dashboard</Link>
        </Button>
      </div>

      <Card>
        <ActivityFeedList events={events} />
      </Card>
    </main>
  );
}
