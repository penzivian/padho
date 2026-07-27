"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { TestCountdown } from "@/components/test-countdown";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type DeclarationGateProps = {
  action: (formData: FormData) => void | Promise<void>;
  testId: string;
  isOpen: boolean;
  isResuming: boolean;
  scheduledAt: string;
};

// The NTA-style declaration: the candidate confirms they have read the instructions before
// the paper unlocks. Before the window opens the button stays disabled and a countdown runs,
// so a student can read everything in advance instead of staring at a blank waiting screen.
export function DeclarationGate({
  action,
  testId,
  isOpen,
  isResuming,
  scheduledAt
}: DeclarationGateProps) {
  const [accepted, setAccepted] = useState(false);

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>{isResuming ? "Resume your attempt" : "Declaration"}</CardTitle>
        {!isOpen ? (
          <TestCountdown endsAt={scheduledAt} prefix="starts in " expiredText="starting now" />
        ) : null}
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
            The paper unlocks at the scheduled time. Keep this page open — you can begin the
            moment the countdown ends.
          </p>
        ) : null}

        <SubmitButton className="h-12" disabled={!accepted || !isOpen} pendingText="Opening paper">
          {isResuming ? "Resume test →" : "I am ready to begin →"}
        </SubmitButton>
      </form>
    </Card>
  );
}
