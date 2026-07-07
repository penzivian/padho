import { Flame } from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { buildActivityCalendar, type ActivityEvent } from "@/lib/activity";
import { calcDayStreak } from "@/lib/streak";
import { cn } from "@/lib/utils";

// LeetCode-style activity calendar: last 12 weeks of practice answers + tests taken.
// Effort made visible — deliberately ambient, never the page's primary focus.
export function ActivityHeatmap({ events }: { events: ActivityEvent[] }) {
  const calendar = buildActivityCalendar(events);
  const streak = calcDayStreak(events.map((event) => event.at));

  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle className="text-base">Your activity</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {calendar.activeDays} active {calendar.activeDays === 1 ? "day" : "days"} in 12 weeks
            {calendar.longestStreak > 1 ? ` · best ${calendar.longestStreak}-day run` : ""}
          </p>
        </div>
        {streak > 0 ? (
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm font-medium text-primary">
            <Flame className="h-4 w-4" aria-hidden="true" />
            {streak}d
          </span>
        ) : null}
      </CardHeader>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {calendar.weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((day) => (
              <span
                key={day.date}
                className={cn(
                  "h-3 w-3 rounded-[3px]",
                  day.isFuture
                    ? "bg-transparent"
                    : day.count === 0
                      ? "bg-muted"
                      : day.count <= 2
                        ? "bg-primary/30"
                        : day.count <= 5
                          ? "bg-primary/60"
                          : "bg-primary",
                  day.hasTest && "outline outline-1 outline-offset-1 outline-amber-500/80",
                  day.isToday && day.count === 0 && "bg-secondary"
                )}
                title={
                  day.isFuture
                    ? undefined
                    : `${day.date} — ${day.count} ${day.count === 1 ? "answer" : "answers"}${day.hasTest ? " · test taken" : ""}`
                }
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          less
          <span className="h-2.5 w-2.5 rounded-[3px] bg-muted" />
          <span className="h-2.5 w-2.5 rounded-[3px] bg-primary/30" />
          <span className="h-2.5 w-2.5 rounded-[3px] bg-primary/60" />
          <span className="h-2.5 w-2.5 rounded-[3px] bg-primary" />
          more
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-muted outline outline-1 outline-offset-1 outline-amber-500/80" />
          test day
        </span>
      </div>
    </Card>
  );
}
