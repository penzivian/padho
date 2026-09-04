import type { DraftQuestion } from "@/lib/ai";

// Pure parser for Vedantu's JEE-Main previous-year PDFs.
//
// Deliberately separate from `lib/extract.ts`. That module parses NUMBERED papers
// ("1. ", "Q1) ") — the shape a teacher's own uploaded paper has. Vedantu's PDFs are not
// numbered at all; they are a flat stream of labelled blocks:
//
//   Question: <stem> Options: (a) .. (b) .. (c) .. (d) .. Answer: (b) Solution : ...
//
// Feeding these to `extractDraftQuestions` yields near-nothing (2 garbage rows from a
// 21-question paper), because there are no sequential question markers to anchor on.
//
// The important part of this module is not the parsing — it is `classifyVedantuQuestion`.
// These PDFs render every formula, graph and circuit as an IMAGE with no text layer, so a
// question can parse perfectly and still be worthless: options come back as ["", "", "", ""]
// or ["cm", "cm", "cm", "cm"]. Importing those into a shared library ships unanswerable
// questions to every teacher on the platform, so they are rejected rather than imported.

export type VedantuQuestion = {
  stem: string;
  options: string[];
  answer: string | null;
};

export type VedantuVerdict =
  | "clean"
  | "image-options"
  | "needs-diagram"
  | "no-key"
  | "malformed";

export type VedantuPaper = {
  // Vedantu's papers are student-recall reconstructions, not the official NTA paper. The
  // marker is in the PDF header and is worth surfacing rather than silently importing.
  memoryBased: boolean;
  questions: VedantuQuestion[];
};

const BLOCK_SPLIT = /\bQuestion\s*:\s*/i;
const SOLUTION_SPLIT = /\bSolution\s*:/i;
const OPTIONS_MARKER = /\bOptions\s*:\s*([\s\S]*)$/i;
const ANSWER_MARKER = /\bAnswer\s*:\s*\(?\s*([a-dA-D])\s*\)?/;
const OPTION_SPLIT = /\(([a-d])\)\s*/i;
const MEMORY_BASED = /memory\s*based/i;

// A stem that points at a figure the PDF only holds as an image. The question may read fine
// but is unanswerable without the picture, and we are not cropping images out of the PDF.
const DIAGRAM_REFERENCE =
  /\b(?:in|from|below|shown)?\s*(?:the\s+)?(?:figure|fig\.|diagram|circuit shown|graph below|following graph|graph shown|as shown)\b/i;

// Options that are only a unit or a bare symbol are what is left behind when the actual
// value was an image: "(a) cm (b) cm (c) cm (d) cm".
const UNIT_ONLY =
  /^(?:cm|mm|m|km|s|ms|kg|g|mol|n|j|w|v|a|hz|k|ev|nm|pm|ohm|ω|μ|°|%|rad|m\/s|cm2|m2|cm3|m3)$/i;

export function parseVedantuPaper(text: string): VedantuPaper {
  const blocks = text.split(BLOCK_SPLIT).slice(1);

  return {
    memoryBased: MEMORY_BASED.test(text),
    questions: blocks.map(parseBlock)
  };
}

function parseBlock(block: string): VedantuQuestion {
  // Everything after "Solution :" is worked reasoning, not part of the question.
  const body = block.split(SOLUTION_SPLIT)[0];
  const optionsMatch = body.match(OPTIONS_MARKER);

  const stem = collapse(
    optionsMatch ? body.slice(0, optionsMatch.index) : body
  );

  if (!optionsMatch) return { stem, options: [], answer: null };

  let rest = optionsMatch[1];
  let answer: string | null = null;

  const answerMatch = rest.match(ANSWER_MARKER);
  if (answerMatch) {
    answer = answerMatch[1].toUpperCase();
    rest = rest.slice(0, answerMatch.index);
  }

  // split() on a capturing regex interleaves [letter, text, letter, text, ...]; the leading
  // slice(1) drops whatever preceded the first "(a)".
  const parts = rest.split(new RegExp(OPTION_SPLIT, "gi")).slice(1);
  const options: string[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) options.push(collapse(parts[i + 1]));

  return { stem, options, answer };
}

function collapse(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

// Alphanumeric-only view of an option, used to decide "is there actually anything here".
function meat(option: string) {
  return option.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function classifyVedantuQuestion(question: VedantuQuestion): VedantuVerdict {
  if (question.options.length !== 4) return "malformed";
  if (question.stem.length < 25) return "malformed";

  const bodies = question.options.map(meat);

  // Any blank option means the real content was an image.
  if (bodies.some((body) => body.length === 0)) return "image-options";
  // Four options that are only units ("cm", "cm", "cm", "cm") — same cause.
  if (question.options.every((option) => UNIT_ONLY.test(option.trim()))) return "image-options";
  // Duplicate options are not a real MCQ; in practice this is the image case again, where
  // several options collapsed to the same leftover fragment.
  if (new Set(bodies).size < 4) return "image-options";

  if (!question.answer) return "no-key";
  if (DIAGRAM_REFERENCE.test(question.stem)) return "needs-diagram";

  return "clean";
}

export type VedantuDraftOptions = {
  topic: string;
  maxMarks: number;
  negativeMarks: number;
};

// Only "clean" questions become drafts. The rejected ones are reported by the ingest script
// rather than dropped silently, so the size of the loss is visible before publishing.
export function toDraftQuestions(
  questions: VedantuQuestion[],
  options: VedantuDraftOptions
): DraftQuestion[] {
  return questions
    .filter((question) => classifyVedantuQuestion(question) === "clean")
    .map((question) => ({
      question_text: question.stem,
      question_type: "mcq" as const,
      topic: options.topic,
      options: question.options,
      // The bank stores the answer as the option TEXT, matching how `questions.correct_answer`
      // is compared in `scoreMcqAnswer` — a bare letter would never match a student's choice.
      correct_answer: question.answer
        ? question.options[question.answer.charCodeAt(0) - 65] ?? null
        : null,
      max_marks: options.maxMarks,
      negative_marks: options.negativeMarks,
      rubric: null
    }));
}
