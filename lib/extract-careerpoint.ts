import type { DraftQuestion } from "@/lib/ai";

// Parser for Career Point's JEE Main papers (cms.careerpoint.ac.in).
//
// Why a third extractor. `lib/extract.ts` handles a teacher's own numbered upload;
// `lib/extract-vedantu.ts` handles Vedantu's unnumbered recall reconstructions. Career Point
// publishes the OFFICIAL paper — one PDF carries all three subjects, 20 MCQs plus 5
// numerical questions each, with the real distractors and a worked solution:
//
//   MATHEMATICS
//   Section-A: ...
//   Q.1 <stem> (1) a (2) b (3) c (4) d Ans. [3] Sol. <working>
//   Section-B: Numerical Value Type Questions: ...
//   Q.21 <stem> ____. Ans. [34] Sol. <working>
//
// Two shape differences from the other sources: options are numbered "(1)".."(4)" rather
// than lettered, and the key is an INDEX ("Ans. [3]" = the third option), not a letter.
//
// The papers are worth the extra module because Vedantu's are demonstrably wrong: on
// 22 Jan 2025 Maths Q3 it offers 20/21/22/23 where the real options are 24/19/21/22. Both
// call the answer 22, so the key looks right while three of four distractors are invented.

export type CareerPointQuestion = {
  number: number;
  subject: string;
  stem: string;
  options: string[];
  // 1-based index into `options` for an MCQ; null for a numerical question.
  answerIndex: number | null;
  // The literal value from "Ans. [...]" — an option index for Section A, the answer itself
  // for Section B.
  answerRaw: string;
};

export type CareerPointVerdict =
  | "clean"
  | "numerical"
  | "image-options"
  | "needs-diagram"
  | "mangled-math"
  | "malformed";

const SUBJECTS = ["MATHEMATICS", "PHYSICS", "CHEMISTRY"] as const;

// Repeated page furniture. Stripped before parsing or it lands inside whichever question
// happens to straddle the page break.
const PAGE_FURNITURE =
  /CAREER\s*POINT[\s\S]{0,160}?www\.careerpoint\.ac\.in\s*\d*\s*(?:JEE\s*Main\s*Online\s*Paper)?/gi;
// Bounded by the next question marker rather than by sentence count. A section blurb can run
// to two sentences ("...5 Numerical based questions.The answer should be rounded-off..."), but
// matching sentences greedily swallows the "Q." of the first question and destroys the marker.
const SECTION_HEADER = /Section-[AB]\s*:(?:(?!Q\.\d)[\s\S])*/gi;
const QUESTION_MARKER = /Q\.(\d{1,3})\s+/g;
const ANSWER_MARKER = /Ans\.\s*\[([^\]]{1,24})\]/;

// Matrix and piecewise-brace art. When these survive into a stem the notation is already
// destroyed — "⎩ ⎨ ⎧ ≥+ < 1xbxa" was a piecewise function definition.
const BRACKET_ART = /[⎡⎣⎤⎦⎧⎨⎩⎢⎥⎪⌈⌉⌊⌋]/;

// A stacked fraction is 2D layout, not a script, so `lib/pdf-text.ts` cannot repair it: the
// numerator and denominator arrive as loose tokens somewhere else on the line. The damage is
// invisible in the options, so it has to be caught in the stem.
//
//   "arg (z1) = , arg(z2) = 0 and 4 π 22 2 arg(z3) = ."   <- was π/4
//
// Two signatures: an equals/operator with its value missing, and a drift of short bare
// tokens. Both are cheap to test and it is far better to drop a question than to publish one
// whose formula silently moved.
// Restricted to "=" on purpose. Comparison chains are ordinary chemistry ("Si < P < S"), and
// a trailing minus is ordinary prose, but an equals sign with nothing after it always means
// the value that belonged there was laid out as a stack and did not survive.
const ORPHANED_OPERATOR = /=\s*[,.;)]|=\s*$/;

// A run of 4+ bare short tokens. The digit requirement is what keeps legitimate labelled
// lists — "(A) Eu^(2+) (B) Gd^(3+)", "A-IV, B-I, C-III" — from being mistaken for drift:
// those carry letters and punctuation, while a collapsed fraction leaves loose numbers
// behind ("4 π 22 2").
const LOOSE_RUN = /(?:(?:^|\s)[A-Za-z0-9α-ωΑ-Ωπθ]{1,3}(?=\s|$)){4,}/g;

// A period floating between spaces is where a stacked fraction used to be: option 4 of
// "Which of the following is not true for radioactive decay" arrives as
// "Half life is ln 2 times of . rateconstant" — the "1/" of the fraction is simply gone.
const ORPHANED_PERIOD = /\s\.\s/;

function hasLooseTokenDrift(text: string) {
  for (const match of text.matchAll(LOOSE_RUN)) {
    const digitTokens = match[0].trim().split(/\s+/).filter((token) => /^\d+$/.test(token));
    if (digitTokens.length >= 2) return true;
  }
  return false;
}

// Applied to the stem AND every option. Checking only the stem misses the common case where
// the prose is intact and the damage is confined to one answer choice.
function looksMangled(text: string) {
  return (
    BRACKET_ART.test(text) ||
    ORPHANED_OPERATOR.test(text) ||
    ORPHANED_PERIOD.test(text) ||
    hasLooseTokenDrift(text)
  );
}
const DIAGRAM_REFERENCE =
  /\b(?:figure|fig\.|diagram|as shown|shown in|given circuit|following graph|graph shown)\b/i;

export function stripFurniture(text: string) {
  return text
    .replace(PAGE_FURNITURE, " ")
    .replace(SECTION_HEADER, " ")
    .replace(/JEE\s*Main\s*Online\s*(?:Exam|Paper)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Splits the flattened paper into its three subject runs. Falls back to one untitled run so
// a paper with an unexpected header still parses rather than yielding nothing.
function splitSubjects(text: string) {
  const found = SUBJECTS.map((subject) => ({ subject, index: text.indexOf(subject) })).filter(
    (entry) => entry.index >= 0
  );
  if (found.length === 0) return [{ subject: "", body: text }];

  found.sort((a, b) => a.index - b.index);
  return found.map((entry, i) => ({
    subject: titleCase(entry.subject),
    body: text.slice(entry.index + entry.subject.length, found[i + 1]?.index ?? text.length)
  }));
}

function titleCase(subject: string) {
  const label = subject.charAt(0) + subject.slice(1).toLowerCase();
  // "Mathematics" is the paper's word; the app and the bank use "Maths" everywhere else.
  return label === "Mathematics" ? "Maths" : label;
}

// Finds the adjacent option run. Two formats are in circulation: papers from 2023 on number
// their options "(1)".."(4)" with a numeric key ("Ans. [3]"), while 2022 and earlier letter
// them "(A)".."(D)" with a letter key ("Ans. [C]"). Handling only the numeric form silently
// routed every older paper into "malformed".
//
// Deliberately not "every (n) in the block": stems are full of coordinate pairs like
// "(1, 1) (2, 2), (3, 3)" and labelled sub-lists like "(A) Eu (B) Gd (C) Eu" that would
// hijack a naive split.
const OPTION_MARKER = /\(([1-4A-Da-d])\)\s/g;

function markerIndex(token: string) {
  return /\d/.test(token) ? Number(token) : token.toUpperCase().charCodeAt(0) - 64;
}

// Longest ascending 1..4 run; ties go to the LAST one, because the options always sit
// immediately before the key while a decoy sub-list sits earlier in the stem.
function longestRun(markers: RegExpMatchArray[]) {
  let run: RegExpMatchArray[] = [];
  let best: RegExpMatchArray[] = [];
  for (const marker of markers) {
    const index = markerIndex(marker[1]);
    const expected = run.length === 0 ? 1 : markerIndex(run[run.length - 1][1]) + 1;
    if (index === expected) run.push(marker);
    else run = index === 1 ? [marker] : [];
    if (run.length >= best.length) best = [...run];
  }
  return best;
}

function splitOptions(head: string) {
  const all = [...head.matchAll(OPTION_MARKER)];
  const numeric = longestRun(all.filter((m) => /\d/.test(m[1])));
  const lettered = longestRun(all.filter((m) => /[A-Da-d]/.test(m[1])));

  // A numbered run wins when present: in the modern format a lettered sub-list inside the
  // stem is a decoy, never the answer choices.
  const best = numeric.length >= 2 ? numeric : lettered;
  if (best.length < 2) return { stem: head.trim(), options: [], lettered: false };

  const start = best[0].index ?? 0;
  const options = best.map((marker, i) => {
    const from = (marker.index ?? 0) + marker[0].length;
    const to = i + 1 < best.length ? best[i + 1].index ?? head.length : head.length;
    return head.slice(from, to).trim();
  });

  return { stem: head.slice(0, start).trim(), options, lettered: best === lettered };
}

export function parseCareerPointPaper(rawText: string): CareerPointQuestion[] {
  const text = stripFurniture(rawText);
  const questions: CareerPointQuestion[] = [];

  for (const { subject, body } of splitSubjects(text)) {
    const markers = [...body.matchAll(new RegExp(QUESTION_MARKER))];

    for (let i = 0; i < markers.length; i += 1) {
      const marker = markers[i];
      const from = (marker.index ?? 0) + marker[0].length;
      const block = body.slice(from, markers[i + 1]?.index ?? body.length);

      // Everything from the key onward is the answer plus worked solution. Cutting at the
      // FIRST "Ans." matters — solutions frequently restate one ("Ans. (5)").
      const answerMatch = block.match(ANSWER_MARKER);
      if (!answerMatch) continue;

      const head = block.slice(0, answerMatch.index);
      const answerRaw = answerMatch[1].trim();
      const { stem, options } = splitOptions(head);

      // "Ans. [3]" is an option index; "Ans. [C]" is an option letter. Both resolve to the
      // same 1-based position.
      const index = /^[A-Da-d]$/.test(answerRaw)
        ? answerRaw.toUpperCase().charCodeAt(0) - 64
        : Number(answerRaw);
      const answerIndex =
        options.length > 0 && Number.isInteger(index) && index >= 1 && index <= options.length
          ? index
          : null;

      questions.push({
        number: Number(marker[1]),
        subject,
        // Section B stems end in the blank they ask the candidate to fill.
        stem: stem.replace(/_{2,}\.?\s*$/, "").trim(),
        options,
        answerIndex,
        answerRaw
      });
    }
  }

  return questions;
}

export function classifyCareerPointQuestion(question: CareerPointQuestion): CareerPointVerdict {
  if (question.stem.length < 20) return "malformed";
  if (looksMangled(question.stem) || question.options.some(looksMangled)) return "mangled-math";

  // No options at all is Section B — a numerical-value question, not a broken MCQ.
  if (question.options.length === 0) {
    return Number.isFinite(Number(question.answerRaw)) ? "numerical" : "malformed";
  }

  if (question.options.length !== 4) return "malformed";

  const bodies = question.options.map((o) => o.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""));
  if (bodies.some((b) => b.length === 0)) return "image-options";
  if (new Set(bodies).size < 4) return "image-options";

  if (question.answerIndex === null) return "malformed";
  if (DIAGRAM_REFERENCE.test(question.stem)) return "needs-diagram";

  return "clean";
}

export type CareerPointDraftOptions = {
  maxMarks: number;
  negativeMarks: number;
  // Section B questions have a known numeric answer but no options. The app has no
  // auto-graded numeric type, so they can only enter as subjective questions.
  includeNumerical: boolean;
};

export function toDraftQuestions(
  questions: CareerPointQuestion[],
  options: CareerPointDraftOptions
): DraftQuestion[] {
  const drafts: DraftQuestion[] = [];

  for (const question of questions) {
    const verdict = classifyCareerPointQuestion(question);

    if (verdict === "clean") {
      drafts.push({
        question_text: question.stem,
        question_type: "mcq",
        topic: question.subject || "General",
        options: question.options,
        // Stored as option TEXT, matching applyAnswerKey and what scoreMcqAnswer compares.
        correct_answer: question.options[(question.answerIndex ?? 1) - 1] ?? null,
        max_marks: options.maxMarks,
        negative_marks: options.negativeMarks,
        rubric: null
      });
      continue;
    }

    if (verdict === "numerical" && options.includeNumerical) {
      drafts.push({
        question_text: question.stem,
        question_type: "subjective",
        topic: question.subject || "General",
        options: null,
        correct_answer: null,
        max_marks: options.maxMarks,
        // Rubric is teacher-only — never served to students by get_student_test_questions —
        // so the official answer is safe to carry here as the marking guide.
        rubric: `Official answer: ${question.answerRaw}`,
        negative_marks: 0
      });
    }
  }

  return drafts;
}
