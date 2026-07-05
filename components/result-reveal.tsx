"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type ResultRevealProps = {
  snapshotId: string;
  testTitle: string;
  scorePercent: number;
  /** Change vs the previous graded test, rounded; null when this is the first result. */
  delta: number | null;
};

// Static pools — deliberately not AI-generated: zero cost, instant, and 90% as good.
const IMPROVED = [
  "That climb is yours. Keep the streak alive.",
  "Up from last time — this is what steady practice looks like.",
  "Trending the right way. One more push next test."
];
const HIGH = [
  "Top form. Consistency like this compounds.",
  "Strong paper. Hold this level and the exam takes care of itself."
];
const MID = [
  "Solid base — one focused revision pass and this jumps.",
  "You're closer than the number feels. Review the missed topics and retake."
];
const LOW = [
  "Every topper has a test like this in their story. The next one's yours.",
  "Tough paper — now you know exactly what to revise. That's an advantage."
];

function pickLine(snapshotId: string, scorePercent: number, delta: number | null) {
  const pool =
    delta !== null && delta > 0 ? IMPROVED : scorePercent >= 80 ? HIGH : scorePercent >= 50 ? MID : LOW;
  let hash = 0;
  for (const char of snapshotId) hash = (hash + char.charCodeAt(0)) % 997;
  return pool[hash % pool.length];
}

// Shows each new graded result once per browser session as a celebration moment.
// Seen-state lives in sessionStorage — deliberately no DB column for a cosmetic feature.
export function ResultReveal({ snapshotId, testTitle, scorePercent, delta }: ResultRevealProps) {
  const storageKey = `padho-seen-result-${snapshotId}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(storageKey)) setVisible(true);
    } catch {
      // Storage unavailable — skip the reveal rather than repeat it forever.
    }
  }, [storageKey]);

  if (!visible) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <div className="pop-in rounded-lg border border-primary/40 bg-secondary/50 p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Result is in · {testTitle}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <p className="font-serif text-5xl font-semibold">{scorePercent}%</p>
        {delta !== null ? (
          <span
            className={
              delta >= 0
                ? "rounded-full bg-primary px-2.5 py-0.5 text-sm font-medium text-primary-foreground"
                : "rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800"
            }
          >
            {delta >= 0 ? `+${delta}%` : `${delta}%`} vs last test
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm text-muted-foreground">
            your first result
          </span>
        )}
      </div>
      <p className="script-note mt-2 text-lg">{pickLine(snapshotId, scorePercent, delta)}</p>
      <Button className="mt-3" size="sm" variant="outline" onClick={dismiss}>
        Continue
      </Button>
    </div>
  );
}
