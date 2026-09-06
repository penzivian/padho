"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Globe2, Library, Plus, Search } from "lucide-react";

import {
  listBankSubjectsAction,
  searchBankAction,
  type BankScope,
  type BankSearchResult,
  type BankSearchRow
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DraftQuestion } from "@/lib/ai";

type BankPickerProps = {
  onAdd: (questions: DraftQuestion[]) => void;
};

const SCOPES: [BankScope, string][] = [
  ["all", "Everything"],
  ["mine", "My bank"],
  ["library", "Shared library"]
];

// Typing re-runs the search, so it waits for a pause. Dropdowns fire immediately — a filter
// you picked deliberately should not feel laggy.
const TYPING_PAUSE_MS = 350;

// Search the bank and drop questions into the paper being built. Results come back already
// shaped as drafts, so adding one is a plain append — and because the paper stores its own
// copy, editing it here never touches the bank row it came from.
export function BankPicker({ onAdd }: BankPickerProps) {
  const [term, setTerm] = useState("");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [questionType, setQuestionType] = useState("");
  const [scope, setScope] = useState<BankScope>("all");
  const [howMany, setHowMany] = useState(10);
  const [results, setResults] = useState<BankSearchRow[]>([]);
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [isSearching, startSearching] = useTransition();

  // Guards against an older, slower response overwriting a newer one. Filters now re-search on
  // every change, so two queries really can be in flight at once.
  const requestId = useRef(0);

  const runSearch = useCallback(
    (limit: number) => {
      const formData = new FormData();
      formData.set("term", term);
      formData.set("topic", topic);
      formData.set("subject", subject);
      formData.set("question_type", questionType);
      formData.set("scope", scope);
      // Always fetch enough to satisfy an "add N" in one go.
      formData.set("limit", String(Math.max(limit, 50)));

      const id = requestId.current + 1;
      requestId.current = id;

      startSearching(async () => {
        const result: BankSearchResult = await searchBankAction(formData);
        if (id !== requestId.current) return;

        if (!result.ok) {
          setMessage(result.message ?? "Could not search the bank.");
          setResults([]);
          return;
        }

        const questions = result.questions ?? [];
        setAdded(new Set());
        setResults(questions);
        setMessage(
          questions.length > 0
            ? ""
            : scope === "library"
              ? "Nothing in the shared library matches these filters."
              : "Nothing matched. Save a paper to your bank, or widen the filters."
        );
      });
    },
    [term, topic, subject, questionType, scope]
  );

  useEffect(() => {
    let active = true;
    listBankSubjectsAction()
      .then((values) => {
        if (active) setSubjects(values);
      })
      .catch(() => {
        // A failed lookup just means no dropdown options — search still works without it.
      });
    return () => {
      active = false;
    };
  }, []);

  // Filters are live. Previously the results only refreshed when the Search button was
  // pressed, so changing the subject left the previous subject's questions on screen — the
  // filter looked broken when it was only stale.
  useEffect(() => {
    const timer = setTimeout(() => runSearch(howMany), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
    // `howMany` is deliberately not a dependency: changing how many to add should not re-query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSearch]);

  function addFirst(count: number) {
    const picks: BankSearchRow[] = [];
    const claimed = new Set(added);

    for (let i = 0; i < results.length && picks.length < count; i += 1) {
      if (claimed.has(i)) continue;
      claimed.add(i);
      picks.push(results[i]);
    }

    if (picks.length === 0) return;
    onAdd(picks);
    setAdded(claimed);
  }

  const remaining = results.length - added.size;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Library className="h-5 w-5 text-primary" aria-hidden="true" />
          Reuse from a question bank
        </CardTitle>
      </CardHeader>

      <div className="grid gap-4">
        {/* Scope first: it decides which bank you are looking at, so it reads as a heading
            for everything below rather than as one filter among four. */}
        <div className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/50 p-1">
          {SCOPES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                scope === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search questions"
            className="pl-9"
            value={term}
            placeholder="Search questions — kinematics, electronegativity…"
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <FormField htmlFor="bank_subject" label="Subject">
            <Select
              id="bank_subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            >
              <option value="">All subjects</option>
              {subjects.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField htmlFor="bank_type" label="Type">
            <Select
              id="bank_type"
              value={questionType}
              onChange={(event) => setQuestionType(event.target.value)}
            >
              <option value="">Any type</option>
              <option value="mcq">MCQ</option>
              <option value="subjective">Subjective</option>
            </Select>
          </FormField>
          <FormField htmlFor="bank_topic" label="Topic">
            <Input
              id="bank_topic"
              value={topic}
              placeholder="Any topic"
              onChange={(event) => setTopic(event.target.value)}
            />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="script-note" aria-live="polite">
            {isSearching
              ? "Searching…"
              : results.length === 0
                ? "No questions"
                : `${results.length} found${added.size > 0 ? ` · ${added.size} added` : ""}`}
          </p>

          <div className="flex items-center gap-2">
            <label className="script-note" htmlFor="bank_how_many">
              Add
            </label>
            <Input
              id="bank_how_many"
              className="w-16 text-center"
              type="number"
              min={1}
              max={50}
              value={howMany}
              onChange={(event) =>
                setHowMany(Math.min(Math.max(Number(event.target.value) || 1, 1), 50))
              }
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={remaining === 0}
              onClick={() => addFirst(howMany)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add {Math.min(howMany, Math.max(remaining, 0))}
            </Button>
          </div>
        </div>

        {message ? <p className="script-note">{message}</p> : null}

        {results.length > 0 ? (
          <div className="grid max-h-96 gap-2 overflow-y-auto pr-1">
            {results.map((question, index) => (
              <div
                key={`${question.question_text}-${index}`}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm transition-colors ${
                  added.has(index) ? "bg-muted/60" : "bg-card hover:border-primary/40"
                }`}
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 leading-relaxed">{question.question_text}</p>
                  <div className="script-note mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {question.subject && question.subject !== question.topic ? (
                      <span>{question.subject}</span>
                    ) : null}
                    <span>{question.topic}</span>
                    <span aria-hidden="true">·</span>
                    <span>{question.question_type === "mcq" ? "MCQ" : "Subjective"}</span>
                    <span aria-hidden="true">·</span>
                    <span>{question.max_marks} marks</span>
                    {Number(question.negative_marks ?? 0) > 0 ? (
                      <span>{`−${question.negative_marks}`}</span>
                    ) : null}
                    {question.is_public ? (
                      <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                        <Globe2 className="h-3 w-3" aria-hidden="true" />
                        {question.source_label || "Shared library"}
                      </span>
                    ) : question.source_label ? (
                      <span>from {question.source_label}</span>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={added.has(index) ? "ghost" : "outline"}
                  disabled={added.has(index)}
                  onClick={() => {
                    onAdd([question]);
                    setAdded((current) => new Set(current).add(index));
                  }}
                >
                  {added.has(index) ? (
                    "Added"
                  ) : (
                    <>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
