import { type ActivityEvent, buildActivityCalendar } from "@/lib/activity";
import { getStudentPracticeEvents } from "@/lib/student-practice-events";
import { cn } from "@/lib/utils";

// Mobile-only compact week view (the page wraps it `md:hidden`). Same data as the
// desktop heatmap — buildActivityCalendar with weeks=1 yields the current Mon→Sun
// week, so no extra query. Filled teal = active day, muted = inactive, today ringed.
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export async function StudentWeekStrip({ testEvents }: { testEvents: ActivityEvent[] }) {
  const practiceEvents = await getStudentPracticeEvents();
  const { weeks } = buildActivityCalendar([...practiceEvents, ...testEvents], 1);
  const days = weeks[0];
  const activeDays = days.filter((day) => !day.isFuture && day.count > 0).length;

  return (
    <div className="section-band">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">This week</p>
        <p className="text-xs text-muted-foreground">
          {activeDays} active {activeDays === 1 ? "day" : "days"}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((day, index) => (
          <div key={day.date} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "h-8 w-full rounded-md",
                day.isFuture ? "bg-muted/50" : day.count === 0 ? "bg-muted" : "bg-primary",
                day.hasTest && "outline outline-1 outline-offset-1 outline-amber-500/80",
                day.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card"
              )}
              title={
                day.isFuture
                  ? undefined
                  : `${day.date} — ${day.count} ${day.count === 1 ? "answer" : "answers"}${day.hasTest ? " · test taken" : ""}`
              }
            />
            <span
              className={cn(
                "text-[11px] leading-none",
                day.isToday ? "font-semibold text-primary" : "text-muted-foreground"
              )}
            >
              {DAY_LABELS[index]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
