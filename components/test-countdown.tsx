"use client";

import { useEffect, useState } from "react";

// Live countdown chip toward a deadline. Display-only — timing rules are always
// enforced server-side. `prefix` and `expiredText` let it double as a
// "starts in …" chip for upcoming tests.
export function TestCountdown({
  endsAt,
  prefix = "",
  expiredText = "Time up"
}: {
  endsAt: string;
  prefix?: string;
  expiredText?: string;
}) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemainingMs(Math.max(0, new Date(endsAt).getTime() - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (remainingMs === null) return <span className="code-chip">--:--</span>;

  if (remainingMs === 0) {
    return (
      <span className={expiredText === "Time up" ? "code-chip bg-destructive/10 text-destructive" : "code-chip"}>
        {expiredText}
      </span>
    );
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const display =
    hours > 0 ? `${hours}h ${minutes}m` : `${minutes}:${String(seconds).padStart(2, "0")}`;

  return (
    <span className="code-chip">
      {prefix}
      {display}
    </span>
  );
}
