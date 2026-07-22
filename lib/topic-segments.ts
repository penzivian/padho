import type { Json } from "@/types/database";

// Pure mapper for the slim segmented result bar: each topic in a snapshot's
// topic_breakdown becomes one segment, classified strong / mid / weak by its
// percent. Invalid or empty breakdowns yield [] (the bar renders nothing).
export type TopicStrengthLevel = "strong" | "mid" | "weak";
export type TopicSegment = { topic: string; percent: number; strength: TopicStrengthLevel };

export function topicSegments(value: Json, strongAt = 75, weakAt = 60): TopicSegment[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  const segments: TopicSegment[] = [];
  for (const [topic, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const rawPercent = (raw as { percent?: unknown }).percent;
    if (typeof rawPercent !== "number") continue;

    const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));
    const strength: TopicStrengthLevel =
      percent >= strongAt ? "strong" : percent < weakAt ? "weak" : "mid";
    segments.push({ topic, percent, strength });
  }

  return segments;
}
