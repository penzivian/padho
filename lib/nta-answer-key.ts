// Parser for NTA's official Final Answer Key PDFs.
//
// The key is a TABLE, and that is the whole difficulty. Reading it as a stream of text welds
// the columns together — "6911213" and "69112..." arrive as the single token "691121369112" —
// which is why a naive read finds zero matches against the question paper. Cells have to be
// grouped by their x position, so this module works on positioned cells rather than a string.
//
// Two layouts are in circulation, and both appear in the 2026 cycle alone:
//
//   Session 2:  QUESTION ID | CORRECT OPTION ID        -> the answer is an OPTION ID
//   Session 1:  Domestic | International | Correct Answer -> the answer is a POSITION (1-4)
//
// The option-id form is the better one and worth preferring where both exist: NTA shuffles
// option order per candidate ("Option Shuffling : Yes" in every paper), so a position is only
// meaningful against one candidate's rendering, while an option id names the option itself.
//
// Each PDF covers every shift of a session, so rows are grouped under an "Exam Date / Exam
// Shift" header and a paper must be matched to its own section.

export type KeyCell = { text: string; x: number; y: number; page: number };

export type NtaAnswer =
  | { kind: "optionId"; questionId: string; optionId: string }
  | { kind: "position"; questionId: string; position: number };

export type NtaKeySection = {
  examDate: string | null;
  shift: string | null;
  answers: NtaAnswer[];
};

// Question and option ids are long numeric strings; positions are a single digit 1-4.
const ID = /^\d{6,12}$/;
const POSITION = /^[1-4]$/;
const HEADER_OPTION_ID = /correct\s*option\s*id/i;
const HEADER_POSITION = /correct\s*answer/i;
const EXAM_DATE = /Exam\s*Date\s*:?\s*([\d.\-/]+)/i;
const EXAM_SHIFT = /Exam\s*Shift\s*:?\s*([\w-]+)/i;

// Cells within this many points of each other sit on the same printed row. The tables are
// ~23pt apart, so the tolerance is generous without merging neighbours.
const ROW_TOLERANCE = 6;

function groupRows(cells: KeyCell[]) {
  const sorted = [...cells].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const rows: KeyCell[][] = [];

  for (const cell of sorted) {
    const current = rows[rows.length - 1];
    const head = current?.[0];
    if (head && head.page === cell.page && Math.abs(head.y - cell.y) <= ROW_TOLERANCE) {
      current.push(cell);
    } else {
      rows.push([cell]);
    }
  }

  return rows.map((row) => [...row].sort((a, b) => a.x - b.x));
}

// A data row is a repeat of the same shape across the three subject column-groups, so the
// answers fall out of reading the cells in x order and consuming them in pairs or triples.
function readRow(row: KeyCell[], layout: "optionId" | "position"): NtaAnswer[] {
  const answers: NtaAnswer[] = [];
  const cells = row.map((cell) => cell.text.trim());

  if (layout === "optionId") {
    // QUESTION ID, CORRECT OPTION ID, repeated.
    for (let i = 0; i + 1 < cells.length; i += 2) {
      if (ID.test(cells[i]) && ID.test(cells[i + 1])) {
        answers.push({ kind: "optionId", questionId: cells[i], optionId: cells[i + 1] });
      }
    }
    return answers;
  }

  // Domestic, International, Correct Answer, repeated. The domestic id is the one the
  // question paper uses; the international id is a parallel numbering we do not need.
  for (let i = 0; i + 2 < cells.length; i += 3) {
    if (ID.test(cells[i]) && ID.test(cells[i + 1]) && POSITION.test(cells[i + 2])) {
      answers.push({ kind: "position", questionId: cells[i], position: Number(cells[i + 2]) });
    }
  }
  return answers;
}

export function parseNtaAnswerKey(cells: KeyCell[]): NtaKeySection[] {
  const rows = groupRows(cells);
  const sections: NtaKeySection[] = [];
  let layout: "optionId" | "position" = "optionId";

  for (const row of rows) {
    const line = row.map((cell) => cell.text).join(" ");

    // A header row switches the layout for everything that follows it.
    if (HEADER_OPTION_ID.test(line)) {
      layout = "optionId";
      continue;
    }
    if (HEADER_POSITION.test(line)) {
      layout = "position";
      continue;
    }

    const date = line.match(EXAM_DATE);
    const shift = line.match(EXAM_SHIFT);
    if (date || shift) {
      sections.push({ examDate: date?.[1] ?? null, shift: shift?.[1] ?? null, answers: [] });
      continue;
    }

    const answers = readRow(row, layout);
    if (answers.length === 0) continue;

    // Rows can precede any header when a section starts on a fresh page.
    if (sections.length === 0) sections.push({ examDate: null, shift: null, answers: [] });
    sections[sections.length - 1].answers.push(...answers);
  }

  return sections.filter((section) => section.answers.length > 0);
}

// Flattens every section into one lookup. Question ids are unique per shift across a whole
// session, so collapsing the sections is safe and saves callers from matching a paper to its
// section by date — the paper's own ids only ever hit their own rows.
export function buildAnswerLookup(sections: NtaKeySection[]) {
  const byOptionId = new Map<string, string>();
  const byPosition = new Map<string, number>();

  for (const section of sections) {
    for (const answer of section.answers) {
      if (answer.kind === "optionId") byOptionId.set(answer.questionId, answer.optionId);
      else byPosition.set(answer.questionId, answer.position);
    }
  }

  return { byOptionId, byPosition };
}
