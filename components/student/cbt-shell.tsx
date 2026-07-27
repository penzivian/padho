"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, Flag, LayoutGrid, Loader2, X } from "lucide-react";

import type { SaveAnswerResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  questionState,
  remainingMs,
  summarizeAttempt,
  type AttemptAnswer,
  type QuestionState
} from "@/lib/attempt";
import type { Json } from "@/types/database";

export type CbtQuestion = {
  id: string;
  question_text: string;
  question_type: "mcq" | "subjective";
  topic: string;
  options: Json | null;
  max_marks: number;
};

type CbtShellProps = {
  testId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  questions: CbtQuestion[];
  initialAnswers: AttemptAnswer[];
  saveAnswer: (formData: FormData) => Promise<SaveAnswerResult>;
  submitTest: (formData: FormData) => void | Promise<void>;
};

// Calm Ledger equivalents of the NTA palette. NTA uses red for "not answered"; this product
// never shows students red, so ochre carries that weight instead.
const STATE_STYLES: Record<QuestionState, string> = {
  answered: "bg-primary text-primary-foreground border-primary",
  answered_marked: "bg-violet-600 text-white border-violet-600",
  marked: "bg-violet-600/25 text-violet-900 border-violet-600/50 dark:text-violet-200",
  visited: "bg-[#c98a3c]/25 text-[#8a5a1f] border-[#c98a3c]/60 dark:text-[#e5b878]",
  not_visited: "bg-muted text-muted-foreground border-border"
};

export function CbtShell({
  testId,
  title,
  scheduledAt,
  durationMinutes,
  questions,
  initialAnswers,
  saveAnswer,
  submitTest
}: CbtShellProps) {
  const [answers, setAnswers] = useState<Map<string, AttemptAnswer>>(
    () => new Map(initialAnswers.map((answer) => [answer.questionId, answer]))
  );
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msLeft, setMsLeft] = useState(() => remainingMs(scheduledAt, durationMinutes));
  const [isSaving, startSaving] = useTransition();

  const submitRef = useRef<HTMLFormElement>(null);
  const autoSubmitted = useRef(false);
  const current = questions[index];
  const questionIds = useMemo(() => questions.map((question) => question.id), [questions]);
  const summary = useMemo(() => summarizeAttempt(questionIds, answers), [questionIds, answers]);

  // Load the saved answer whenever the visible question changes, so navigating away and back
  // shows what was actually recorded rather than a stale draft.
  useEffect(() => {
    setDraft(answers.get(current?.id ?? "")?.studentAnswer ?? "");
    setSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.id]);

  const persist = useCallback(
    (questionId: string, studentAnswer: string, markedForReview: boolean) => {
      setAnswers((previous) => {
        const next = new Map(previous);
        next.set(questionId, { questionId, studentAnswer, markedForReview });
        return next;
      });

      const formData = new FormData();
      formData.set("test_id", testId);
      formData.set("question_id", questionId);
      formData.set("student_answer", studentAnswer);
      formData.set("marked_for_review", String(markedForReview));

      startSaving(async () => {
        const result = await saveAnswer(formData);
        setSaveError(result.ok ? null : (result.message ?? "Could not save that answer."));
      });
    },
    [saveAnswer, testId]
  );

  // Visiting a question records it, which is what turns the palette tile from "not visited"
  // to "not answered" — the same signal NTA gives.
  useEffect(() => {
    if (!current || answers.has(current.id)) return;
    persist(current.id, "", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // The client clock only drives the display and the auto-submit nudge; submitTestAction
  // re-derives the window server-side, so a tampered clock changes nothing.
  useEffect(() => {
    const timer = setInterval(() => {
      const left = remainingMs(scheduledAt, durationMinutes);
      setMsLeft(left);
      if (left <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        submitRef.current?.requestSubmit();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [scheduledAt, durationMinutes]);

  if (!current) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">This paper has no questions.</p>
      </Card>
    );
  }

  const options = Array.isArray(current.options)
    ? current.options.filter((option): option is string => typeof option === "string")
    : [];
  const marked = answers.get(current.id)?.markedForReview ?? false;
  const lastQuestion = index === questions.length - 1;
  const minutesLeft = Math.floor(msLeft / 60_000);
  const secondsLeft = Math.floor((msLeft % 60_000) / 1000);
  const urgent = msLeft <= 5 * 60_000;

  const saveCurrent = (markedForReview: boolean) => {
    persist(current.id, draft, markedForReview);
  };

  const goTo = (nextIndex: number) => {
    setIndex(Math.min(Math.max(nextIndex, 0), questions.length - 1));
    setPaletteOpen(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      {/* Header: title + authoritative-looking clock, matching the CBT convention. */}
      <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Question {index + 1} of {questions.length} · {current.max_marks} marks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`rounded-lg border px-3 py-1.5 font-mono text-lg tabular-nums ${
              urgent ? "border-[#c98a3c] bg-[#c98a3c]/15 text-[#8a5a1f] dark:text-[#e5b878]" : ""
            }`}
            role="timer"
            aria-live="off"
          >
            {String(minutesLeft).padStart(2, "0")}:{String(secondsLeft).padStart(2, "0")}
          </div>
          <Button
            className="lg:hidden"
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setPaletteOpen((open) => !open)}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            Palette
          </Button>
        </div>
      </div>

      {urgent ? (
        <p className="lg:col-span-2 flex items-center gap-2 rounded-md border border-[#c98a3c]/50 bg-[#c98a3c]/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Under five minutes left. The test submits automatically when the clock reaches zero.
        </p>
      ) : null}

      {/* Question pane */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Question {index + 1}</CardTitle>
          <span className="flex items-center gap-2">
            {isSaving ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                saving
              </span>
            ) : null}
            <span className="rounded-md bg-muted px-2 py-1 text-xs">{current.topic}</span>
          </span>
        </CardHeader>

        <div className="grid gap-4">
          <p className="whitespace-pre-wrap">{current.question_text}</p>

          {current.question_type === "mcq" ? (
            <div className="grid gap-2">
              {options.map((option, optionIndex) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-secondary/50"
                >
                  <input
                    className="peer sr-only"
                    type="radio"
                    name={`question_${current.id}`}
                    value={option}
                    checked={draft === option}
                    onChange={() => setDraft(option)}
                  />
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted font-serif text-sm font-semibold peer-checked:bg-primary peer-checked:text-primary-foreground">
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  {option}
                </label>
              ))}
            </div>
          ) : (
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={8}
              aria-label="Your answer"
            />
          )}

          {saveError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {saveError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                saveCurrent(marked);
                if (!lastQuestion) goTo(index + 1);
              }}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {lastQuestion ? "Save" : "Save & Next"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                saveCurrent(true);
                if (!lastQuestion) goTo(index + 1);
              }}
            >
              <Flag className="h-4 w-4" aria-hidden="true" />
              Save &amp; Mark for Review
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft("");
                persist(current.id, "", marked);
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Clear Response
            </Button>
          </div>

          <div className="flex justify-between gap-2 border-t pt-3">
            <Button type="button" variant="outline" disabled={index === 0} onClick={() => goTo(index - 1)}>
              ← Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={lastQuestion}
              onClick={() => goTo(index + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      </Card>

      {/* Palette */}
      <div className={`${paletteOpen ? "block" : "hidden"} lg:block`}>
        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="text-base">Question palette</CardTitle>
          </CardHeader>

          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
            {questions.map((question, questionIndex) => {
              const state = questionState(answers.get(question.id));
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => goTo(questionIndex)}
                  aria-label={`Question ${questionIndex + 1}, ${state.replace("_", " ")}`}
                  aria-current={questionIndex === index}
                  className={`flex h-9 w-full items-center justify-center rounded-md border text-sm font-medium transition ${
                    STATE_STYLES[state]
                  } ${questionIndex === index ? "ring-2 ring-foreground/60 ring-offset-1 ring-offset-background" : ""}`}
                >
                  {questionIndex + 1}
                </button>
              );
            })}
          </div>

          <dl className="mt-4 grid gap-1.5 text-xs">
            <LegendRow state="answered" label="Answered" count={summary.answered} />
            <LegendRow state="visited" label="Not answered" count={summary.notAnswered} />
            <LegendRow state="marked" label="Marked for review" count={summary.markedForReview} />
            <LegendRow state="not_visited" label="Not visited" count={summary.notVisited} />
          </dl>

          <Button
            type="button"
            className="mt-4 w-full"
            variant="secondary"
            onClick={() => {
              saveCurrent(marked);
              setConfirming(true);
            }}
          >
            Submit test
          </Button>
        </Card>
      </div>

      {/* Submit confirmation — the CBT summary screen before the point of no return. */}
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Submit this test?</CardTitle>
            </CardHeader>
            <dl className="grid gap-2 text-sm">
              <SummaryRow label="Total questions" value={summary.total} />
              <SummaryRow label="Answered" value={summary.answered} />
              <SummaryRow label="Not answered" value={summary.notAnswered} />
              <SummaryRow label="Marked for review" value={summary.markedForReview} />
              <SummaryRow label="Not visited" value={summary.notVisited} />
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">
              You cannot change your answers after submitting.
            </p>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                Keep working
              </Button>
              <Button type="button" onClick={() => submitRef.current?.requestSubmit()}>
                Submit now
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <form ref={submitRef} action={submitTest} className="hidden">
        <input type="hidden" name="test_id" value={testId} />
      </form>
    </div>
  );
}

function LegendRow({
  state,
  label,
  count
}: {
  state: QuestionState;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3.5 w-3.5 shrink-0 rounded border ${STATE_STYLES[state]}`} />
      <dt className="flex-1 text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{count}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
