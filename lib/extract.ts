import type { DraftQuestion } from "@/lib/ai";

// Pure, testable heuristics that turn raw question-paper text (typically extracted from a PDF,
// where line breaks are usually lost) into editable draft questions. It works on a continuous
// text stream by locating numbered question markers and lettered option markers, not newlines.
// Deliberately conservative: it only emits sequentially-numbered questions and leaves anything
// ambiguous for the teacher to fix in Review.
//
// Question numbering: "1. ", "1) ", "Q1. ", "Q1) ", "Q.1) " (optional "Q"/"Q." prefix, then the
// number, then "." or ")"). Options: "A) ", "(A) ", "A. ", and their lowercase forms.
const QUESTION_MARKER = /(?:[Qq]\.?\s*)?(\d{1,3})[.)]\s+/g;
// Group 1 is a leading boundary (start-of-string or a non-letter) that keeps prose
// like "etc. " / "Ltd. " / "Inc. " from registering as an option marker now that a
// bare "c." form is accepted. Captured rather than a lookbehind so the regex also
// parses on older browser engines — this module is imported by a client component.
const OPTION_MARKER = /(^|[^A-Za-z])\(?([A-Ea-e])[).]\s+/g;
const ANSWER_KEY_SPLIT = /\banswer\s*key\b/i;

type RawOption = { letter: string; text: string };

function letterIndex(letter: string) {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

// Parse compact answer keys like "1. B  2) C  3 - A" into { 1: "B", 2: "C", 3: "A" }.
export function parseAnswerKey(text: string): Record<number, string> {
  const result: Record<number, string> = {};
  const pairRe = /(\d{1,3})\s*[).:\-]?\s*\(?([A-Ea-e])\)?(?=\s|$|,|;)/g;
  let match: RegExpExecArray | null;
  while ((match = pairRe.exec(text)) !== null) {
    result[Number(match[1])] = match[2].toUpperCase();
  }
  return result;
}

// Split a question block into its stem and its options. Options must start at "A" and have at
// least two entries, otherwise the block is treated as a subjective question.
function splitOptions(block: string): { questionText: string; options: RawOption[] } {
  const markers: { letter: string; start: number; end: number }[] = [];
  const re = new RegExp(OPTION_MARKER.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) {
    // Skip the captured boundary char so the marker starts at "(" / the letter.
    markers.push({
      letter: match[2].toUpperCase(),
      start: match.index + match[1].length,
      end: re.lastIndex
    });
  }

  // Take the longest run of *adjacent* markers lettered A, B, C, … rather than
  // anchoring on the first "A": a stem can legitimately contain "'A. Rao" or "(a)"
  // before the real option block, and that would otherwise hijack the split.
  let best: typeof markers = [];
  for (let i = 0; i < markers.length; i += 1) {
    if (markers[i].letter !== "A") continue;
    const run = [markers[i]];
    for (let j = i + 1; j < markers.length; j += 1) {
      if (letterIndex(markers[j].letter) !== run.length) break;
      run.push(markers[j]);
    }
    if (run.length > best.length) best = run;
  }

  if (best.length < 2) {
    return { questionText: block.trim(), options: [] };
  }

  const questionText = block.slice(0, best[0].start).trim();
  const options = best.map((marker, index) => {
    const textEnd = index + 1 < best.length ? best[index + 1].start : block.length;
    return { letter: marker.letter, text: block.slice(marker.end, textEnd).trim() };
  });
  return { questionText, options };
}

// Structural furniture that sits *between* questions and would otherwise be swallowed
// by the preceding question's last option: difficulty tags ("[ Hard ]"), section
// headers ("SECTION B | AML / KYC ..."), and end-of-paper rules. Uppercase-only
// SECTION and 2+ dashes keep prose ("Section 5 of the Act", "analysts — Kiran")
// from being truncated.
// `[\s\S]*` rather than `.*` + the /s flag, which needs an ES2018 target.
const TRAILING_NOISE = [
  /\s*\[\s*(?:very\s+)?(?:easy|medium|hard|difficult)\s*\]\s*$/i,
  /\s*SECTION\s+[A-Z0-9]+\s*[|(:–—-][\s\S]*$/,
  /\s*END\s+OF\s+(?:THE\s+)?(?:QUESTION\s+)?PAPER[\s\S]*$/i,
  /\s*[—–]{2,}[\s\S]*$/
];

function stripBlockNoise(block: string): string {
  let out = block.trim();
  for (let pass = 0; pass < 5; pass += 1) {
    const before = out;
    for (const re of TRAILING_NOISE) out = out.replace(re, "").trim();
    if (out === before) break;
  }
  return out;
}

function toDraftQuestion(rawBlock: string, answerLetter?: string): DraftQuestion | null {
  const block = stripBlockNoise(rawBlock);
  const { questionText, options } = splitOptions(block);
  if (!questionText) return null;

  if (options.length >= 2) {
    const correct = answerLetter
      ? options.find((option) => option.letter === answerLetter)?.text ?? null
      : null;
    return {
      question_text: questionText,
      question_type: "mcq",
      topic: "General",
      options: options.map((option) => ({ text: option.text, image_path: null })),
      correct_answer: correct,
      max_marks: 1,
      rubric: null
    };
  }

  return {
    question_text: questionText,
    question_type: "subjective",
    topic: "General",
    options: null,
    correct_answer: null,
    max_marks: 2,
    rubric: null
  };
}

type QuestionMarker = { number: number; index: number; end: number };

// Locate sequentially-numbered question markers (1, 2, 3, …) so a stray "N." inside
// a stem, a cover page, or an instructions block can't start or derail the sequence.
function findQuestionMarkers(body: string): QuestionMarker[] {
  const markers: QuestionMarker[] = [];
  const re = new RegExp(QUESTION_MARKER.source, "g");
  let match: RegExpExecArray | null;
  let expected = 1;
  while ((match = re.exec(body)) !== null) {
    const number = Number(match[1]);
    if (number === expected) {
      markers.push({ number, index: match.index, end: re.lastIndex });
      expected += 1;
    }
  }
  return markers;
}

// Split off a trailing answer-key section — but only a real one. Papers routinely
// *mention* the phrase in their instructions ("the answer key is supplied as a
// separate document"), and splitting there would discard the entire paper. So a
// candidate only counts when questions already precede it and the text after it
// actually parses as a key.
function splitAnswerKeySection(flat: string): { body: string; answerKey: Record<number, string> } {
  const re = new RegExp(ANSWER_KEY_SPLIT.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(flat)) !== null) {
    const before = flat.slice(0, match.index);
    const answerKey = parseAnswerKey(flat.slice(match.index));
    if (findQuestionMarkers(before).length > 0 && Object.keys(answerKey).length >= 2) {
      return { body: before, answerKey };
    }
  }
  return { body: flat, answerKey: {} };
}

export function extractDraftQuestions(text: string): DraftQuestion[] {
  if (!text || !text.trim()) return [];

  // Collapse all whitespace (PDF extraction often drops/garbles newlines) into single spaces.
  const flat = text.replace(/\s+/g, " ").trim();

  const { body, answerKey } = splitAnswerKeySection(flat);
  const markers = findQuestionMarkers(body);

  const questions: DraftQuestion[] = [];
  for (let i = 0; i < markers.length; i += 1) {
    const start = markers[i].end;
    const finish = i + 1 < markers.length ? markers[i + 1].index : body.length;
    const question = toDraftQuestion(body.slice(start, finish), answerKey[markers[i].number]);
    if (question) questions.push(question);
  }
  return questions;
}

// Apply a pasted answer key ("1:B, 2:C") to draft questions by position, filling the correct
// option for each MCQ. Non-MCQ rows and out-of-range letters are left untouched.
export function applyAnswerKey(questions: DraftQuestion[], keyText: string): DraftQuestion[] {
  const key = parseAnswerKey(keyText);
  return questions.map((question, index) => {
    const letter = key[index + 1];
    if (!letter || question.question_type !== "mcq" || !question.options) return question;
    const optionIndex = letterIndex(letter);
    if (optionIndex < 0 || optionIndex >= question.options.length) return question;
    return { ...question, correct_answer: question.options[optionIndex].text };
  });
}
