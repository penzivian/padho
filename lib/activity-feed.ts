// Pure helpers for the teacher's student-activity feed. Events are derived on read
// from existing tables (submissions, batch joins, practice attempts) — no new schema.

export type FeedEvent = {
  kind: "submitted" | "joined" | "practiced";
  actor: string;
  detail: string;
  count?: number;
  at: string;
};

// Practice attempts are high-volume, so collapse them to one event per student per day.
export function aggregatePractice(rows: { at: string; actor: string }[]): FeedEvent[] {
  const groups = new Map<string, { actor: string; count: number; at: string }>();

  for (const row of rows) {
    const key = `${row.actor}|${new Date(row.at).toDateString()}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { actor: row.actor, count: 1, at: row.at });
    } else {
      group.count += 1;
      if (new Date(row.at).getTime() > new Date(group.at).getTime()) group.at = row.at;
    }
  }

  return [...groups.values()].map((group) => ({
    kind: "practiced" as const,
    actor: group.actor,
    detail: "",
    count: group.count,
    at: group.at
  }));
}

export function mergeFeed(events: FeedEvent[], limit?: number): FeedEvent[] {
  const sorted = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

export function feedText(event: FeedEvent): string {
  if (event.kind === "submitted") return `${event.actor} submitted ${event.detail}`;
  if (event.kind === "joined") return `${event.actor} joined ${event.detail}`;
  const count = event.count ?? 0;
  return `${event.actor} practiced ${count} question${count === 1 ? "" : "s"}`;
}
