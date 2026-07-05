"use client";

import { useEffect, useState } from "react";

// Live countdown chip for a scheduled test window. Display-only — submission
// timing is still enforced server-side in submitTestAction.
export function TestCountdown({ endsAt }: { endsAt: string }) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemainingMs(Math.max(0, new Date(endsAt).getTime() - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (remainingMs === null) return <span className="code-chip">--:--</span>;

  if (remainingMs === 0) {
    return <span className="code-chip bg-destructive/10 text-destructive">Time up</span>;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <span className="code-chip">
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
