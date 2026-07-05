"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// Invite-code chip that copies itself on click.
export function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — chip stays selectable text.
    }
  }

  return (
    <button
      aria-label={`Copy invite code ${value}`}
      className="code-chip inline-flex items-center gap-1.5 transition hover:bg-secondary/70 active:scale-95"
      title="Copy invite code"
      type="button"
      onClick={copy}
    >
      {value}
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
      )}
    </button>
  );
}
