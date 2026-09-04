// Structure parser for NTA's official JEE Main question paper PDFs.
//
// These are exam-engine exports, not documents. The PDF carries the full skeleton as text —
// question numbers, question ids, types, section names, option ids — and NOT ONE WORD of the
// questions themselves. Every stem and every option is an embedded image:
//
//   Question Number : 1  Question Id : 6911211  Question Type : MCQ
//   Option Shuffling : Yes  ...  Options : 6911211. 6911212. 6911213. 6911214.
//
// So this module recovers the skeleton and the ids, and `scripts/ingest-nta.ts` pairs those
// ids with the images laid out beside them. The ids are what make the whole approach worth
// it: they join to NTA's own Final Answer Key exactly (75 of 75 on the papers checked), so
// the answers are the official ones rather than a third party's transcription.

export type NtaPaperQuestion = {
  questionNumber: number;
  questionId: string;
  questionType: string;
  subject: string;
  section: string;
  optionIds: string[];
};

export type NtaPaperMeta = {
  paperName: string | null;
  creationDate: string | null;
};

const QUESTION_BLOCK = /Question Number\s*:\s*(\d+)\s*Question Id\s*:\s*(\d+)/g;
const QUESTION_TYPE = /Question Type\s*:\s*([A-Z ]+?)(?=\s+[A-Z][a-z])/;
const OPTIONS_LIST = /Options\s*:\s*([\d.\s]+)/;
const PAPER_NAME = /Question Paper Name\s*:\s*(.+?)\s*Subject Name/;
const CREATION_DATE = /Creation Date\s*:\s*([\d-]+\s[\d:]+)/;

// Subject and section headings appear between question blocks.
const SUBJECT = /\b(Mathematics|Physics|Chemistry)\b/gi;
const SECTION = /\bSection\s+([AB])\b/gi;

export function parseNtaPaperMeta(text: string): NtaPaperMeta {
  const flat = text.replace(/\s+/g, " ");
  return {
    paperName: flat.match(PAPER_NAME)?.[1]?.trim() ?? null,
    creationDate: flat.match(CREATION_DATE)?.[1]?.trim() ?? null
  };
}

// Tracks the most recent subject/section heading seen before each question, so every question
// carries the topic the bank needs without guessing.
function headingsBefore(flat: string, upTo: number) {
  let subject = "";
  let section = "";
  for (const match of flat.slice(0, upTo).matchAll(SUBJECT)) {
    const label = match[0].toLowerCase();
    subject = label === "mathematics" ? "Maths" : label[0].toUpperCase() + label.slice(1);
  }
  for (const match of flat.slice(0, upTo).matchAll(SECTION)) section = match[1].toUpperCase();
  return { subject, section };
}

export function parseNtaPaper(text: string): NtaPaperQuestion[] {
  const flat = text.replace(/\s+/g, " ");
  const blocks = [...flat.matchAll(QUESTION_BLOCK)];
  const questions: NtaPaperQuestion[] = [];

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const from = block.index ?? 0;
    const to = blocks[i + 1]?.index ?? flat.length;
    const body = flat.slice(from, to);

    const { subject, section } = headingsBefore(flat, from);

    // "Options : 6911211. 6911212. 6911213. 6911214." — ids are period-terminated. A
    // numerical (Section B) question has no Options line at all.
    const optionIds = (body.match(OPTIONS_LIST)?.[1] ?? "")
      .split(".")
      .map((id) => id.trim())
      .filter((id) => /^\d{5,12}$/.test(id));

    questions.push({
      questionNumber: Number(block[1]),
      questionId: block[2],
      questionType: body.match(QUESTION_TYPE)?.[1]?.trim() ?? "",
      subject,
      section,
      optionIds
    });
  }

  return questions;
}

// An MCQ carries four option ids; Section B numerical questions carry none. Anything else is
// a paper we do not understand and should not silently import.
export function isMcq(question: NtaPaperQuestion) {
  return question.optionIds.length === 4;
}

// Resolves the official key to a 1-based option position for a given question.
//
// The option-id form is authoritative and tried first. The position form is a fallback and
// carries a real caveat: NTA shuffles option order per candidate, so a bare position is only
// meaningful against the ordering in this specific PDF.
export function resolveAnswerPosition(
  question: NtaPaperQuestion,
  lookup: { byOptionId: Map<string, string>; byPosition: Map<string, number> }
): number | null {
  const optionId = lookup.byOptionId.get(question.questionId);
  if (optionId) {
    const index = question.optionIds.indexOf(optionId);
    if (index >= 0) return index + 1;
    // The key names an option this question does not have — a mismatched paper/key pairing.
    return null;
  }

  const position = lookup.byPosition.get(question.questionId);
  if (position && position >= 1 && position <= question.optionIds.length) return position;
  return null;
}

// ---------------------------------------------------------------- image pairing

// The paper's layout is strictly regular, which is what makes the images recoverable:
//
//   IMG  883x103            <- the stem
//   txt  "Options :"
//   txt  "6911215."   IMG   <- an option id and its image, on the SAME baseline
//   txt  "6911216."   IMG
//   txt  "Question Number : 3  Question Id : ..."   <- next question starts
//
// So a stem is "images after a question marker but before Options:", and an option image is
// the one printed level with its id.
export type NtaLayoutItem =
  | { type: "question"; questionId: string; page: number; y: number }
  | { type: "optionsMarker"; page: number; y: number }
  | { type: "optionId"; optionId: string; page: number; y: number }
  | { type: "image"; ref: string; width: number; height: number; page: number; y: number };

export type NtaQuestionImages = {
  stem: { ref: string; width: number; height: number }[];
  options: Map<string, { ref: string; width: number; height: number }>;
};

// An option id and its image are printed on one baseline, but they are separate PDF objects
// whose y values differ by a couple of points depending on glyph metrics.
const BASELINE_TOLERANCE = 12;

export function pairNtaImages(items: NtaLayoutItem[]) {
  const ordered = [...items].sort((a, b) => a.page - b.page || b.y - a.y);
  const result = new Map<string, NtaQuestionImages>();

  let questionId: string | null = null;
  let inOptions = false;
  let pendingIds: { optionId: string; y: number; page: number }[] = [];
  let pendingImages: { ref: string; width: number; height: number; y: number; page: number }[] = [];

  const flush = () => {
    if (!questionId) return;
    const entry = result.get(questionId);
    if (!entry) return;
    // Pair each option id with the nearest image on its baseline, consuming as we go so two
    // ids can never claim the same picture.
    const available = [...pendingImages];
    for (const id of pendingIds) {
      let bestIndex = -1;
      let bestDistance = Infinity;
      for (let i = 0; i < available.length; i += 1) {
        if (available[i].page !== id.page) continue;
        const distance = Math.abs(available[i].y - id.y);
        if (distance < bestDistance && distance <= BASELINE_TOLERANCE) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      if (bestIndex >= 0) {
        const [image] = available.splice(bestIndex, 1);
        entry.options.set(id.optionId, {
          ref: image.ref,
          width: image.width,
          height: image.height
        });
      }
    }
    pendingIds = [];
    pendingImages = [];
  };

  for (const item of ordered) {
    if (item.type === "question") {
      flush();
      questionId = item.questionId;
      inOptions = false;
      result.set(questionId, { stem: [], options: new Map() });
      continue;
    }

    if (!questionId) continue;

    if (item.type === "optionsMarker") {
      inOptions = true;
      continue;
    }

    if (item.type === "optionId") {
      pendingIds.push({ optionId: item.optionId, y: item.y, page: item.page });
      continue;
    }

    if (inOptions) {
      pendingImages.push({
        ref: item.ref,
        width: item.width,
        height: item.height,
        y: item.y,
        page: item.page
      });
    } else {
      result.get(questionId)?.stem.push({
        ref: item.ref,
        width: item.width,
        height: item.height
      });
    }
  }

  flush();
  return result;
}
