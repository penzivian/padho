"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

// Bulk path for teachers who prefer paste-and-send: one WhatsApp message per student.
export function CopyMessagesButton({ messages }: { messages: string[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(messages.join("\n\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable — the per-row buttons still work.
    }
  }

  return (
    <Button disabled={messages.length === 0} type="button" variant="outline" onClick={copy}>
      {copied ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Copied" : "Copy all messages"}
    </Button>
  );
}
