// Pure builder for the LeetCode-style activity calendar: a Monday-start grid of the
// last N weeks where a day is "active" when the student practiced or took a test.

export type ActivityEvent = { at: string; kind: "practice" | "test" };

export type ActivityDay = {
  date: string;
  count: number;
  hasTest: boolean;
  isFuture: boolean;
  isToday: boolean;
};

export type ActivityCalendar = {
  /** Columns of 7 days (Mon → Sun), oldest week first, current week last. */
  weeks: ActivityDay[][];
  activeDays: number;
  longestStreak: number;
};

export function buildActivityCalendar(
  events: ActivityEvent[],
  weeks = 12,
  now: Date = new Date()
): ActivityCalendar {
  const counts = new Map<string, number>();
  const testDays = new Set<string>();
  for (const event of events) {
    const key = new Date(event.at).toDateString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (event.kind === "test") testDays.add(key);
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Grid ends on the Sunday of the current week; trailing cells are future.
  const end = new Date(today);
  const mondayIndex = (end.getDay() + 6) % 7; // Mon=0 … Sun=6
  end.setDate(end.getDate() + (6 - mondayIndex));
  const cursor = new Date(end);
  cursor.setDate(cursor.getDate() - (weeks * 7 - 1));

  const grid: ActivityDay[][] = [];
  let activeDays = 0;
  let longestStreak = 0;
  let run = 0;

  for (let week = 0; week < weeks; week += 1) {
    const column: ActivityDay[] = [];
    for (let day = 0; day < 7; day += 1) {
      const key = cursor.toDateString();
      const isFuture = cursor.getTime() > today.getTime();
      const count = isFuture ? 0 : counts.get(key) ?? 0;

      if (count > 0) {
        activeDays += 1;
        run += 1;
        longestStreak = Math.max(longestStreak, run);
      } else if (!isFuture) {
        run = 0;
      }

      column.push({
        date: key,
        count,
        hasTest: !isFuture && testDays.has(key),
        isFuture,
        isToday: cursor.getTime() === today.getTime()
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    grid.push(column);
  }

  return { weeks: grid, activeDays, longestStreak };
}
