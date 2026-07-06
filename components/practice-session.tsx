"use client";

import { Check, Flame } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  checkPracticeAnswerAction,
  selfMarkPracticeAction,
  type PracticeCheckResult
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Json, QuestionType } from "@/types/database";

type SafeQuestion = {
  id: string;
  question_text: string;
  question_type: QuestionType;
  topic: string;
  options: Json | null;
  max_marks: number;
};

// Static feedback pools — tone matches the Namaskar greeting language; no AI calls.
const CORRECT_LINES = ["Shabash!", "Clean.", "That's the way."];
const WRONG_LINES = ["Close — look again.", "This one's a common trap.", "Almost — the details matter."];
const END_LINES = [
  "Practice like this is how ranks move.",
  "Showing up is the hard part — done.",
  "Every question you miss here is one you won't miss in the test."
];

export function PracticeSession({
  setId,
  title,
  questions
}: {
  setId: string;
  title: string;
  questions: SafeQuestion[];
}) {
  const [order, setOrder] = useState(() => questions.map((_, index) => index));
  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [written, setWritten] = useState("");
  const [result, setResult] = useState<PracticeCheckResult | null>(null);
  const [selfMarked, setSelfMarked] = useState(false);
  const [attempted, setAttempted] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const total = questions.length;
  const question = questions[order[position]];
  const revealed = result !== null;
  const isMcq = question?.question_type === "mcq";
  const options = isMcq ? jsonStringArray(question.options) : [];
  const answerValue = isMcq ? selected ?? "" : written;

  function registerOutcome(correct: boolean) {
    setAttempted((count) => count + 1);
    if (correct) {
      setCorrectCount((count) => count + 1);
      setStreak((current) => {
        const next = current + 1;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
    } else {
      setStreak(0);
    }
  }

  function check() {
    if (!question || !answerValue.trim()) return;
    setError("");
    startTransition(async () => {
      const response = await checkPracticeAnswerAction({
        setId,
        questionId: question.id,
        answer: answerValue
      });
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setResult(response);
      if (response.kind === "mcq") registerOutcome(response.correct === true);
      else setAttempted((count) => count + 1); // subjective counts via self-mark below
    });
  }

  function selfMark(gotIt: boolean) {
    if (!result?.attemptId || selfMarked) return;
    setSelfMarked(true);
    if (gotIt) {
      setCorrectCount((count) => count + 1);
      setStreak((current) => {
        const next = current + 1;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
    } else {
      setStreak(0);
    }
    const attemptId = result.attemptId;
    startTransition(async () => {
      await selfMarkPracticeAction({ attemptId, gotIt });
    });
  }

  function next() {
    if (position + 1 >= total) {
      setDone(true);
      return;
    }
    setPosition((current) => current + 1);
    setSelected(null);
    setWritten("");
    setResult(null);
    setSelfMarked(false);
    setError("");
  }

  function practiceAgain() {
    setOrder((current) => shuffle(current));
    setPosition(0);
    setSelected(null);
    setWritten("");
    setResult(null);
    setSelfMarked(false);
    setAttempted(0);
    setCorrectCount(0);
    setStreak(0);
    setBestStreak(0);
    setDone(false);
    setError("");
  }

  if (total === 0) {
    return (
      <Card>
        <p className="script-note">This practice set has no questions yet.</p>
      </Card>
    );
  }

  if (done) {
    const percent = attempted > 0 ? Math.round((correctCount / attempted) * 100) : 0;
    return (
      <Card className="border-primary/30">
        <h2 className="text-xl font-semibold">Session complete</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-serif text-3xl font-semibold">{attempted}</p>
            <p className="text-sm text-muted-foreground">attempted</p>
          </div>
          <div>
            <p className="font-serif text-3xl font-semibold">{correctCount}</p>
            <p className="text-sm text-muted-foreground">correct</p>
          </div>
          <div>
            <p className="font-serif text-3xl font-semibold">{bestStreak}</p>
            <p className="text-sm text-muted-foreground">best streak</p>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="bar-animate h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <p className="script-note mt-3 text-lg">{END_LINES[bestStreak % END_LINES.length]}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={practiceAgain}>Practice again</Button>
          <Button asChild variant="outline">
            <Link href="/student/practice">Back to practice sets</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const feedbackLine = revealed
    ? result?.kind === "mcq"
      ? result.correct
        ? CORRECT_LINES[position % CORRECT_LINES.length]
        : WRONG_LINES[position % WRONG_LINES.length]
      : null
    : null;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {title} · <strong className="font-serif text-base text-foreground">{position + 1}</strong>/{total}
        </span>
        {streak > 1 ? (
          <span className="flex items-center gap-1 font-medium text-primary">
            <Flame className="h-4 w-4" aria-hidden="true" />
            {streak} in a row
          </span>
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${((position + (revealed ? 1 : 0)) / total) * 100}%` }}
        />
      </div>

      <Card>
        <p className="text-sm text-muted-foreground">{question.topic}</p>
        <p className="mt-1 text-base">{question.question_text}</p>

        {isMcq ? (
          <div className="mt-4 grid gap-2">
            {options.map((option, optionIndex) => {
              const isChosen = selected === option;
              const isCorrectOption =
                revealed && result?.correctAnswer != null &&
                option.trim().toLowerCase() === result.correctAnswer.trim().toLowerCase();

              return (
                <button
                  key={option}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-lg border p-3 text-left text-base transition",
                    !revealed && isChosen && "border-primary bg-secondary/50",
                    !revealed && !isChosen && "hover:border-primary/40",
                    revealed && isCorrectOption && "border-primary bg-secondary/60",
                    revealed && isChosen && isCorrectOption && "border-primary bg-primary text-primary-foreground",
                    revealed && isChosen && !isCorrectOption && "border-amber-400 bg-amber-50",
                    revealed && !isChosen && !isCorrectOption && "opacity-60"
                  )}
                  disabled={revealed || pending}
                  type="button"
                  onClick={() => setSelected(option)}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-serif text-sm font-semibold",
                      revealed && isChosen && isCorrectOption
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span className="flex-1">{option}</span>
                  {revealed && isCorrectOption ? <Check className="h-5 w-5 shrink-0" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <Textarea
              disabled={revealed || pending}
              placeholder="Write your answer, then check it against the rubric"
              value={written}
              onChange={(event) => setWritten(event.target.value)}
            />
            {revealed && result?.kind === "subjective" ? (
              <div className="rounded-lg border bg-muted p-3">
                <p className="text-sm font-medium">Rubric</p>
                <p className="mt-1 text-sm">{result.rubric ?? "Compare with your class notes."}</p>
                <p className="script-note mt-2">How close did you get?</p>
                <div className="mt-2 flex gap-2">
                  <Button disabled={selfMarked} size="sm" variant="ghost" onClick={() => selfMark(true)}>
                    Got it
                  </Button>
                  <Button disabled={selfMarked} size="sm" variant="ghost" onClick={() => selfMark(false)}>
                    Review again
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {feedbackLine ? (
          <p className={cn("mt-3 text-sm font-medium", result?.correct ? "text-primary" : "text-amber-700")}>
            {feedbackLine}
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </Card>

      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-background via-background to-transparent px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 sm:static sm:m-0 sm:bg-none sm:p-0">
        {revealed ? (
          <Button className="h-12 w-full" onClick={next}>
            {position + 1 >= total ? "Finish session" : "Next question"}
          </Button>
        ) : (
          <Button className="h-12 w-full" disabled={pending || !answerValue.trim()} onClick={check}>
            {pending ? "Checking…" : isMcq ? "Check answer" : "Show rubric"}
          </Button>
        )}
      </div>
    </div>
  );
}

function jsonStringArray(value: Json | null) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function shuffle(values: number[]) {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
