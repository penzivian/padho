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
const OPTION_MARKER = /\(?([A-Ea-e])[).]\s+/g;
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
    markers.push({ letter: match[1].toUpperCase(), start: match.index, end: re.lastIndex });
  }

  if (markers.length < 2 || markers[0].letter !== "A") {
    return { questionText: block.trim(), options: [] };
  }

  const questionText = block.slice(0, markers[0].start).trim();
  const options = markers.map((marker, index) => {
    const textEnd = index + 1 < markers.length ? markers[index + 1].start : block.length;
    return { letter: marker.letter, text: block.slice(marker.end, textEnd).trim() };
  });
  return { questionText, options };
}

function toDraftQuestion(block: string, answerLetter?: string): DraftQuestion | null {
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
      options: options.map((option) => option.text),
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

export function extractDraftQuestions(text: string): DraftQuestion[] {
  if (!text || !text.trim()) return [];

  // Collapse all whitespace (PDF extraction often drops/garbles newlines) into single spaces.
  const flat = text.replace(/\s+/g, " ").trim();

  // Split off an answer-key section, if the document includes one.
  const keyMatch = ANSWER_KEY_SPLIT.exec(flat);
  const body = keyMatch ? flat.slice(0, keyMatch.index) : flat;
  const answerKey = keyMatch ? parseAnswerKey(flat.slice(keyMatch.index)) : {};

  // Keep only sequentially-numbered markers (1, 2, 3, ...) so stray "N." inside a stem is ignored.
  const markers: { number: number; index: number; end: number }[] = [];
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
    return { ...question, correct_answer: question.options[optionIndex] };
  });
}
