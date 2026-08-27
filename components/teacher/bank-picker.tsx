"use client";

import { useState, useTransition } from "react";
import { Globe2, Library, Plus } from "lucide-react";

import { searchBankAction, type BankScope, type BankSearchResult, type BankSearchRow } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DraftQuestion } from "@/lib/ai";
import { optionLabel } from "@/lib/options";

type BankPickerProps = {
  onAdd: (questions: DraftQuestion[]) => void;
};

// Search the teacher's own bank and drop questions into the paper being built. Results come
// back already shaped as drafts, so adding one is a plain append — and because the paper
// stores its own copy, editing it here never touches the bank row it came from.
export function BankPicker({ onAdd }: BankPickerProps) {
  const [term, setTerm] = useState("");
  const [topic, setTopic] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [scope, setScope] = useState<BankScope>("all");
  const [results, setResults] = useState<BankSearchRow[]>([]);
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [isSearching, startSearching] = useTransition();

  function search() {
    const formData = new FormData();
    formData.set("term", term);
    formData.set("topic", topic);
    formData.set("question_type", questionType);
    formData.set("scope", scope);

    startSearching(async () => {
      const result: BankSearchResult = await searchBankAction(formData);
      if (!result.ok) {
        setMessage(result.message ?? "Could not search your bank.");
        setResults([]);
        return;
      }

      setAdded(new Set());
      setResults(result.questions ?? []);
      setMessage(
        (result.questions ?? []).length === 0
          ? scope === "library"
            ? "Nothing in the shared library matches yet."
            : "Nothing matched. Save a paper to your bank from the Question papers screen first."
          : ""
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Library className="h-5 w-5 text-primary" aria-hidden="true" />
          Reuse from your bank
        </CardTitle>
      </CardHeader>

      <div className="grid gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Everything"],
              ["mine", "My bank"],
              ["library", "Shared library"]
            ] as [BankScope, string][]
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={scope === value ? "default" : "outline"}
              onClick={() => setScope(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_0.8fr_auto] sm:items-end">
          <FormField htmlFor="bank_term" label="Search">
            <Input
              id="bank_term"
              value={term}
              placeholder="kinematics, newton's third law…"
              onChange={(event) => setTerm(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="bank_topic" label="Topic">
            <Input
              id="bank_topic"
              value={topic}
              placeholder="any"
              onChange={(event) => setTopic(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="bank_type" label="Type">
            <Select
              id="bank_type"
              value={questionType}
              onChange={(event) => setQuestionType(event.target.value)}
            >
              <option value="">Any</option>
              <option value="mcq">MCQ</option>
              <option value="subjective">Subjective</option>
            </Select>
          </FormField>
          <Button type="button" variant="outline" disabled={isSearching} onClick={search}>
            {isSearching ? "Searching" : "Search"}
          </Button>
        </div>

        {message ? <p className="script-note">{message}</p> : null}

        {results.length > 0 ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="script-note">
                {results.length} match{results.length === 1 ? "" : "es"}
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  onAdd(results.filter((_, index) => !added.has(index)));
                  setAdded(new Set(results.map((_, index) => index)));
                }}
              >
                Add all
              </Button>
            </div>

            <div className="grid max-h-80 gap-2 overflow-y-auto">
              {results.map((question, index) => (
                <div
                  key={`${question.question_text}-${index}`}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-2">{question.question_text}</p>
                    {question.image_url ? (
                      // A diagram question is unusable without its diagram, so show it here —
                      // otherwise a teacher reuses the stem and never learns a figure was
                      // attached. The URL is signed and short-lived; the path is never exposed.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={question.image_url}
                        alt=""
                        className="mt-2 max-h-24 w-auto rounded-md border bg-white object-contain"
                      />
                    ) : null}
                    {(question.options ?? []).some((option) => option.image_url) ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(question.options ?? []).map((option, optionIndex) =>
                          option.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={optionIndex}
                              src={option.image_url}
                              alt={`Option ${optionLabel(optionIndex)}`}
                              className="max-h-16 w-auto rounded-md border bg-white object-contain"
                            />
                          ) : null
                        )}
                      </div>
                    ) : null}
                    <p className="script-note mt-1">
                      {question.topic} · {question.question_type === "mcq" ? "MCQ" : "Subjective"}{" "}
                      · {question.max_marks} marks
                      {Number(question.negative_marks ?? 0) > 0
                        ? ` · −${question.negative_marks}`
                        : ""}
                    </p>
                    {question.is_public ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                        <Globe2 className="h-3 w-3" aria-hidden="true" />
                        {question.source_label || "Shared library"}
                      </span>
                    ) : question.source_label ? (
                      <span className="script-note mt-1 block">from {question.source_label}</span>
                    ) : null}
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
          </div>
        ) : null}
      </div>
    </Card>
  );
}
