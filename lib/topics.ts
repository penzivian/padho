import type { Json } from "@/types/database";

// Aggregates progress-snapshot topic_breakdown objects into the batch's weakest topics —
// the teacher's "reteach radar". Weighted by marks (earned/possible), not a mean of means.

export type TopicStrength = { topic: string; percent: number };

export function weakestTopics(breakdowns: Json[], limit = 3): TopicStrength[] {
  const totals = new Map<string, { earned: number; possible: number }>();

  for (const breakdown of breakdowns) {
    if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) continue;
    for (const [topic, raw] of Object.entries(breakdown)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const earned = typeof raw.earned === "number" ? raw.earned : null;
      const possible = typeof raw.possible === "number" ? raw.possible : null;
      if (earned === null || possible === null || possible <= 0) continue;

      const current = totals.get(topic) ?? { earned: 0, possible: 0 };
      totals.set(topic, { earned: current.earned + earned, possible: current.possible + possible });
    }
  }

  return [...totals.entries()]
    .map(([topic, value]) => ({
      topic,
      percent: Math.round((value.earned / value.possible) * 100)
    }))
    .sort((a, b) => a.percent - b.percent)
    .slice(0, limit);
}
