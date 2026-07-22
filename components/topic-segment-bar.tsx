import { topicSegments, type TopicStrengthLevel } from "@/lib/topic-segments";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";

// Slim multi-segment strength bar under a result title — one segment per topic,
// teal for strong, muted-teal for mid, ochre (never red) for weak. Renders
// nothing when there is no usable breakdown.
const SEGMENT_CLASS: Record<TopicStrengthLevel, string> = {
  strong: "bg-primary",
  mid: "bg-primary/50",
  weak: "bg-[#c98a3c]"
};

export function TopicSegmentBar({ value, className }: { value: Json; className?: string }) {
  const segments = topicSegments(value);
  if (segments.length === 0) return null;

  return (
    <div
      aria-label={`Topic strengths: ${segments.map((s) => `${s.topic} ${s.percent}%`).join(", ")}`}
      className={cn("bar-animate flex h-1.5 w-full gap-px overflow-hidden rounded-full", className)}
      role="img"
    >
      {segments.map((segment) => (
        <span
          key={segment.topic}
          className={cn("h-full flex-1", SEGMENT_CLASS[segment.strength])}
          title={`${segment.topic} — ${segment.percent}%`}
        />
      ))}
    </div>
  );
}
