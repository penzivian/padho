"use client";

import { Plus, Save, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";

import {
  extractDraftQuestionsAction,
  generateDraftQuestionsAction,
  savePaperAction,
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
import { cn } from "@/lib/utils";

type BatchOption = {
  id: string;
  name: string;
  subject: string;
  exam_target: string;
};

const initialState: DraftQuestionsState = {
  ok: false,
  message: ""
};

export function PaperBuilder({ batches }: { batches: BatchOption[] }) {
  const [generateState, generateAction] = useFormState(generateDraftQuestionsAction, initialState);
  const [extractState, extractAction] = useFormState(extractDraftQuestionsAction, initialState);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [source, setSource] = useState<"uploaded" | "ai_generated">("ai_generated");
  const [fileUrl, setFileUrl] = useState<string | undefined>();
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [answerKeyText, setAnswerKeyText] = useState("");
  const [bulkMarks, setBulkMarks] = useState("");
  const [bulkNegative, setBulkNegative] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (generateState.data) {
      setQuestions(generateState.data.questions);
      setSource(generateState.data.source);
      setFileUrl(generateState.data.fileUrl);
    }
    if (generateState.message) setMessage(generateState.message);
  }, [generateState]);

  useEffect(() => {
    if (extractState.data) {
      setQuestions(extractState.data.questions);
      setSource(extractState.data.source);
      setFileUrl(extractState.data.fileUrl);
    }
    if (extractState.message) setMessage(extractState.message);
  }, [extractState]);

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question
      )
    );
  }

  function addQuestion() {
    setQuestions((current) => [
      ...current,
      {
        question_text: "",
        question_type: "mcq",
        topic: "General",
        options: ["", "", "", ""],
        correct_answer: "",
        max_marks: 1,
        negative_marks: 0,
        rubric: null
      }
    ]);
  }

  // "Apply to all" for the marking scheme. Marks go on every question; the penalty only on
  // MCQs, since a written answer is never negatively marked.
  function applyMarksToAll() {
    const value = Math.max(0.5, Number(bulkMarks) || 0);
    setQuestions((current) =>
      current.map((question) => ({
        ...question,
        max_marks: value,
        // Keep the invariant the database enforces: penalty can never exceed the marks.
        negative_marks: Math.min(question.negative_marks ?? 0, value)
      }))
    );
    setMessage(`Set every question to ${value} mark${value === 1 ? "" : "s"}.`);
  }

  function applyNegativeToAll() {
    const value = Math.max(0, Number(bulkNegative) || 0);
    setQuestions((current) =>
      current.map((question) =>
        question.question_type === "mcq"
          ? { ...question, negative_marks: Math.min(value, question.max_marks) }
          : question
      )
    );
    setMessage(
      value === 0
        ? "Turned negative marking off for every MCQ."
        : `Set every MCQ to −${value} for a wrong answer.`
    );
  }

  function applyKey() {
    setQuestions((current) => applyAnswerKey(current, answerKeyText));
    setMessage("Applied the answer key to MCQ questions by position.");
  }

  function savePaper() {
    if (!batchId) {
      setMessage("Select a batch before saving.");
      return;
    }
    if (!title.trim()) {
      setMessage("Enter a paper title before saving.");
      return;
    }
    if (questions.length === 0) {
      setMessage("Add or generate at least one question before saving.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await savePaperAction({ batchId, title: title.trim(), source, fileUrl, questions });
        setMessage(result.message);
        if (result.ok) {
          setQuestions([]);
          setTitle("");
        }
      } catch {
        setMessage("Could not save the paper. Please try again.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                Let AI draft it
              </CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">from a topic</p>
            </div>
          </CardHeader>
          <form action={generateAction} className="grid gap-3">
            <FormField htmlFor="subject" label="Subject">
              <Input id="subject" name="subject" defaultValue={batches[0]?.subject ?? ""} required />
            </FormField>
            <FormField htmlFor="topic" label="Topic">
              <Input id="topic" name="topic" required />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField htmlFor="exam_target" label="Exam">
                <Input id="exam_target" name="exam_target" defaultValue={batches[0]?.exam_target ?? ""} required />
              </FormField>
              <FormField htmlFor="difficulty" label="Difficulty">
                <Select id="difficulty" name="difficulty" defaultValue="medium">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField htmlFor="count" label="Questions">
                <Input id="count" name="count" type="number" min="1" max="20" defaultValue="5" />
              </FormField>
              <FormField htmlFor="mix" label="Mix">
                <Select id="mix" name="mix" defaultValue="mixed">
                  <option value="mcq">MCQ</option>
                  <option value="subjective">Subjective</option>
                  <option value="mixed">Mixed</option>
                </Select>
              </FormField>
            </div>
            <SubmitButton pendingText="Drafting">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Draft my paper
            </SubmitButton>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-primary" aria-hidden="true" />
                Upload my file
              </CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">PDF · photo</p>
            </div>
          </CardHeader>
          <form action={extractAction} className="grid gap-3">
            <FormField htmlFor="paper_file" label="Paper file">
              <Input id="paper_file" name="paper_file" type="file" accept="image/*,application/pdf" required />
            </FormField>
            <SubmitButton pendingText="Extracting" variant="secondary">
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Extract questions
            </SubmitButton>
            {extractState.message ? (
              <p
                className={cn(
                  "rounded-md border p-3 text-sm",
                  extractState.ok
                    ? "border-primary/30 bg-secondary/40"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                )}
              >
                {extractState.ok
                  ? `${extractState.message} — review the questions below.`
                  : extractState.message}
              </p>
            ) : null}
          </form>
        </Card>
      </div>

      <section className="grid gap-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Review &amp; save</CardTitle>
              <p className="script-note mt-0.5">Check each one before saving —</p>
            </div>
            <Save className="h-5 w-5 text-primary" />
          </CardHeader>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField htmlFor="batch_id" label="Batch">
                <Select id="batch_id" value={batchId} onChange={(event) => setBatchId(event.target.value)}>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField htmlFor="title" label="Title (required)">
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. PSAT Mock 1"
                />
              </FormField>
            </div>
            <FormField htmlFor="answer_key" label="Answer key (optional)">
              <Textarea
                id="answer_key"
                value={answerKeyText}
                onChange={(event) => setAnswerKeyText(event.target.value)}
                placeholder="e.g. 1:B, 2:C, 3:A — fills MCQ answers by question position"
              />
            </FormField>
            <Button
              type="button"
              variant="outline"
              disabled={questions.length === 0 || !answerKeyText.trim()}
              onClick={applyKey}
            >
              Apply answer key
            </Button>

            <div className="grid gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Marking scheme</p>
                <p className="script-note">
                  Set one rule for the whole paper — JEE style is +4 correct, −1 wrong.
                  Unanswered questions are never penalised.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-end gap-2">
                  <FormField className="flex-1" htmlFor="bulk_marks" label="Marks per question">
                    <Input
                      id="bulk_marks"
                      type="number"
                      min="0.5"
                      step="0.5"
                      placeholder="4"
                      value={bulkMarks}
                      onChange={(event) => setBulkMarks(event.target.value)}
                    />
                  </FormField>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={questions.length === 0 || !bulkMarks.trim()}
                    onClick={applyMarksToAll}
                  >
                    Apply to all
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <FormField className="flex-1" htmlFor="bulk_negative" label="Negative marks">
                    <Input
                      id="bulk_negative"
                      type="number"
                      min="0"
                      step="0.25"
                      placeholder="1"
                      value={bulkNegative}
                      onChange={(event) => setBulkNegative(event.target.value)}
                    />
                  </FormField>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={questions.length === 0 || !bulkNegative.trim()}
                    onClick={applyNegativeToAll}
                  >
                    Apply to all
                  </Button>
                </div>
              </div>
              <p className="script-note">
                Enter the penalty as a positive number — 1 means −1 for a wrong answer. Set it
                to 0 to switch negative marking off. MCQs only.
              </p>
            </div>

            {message ? <p className="rounded-md border bg-muted p-3 text-sm">{message}</p> : null}
          </div>
        </Card>

        {questions.map((question, index) => (
          <Card key={`${question.question_text}-${index}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Q{index + 1}
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {question.question_type === "mcq" ? "MCQ" : "Subjective"}
                </span>
              </CardTitle>
              <Button
                aria-label="Remove question"
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <div className="grid gap-3">
              <FormField htmlFor={`question_${index}`} label="Question">
                <Textarea
                  id={`question_${index}`}
                  value={question.question_text}
                  onChange={(event) => updateQuestion(index, { question_text: event.target.value })}
                />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField htmlFor={`type_${index}`} label="Type">
                  <Select
                    id={`type_${index}`}
                    value={question.question_type}
                    onChange={(event) =>
                      updateQuestion(index, {
                        question_type: event.target.value as DraftQuestion["question_type"]
                      })
                    }
                  >
                    <option value="mcq">MCQ</option>
                    <option value="subjective">Subjective</option>
                  </Select>
                </FormField>
                <FormField htmlFor={`topic_${index}`} label="Topic">
                  <Input
                    id={`topic_${index}`}
                    value={question.topic}
                    onChange={(event) => updateQuestion(index, { topic: event.target.value })}
                  />
                </FormField>
                <FormField htmlFor={`marks_${index}`} label="Marks">
                  <Input
                    id={`marks_${index}`}
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={question.max_marks}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      updateQuestion(index, {
                        max_marks: value,
                        negative_marks: Math.min(question.negative_marks ?? 0, value)
                      });
                    }}
                  />
                </FormField>
              </div>
              {question.question_type === "mcq" ? (
                <FormField htmlFor={`negative_${index}`} label="Negative marks (wrong answer)">
                  <Input
                    id={`negative_${index}`}
                    type="number"
                    min="0"
                    max={question.max_marks}
                    step="0.25"
                    value={question.negative_marks ?? 0}
                    onChange={(event) =>
                      updateQuestion(index, {
                        negative_marks: Math.min(
                          Math.max(Number(event.target.value) || 0, 0),
                          question.max_marks
                        )
                      })
                    }
                  />
                </FormField>
              ) : null}
              {question.question_type === "mcq" ? (
                <>
                  <FormField htmlFor={`options_${index}`} label="Options (one per line)">
                    <Textarea
                      id={`options_${index}`}
                      value={(question.options ?? []).join("\n")}
                      onChange={(event) =>
                        updateQuestion(index, {
                          options: event.target.value.split("\n").filter(Boolean)
                        })
                      }
                    />
                  </FormField>
                  <FormField htmlFor={`answer_${index}`} label="Correct answer">
                    <Input
                      id={`answer_${index}`}
                      value={question.correct_answer ?? ""}
                      onChange={(event) => updateQuestion(index, { correct_answer: event.target.value })}
                    />
                  </FormField>
                </>
              ) : (
                <FormField htmlFor={`rubric_${index}`} label="Rubric">
                  <Textarea
                    id={`rubric_${index}`}
                    value={question.rubric ?? ""}
                    onChange={(event) => updateQuestion(index, { rubric: event.target.value })}
                  />
                </FormField>
              )}
            </div>
          </Card>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addQuestion}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add question
          </Button>
          <Button type="button" disabled={pending || questions.length === 0} onClick={savePaper}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {pending ? "Saving" : "Save paper"}
          </Button>
        </div>
      </section>
    </div>
  );
}
