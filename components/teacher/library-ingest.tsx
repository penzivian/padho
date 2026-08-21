"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { UploadCloud, Trash2, Globe2 } from "lucide-react";

import {
  extractDraftQuestionsAction,
  publishToLibraryAction,
  type DraftQuestionsState
} from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DraftQuestion } from "@/lib/ai";
import { applyAnswerKey } from "@/lib/extract";

const initialState: DraftQuestionsState = { ok: false, message: "" };

// Upload a past paper, review what was extracted, tag it, publish it to every teacher.
// Reuses the same extraction pipeline as the paper builder — the difference is only where
// the questions land and who can see them.
export function LibraryIngest() {
  const [extractState, extractAction] = useFormState(extractDraftQuestionsAction, initialState);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [sourceLabel, setSourceLabel] = useState("");
  const [subject, setSubject] = useState("");
  const [defaultTopic, setDefaultTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [answerKeyText, setAnswerKeyText] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (extractState.data) setQuestions(extractState.data.questions);
    if (extractState.message) setMessage(extractState.message);
  }, [extractState]);

  function publish() {
    if (!sourceLabel.trim()) {
      setMessage("Add a source label first, e.g. 'JEE Main 2024 · Shift 1'.");
      return;
    }

    startTransition(async () => {
      const result = await publishToLibraryAction({
        questions,
        sourceLabel,
        subject,
        difficulty,
        defaultTopic
      });
      setMessage(result.message);
      if (result.ok) {
        setQuestions([]);
        setAnswerKeyText("");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe2 className="h-5 w-5 text-primary" aria-hidden="true" />
          Add a past paper to the library
        </CardTitle>
      </CardHeader>

      <div className="grid gap-4">
        <form action={extractAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <FormField htmlFor="paper_file" label="Question paper (PDF)">
            <Input id="paper_file" name="paper_file" type="file" accept="application/pdf,image/*" />
          </FormField>
          <SubmitButton pendingText="Extracting" variant="outline">
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Extract
          </SubmitButton>
        </form>

        <p className="script-note">
          Text-based PDFs extract locally. A scanned paper has no text layer and needs the AI
          vision path (an Anthropic key), or the questions typed by hand.
        </p>

        {questions.length > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField htmlFor="source_label" label="Source (shown to teachers)">
                <Input
                  id="source_label"
                  value={sourceLabel}
                  placeholder="JEE Main 2024 · Shift 1"
                  onChange={(event) => setSourceLabel(event.target.value)}
                />
              </FormField>
              <FormField htmlFor="lib_subject" label="Subject">
                <Input
                  id="lib_subject"
                  value={subject}
                  placeholder="Physics"
                  onChange={(event) => setSubject(event.target.value)}
                />
              </FormField>
              <FormField htmlFor="lib_topic" label="Default topic (for untagged questions)">
                <Input
                  id="lib_topic"
                  value={defaultTopic}
                  placeholder="General"
                  onChange={(event) => setDefaultTopic(event.target.value)}
                />
              </FormField>
              <FormField htmlFor="lib_difficulty" label="Difficulty">
                <Select
                  id="lib_difficulty"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </Select>
              </FormField>
            </div>

            <div className="grid gap-2">
              <FormField htmlFor="lib_key" label="Answer key (optional)">
                <Textarea
                  id="lib_key"
                  rows={2}
                  value={answerKeyText}
                  placeholder="1:B, 2:C, 3:A — applied by question order"
                  onChange={(event) => setAnswerKeyText(event.target.value)}
                />
              </FormField>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!answerKeyText.trim()}
                  onClick={() => {
                    setQuestions((current) => applyAnswerKey(current, answerKeyText));
                    setMessage("Applied the answer key by position.");
                  }}
                >
                  Apply answer key
                </Button>
              </div>
            </div>

            <div className="grid max-h-96 gap-2 overflow-y-auto">
              {questions.map((question, index) => (
                <div
                  key={`${question.question_text}-${index}`}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">Q{index + 1}</p>
                    <p className="line-clamp-2">{question.question_text}</p>
                    <p className="script-note mt-1">
                      {question.question_type === "mcq" ? "MCQ" : "Subjective"} ·{" "}
                      {question.correct_answer ? "keyed" : "no key"} · {question.max_marks} marks
                    </p>
                  </div>
                  <Button
                    aria-label={`Remove question ${index + 1}`}
                    size="icon"
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setQuestions((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" disabled={pending} onClick={publish}>
                {pending ? "Publishing" : `Publish ${questions.length} to shared library`}
              </Button>
              <p className="script-note">
                Every teacher on Padho will be able to search and reuse these.
              </p>
            </div>
          </>
        ) : null}

        {message ? <p className="rounded-md border bg-muted p-3 text-sm">{message}</p> : null}
      </div>
    </Card>
  );
}
