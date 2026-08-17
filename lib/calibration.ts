// Grading calibration — pure logic, following the lib/ convention: actions orchestrate,
// this computes.
//
// When suggesting a mark for a subjective answer, we show the model answers to the SAME
// question that this teacher has already approved. Over a term the suggestions converge on
// that teacher's actual standard instead of a generic rubric reading.
//
// This only improves the suggestion. A teacher still approves before `awarded_marks` and a
// snapshot are written — see the subjective-grading guardrail.

export type ApprovedAnswer = {
  id: string;
  answerText: string;
  awardedMarks: number;
};

export type CalibrationExample = ApprovedAnswer;

export type SelectCalibrationOptions = {
  limit?: number;
  maxAnswerChars?: number;
};

// Below this a "spread" is really one or two idiosyncratic marks, which anchors the model
// harder than no examples at all.
export const MIN_CALIBRATION_EXAMPLES = 3;

const DEFAULT_LIMIT = 6;
const DEFAULT_MAX_ANSWER_CHARS = 1200;

// -0 guard, same class as the one in scoreMcqAnswer: -Math.abs(0) produces -0, and it
// survives into JSON and the database, where it renders as "-0".
export function sanitizeMark(mark: number) {
  return mark === 0 ? 0 : mark;
}

// Pick a spread of approved answers across the mark range.
//
// The naive version of this — "take the k most recent approved marks" — is wrong in a way
// that is easy to miss: on a question most of the batch did well on, every sample sits at
// full marks and the model learns "award full marks". Bucketing by mark band and taking
// round-robin across bands is the whole point of this function.
//
// Deterministic: ties break by id, so the same inputs always produce the same suggestion.
export function selectCalibrationExamples(
  approved: ApprovedAnswer[],
  maxMarks: number,
  options: SelectCalibrationOptions = {}
): CalibrationExample[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const maxAnswerChars = options.maxAnswerChars ?? DEFAULT_MAX_ANSWER_CHARS;

  if (limit <= 0 || maxMarks <= 0) return [];

  const usable = approved
    .filter((answer) => answer.answerText.trim().length > 0)
    .filter((answer) => Number.isFinite(answer.awardedMarks))
    // Defensive only: the query filters to subjective questions, whose marks floor at 0, so
    // the negative marks introduced in 0008 cannot reach here. Kept so that a future caller
    // widening the query fails safe — without it a negative mark falls outside every band
    // and is silently dropped. Clamping also repairs a stale mark left by a max_marks edit.
    .map((answer) => ({
      ...answer,
      awardedMarks: clamp(answer.awardedMarks, 0, maxMarks)
    }));

  if (usable.length === 0) return [];

  const bandCount = Math.max(1, limit);
  const bands: ApprovedAnswer[][] = Array.from({ length: bandCount }, () => []);

  for (const answer of usable) {
    const ratio = answer.awardedMarks / maxMarks;
    // min() keeps a full-mark answer in the top band rather than one past the end.
    const index = Math.min(bandCount - 1, Math.floor(ratio * bandCount));
    bands[index].push(answer);
  }

  for (const band of bands) {
    band.sort((a, b) => a.awardedMarks - b.awardedMarks || a.id.localeCompare(b.id));
  }

  // Round-robin across bands so breadth is exhausted before depth.
  const picked: ApprovedAnswer[] = [];
  let exhausted = false;
  while (picked.length < limit && !exhausted) {
    exhausted = true;
    for (const band of bands) {
      if (picked.length >= limit) break;
      const next = band.shift();
      if (next) {
        picked.push(next);
        exhausted = false;
      }
    }
  }

  return picked
    .sort((a, b) => a.awardedMarks - b.awardedMarks || a.id.localeCompare(b.id))
    .map((answer) => ({
      id: answer.id,
      answerText: truncate(answer.answerText.trim(), maxAnswerChars),
      awardedMarks: sanitizeMark(answer.awardedMarks)
    }));
}

export function formatCalibrationBlock(examples: CalibrationExample[], maxMarks: number) {
  if (examples.length === 0) return "";

  const rendered = examples
    .map(
      (example, index) =>
        `Example ${index + 1} — awarded ${formatMark(example.awardedMarks)} / ${formatMark(maxMarks)}\n${example.answerText}`
    )
    .join("\n\n");

  return [
    "Previously marked answers to this exact question, approved by this teacher.",
    "Match their standard — how strictly they award partial credit, what they",
    "accept as a complete method, and where they draw the line between bands.",
    "",
    rendered
  ].join("\n");
}

// Guards the prompt against being anchored by too little signal. When this is false the
// caller emits no block at all and the prompt is byte-for-byte what it is today, which is
// what makes the feature safe to leave on globally instead of behind a flag.
export function hasUsefulCalibration(examples: CalibrationExample[]) {
  if (examples.length < MIN_CALIBRATION_EXAMPLES) return false;
  return new Set(examples.map((example) => example.awardedMarks)).size > 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function truncate(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function formatMark(mark: number) {
  return String(sanitizeMark(Math.round(mark * 100) / 100));
}
