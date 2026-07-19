"use client";

import { useRef, useState } from "react";

type OtpInputProps = {
  name: string;
  length?: number;
  defaultValue?: string;
};

/**
 * Segmented one-time-code input: one box per digit, auto-advance, backspace
 * steps back, pasting a full code fills every box. A hidden input carries the
 * joined value so the surrounding server-action form submits it unchanged.
 */
export function OtpInput({ name, length = 6, defaultValue = "" }: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(() => {
    const seed = defaultValue.replace(/\D/g, "").slice(0, length).split("");
    return Array.from({ length }, (_, i) => seed[i] ?? "");
  });
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function fillFrom(start: number, value: string) {
    const incoming = value.replace(/\D/g, "");
    setDigits((prev) => {
      const next = [...prev];
      if (!incoming) {
        next[start] = "";
        return next;
      }
      let i = start;
      for (const char of incoming) {
        if (i >= length) break;
        next[i++] = char;
      }
      return next;
    });
    if (incoming) refs.current[Math.min(start + incoming.length, length - 1)]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  return (
    <div className="flex gap-2">
      <input name={name} type="hidden" value={digits.join("")} />
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          aria-label={`Digit ${index + 1} of ${length}`}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          className="h-12 w-full min-w-0 rounded-lg border bg-card text-center font-serif text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          inputMode="numeric"
          onChange={(event) => fillFrom(index, event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => handleKeyDown(index, event)}
          value={digit}
        />
      ))}
    </div>
  );
}
