import { Sparkles } from "lucide-react";

import { getTeacherNavCounts } from "@/lib/nav-counts";

// Streamed into the profile menu popup (teachers only).
export async function ProfileCredits({ teacherId }: { teacherId: string }) {
  const { aiCredits } = await getTeacherNavCounts(teacherId);
  const left = Math.max(0, aiCredits.limit - aiCredits.used);
  const pct = Math.min(100, Math.max(0, (left / aiCredits.limit) * 100));

  return (
    <div className="mt-3 rounded-lg border bg-secondary/40 p-2.5">
      <p className="flex items-center justify-between text-xs font-medium">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          AI credits
        </span>
        <span className="font-mono text-muted-foreground">
          {left}/{aiCredits.limit}
        </span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">left this month</p>
    </div>
  );
}
