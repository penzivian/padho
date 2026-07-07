// Day-streak from activity timestamps (e.g. practice attempts). A streak is alive if
// there was activity today or yesterday; it counts consecutive active days backwards.

export function calcDayStreak(timestamps: string[], now: Date = new Date()): number {
  if (timestamps.length === 0) return 0;

  const activeDays = new Set(timestamps.map((value) => new Date(value).toDateString()));
  const cursor = new Date(now);

  // Grace: a streak isn't broken until a full day is missed.
  if (!activeDays.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (activeDays.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
