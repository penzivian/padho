"use client";

import { useEffect, useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

// Real exam halls let candidates in early to read the instructions, then unlock the paper on
// the hour. ENTRY_WINDOW_MS is the "doors open" period before the scheduled start.
export const ENTRY_WINDOW_MS = 15 * 60_000;

type DeclarationGateProps = {
  action: (formData: FormData) => void | Promise<void>;
  testId: string;
  scheduledAt: string;
  endsAt: string;
  isResuming: boolean;
};

export function DeclarationGate({
  action,
  testId,
  scheduledAt,
  endsAt,
  isResuming
}: DeclarationGateProps) {
  const [accepted, setAccepted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // The server renders this once, so without a ticking clock a student sitting on the page
  // would still see a disabled button after the start time passed. This flips it on the
  // second, with no reload — submitTestAction/startTestAction re-check server-side anyway.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startsAtMs = new Date(scheduledAt).getTime();
  const endsAtMs = new Date(endsAt).getTime();
  const isOpen = now >= startsAtMs && now <= endsAtMs;
  const msToStart = startsAtMs - now;
  const entryOpen = msToStart <= ENTRY_WINDOW_MS;

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>{isResuming ? "Resume your attempt" : "Declaration"}</CardTitle>
        {!isOpen ? <span className="font-mono text-sm">{formatCountdown(msToStart)}</span> : null}
      </CardHeader>

      <form action={action} className="grid gap-4">
        <input type="hidden" name="test_id" value={testId} />

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-primary"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>
            I have read and understood the instructions above. I will not use unfair means, and
            I understand that my answers are saved as I go and submitted when the time ends.
          </span>
        </label>

        {!isOpen ? (
          <p className="script-note">
            {entryOpen
              ? "You are in the waiting room. The paper unlocks automatically at the start time — stay on this page."
              : "Tick the declaration whenever you like. The waiting room opens 15 minutes before the start time, and the paper unlocks at the start time itself."}
          </p>
        ) : null}

        <SubmitButton className="h-12" disabled={!accepted || !isOpen} pendingText="Opening paper">
          {isResuming ? "Resume test →" : "I am ready to begin →"}
        </SubmitButton>
      </form>
    </Card>
  );
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "starting now";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `starts in ${hours}h ${pad(minutes)}m`
    : `starts in ${pad(minutes)}:${pad(seconds)}`;
}
