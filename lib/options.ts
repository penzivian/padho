// One place that understands what is inside a question's `options` jsonb column.
//
// Options started life as a plain `string[]`, and every paper saved so far stores them that
// way. Diagram-based answers (four graphs as the four choices) need a per-option image, so the
// column is widening to `{ text, image_path }[]`. Both shapes exist in the database at once and
// always will — there is no migration that rewrites old papers, and none is needed:
// `questions_mcq_shape` only checks `jsonb_typeof(options) = 'array'`, so objects satisfy the
// existing constraint unchanged.
//
// Six call sites used to each re-implement `typeof option === "string"`. They now all come
// through here, so widening the shape is a change to this module rather than a hunt.

export type QuestionOption = {
  text: string;
  image_path: string | null;
};

// "A", "B", "C" … the label a paper prints and a pasted answer key refers to.
export function optionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

// Parse the raw jsonb into a uniform shape. Deliberately lenient — a malformed row must render
// as best it can rather than take down the paper, which is the same rule the diagram signing
// path follows.
export function normalizeOptions(raw: unknown): QuestionOption[] {
  if (!Array.isArray(raw)) return [];

  const options: QuestionOption[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      // Legacy shape. Empty strings are kept: that is what the old call sites did, and a paper
      // that already has one should keep rendering exactly as it did before.
      options.push({ text: entry, image_path: null });
      continue;
    }

    if (!entry || typeof entry !== "object") continue;

    const record = entry as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text : "";
    const imagePath =
      typeof record.image_path === "string" && record.image_path ? record.image_path : null;

    // Neither text nor a diagram is not an option, it is junk.
    if (!text && !imagePath) continue;

    // An image-only option still needs a label: `correct_answer` stores the option's TEXT and
    // scoring compares strings, so two blank options would be indistinguishable and would
    // silently mis-score. The builder fills the letter in on save; this is the read-side net
    // for any row that slipped through without one.
    options.push({ text: text || optionLabel(options.length), image_path: imagePath });
  }

  return options;
}

// The plain strings, for everything that still works in text: matching `correct_answer`,
// applying a pasted answer key, and the bank fingerprint (which must ignore images entirely,
// so that the same question re-cropped still dedupes to one row).
export function optionTexts(raw: unknown): string[] {
  return normalizeOptions(raw).map((option) => option.text);
}

// An option resolved for rendering: the stored path plus a short-lived signed URL, minted the
// same way question diagrams are — server-side, only after the caller has passed the gate that
// protects question text. The raw path is never fetchable directly.
export type SignedQuestionOption = QuestionOption & { image_url: string | null };

// Every option image path across a set of questions, for one batched signing call.
export function collectOptionImagePaths(rawOptions: unknown[]): (string | null)[] {
  return rawOptions.flatMap((raw) => normalizeOptions(raw).map((option) => option.image_path));
}

// A missing or unsignable option diagram must never take down the paper — it renders as text,
// exactly as signQuestionImages does for the question-level image.
export function signOptions(raw: unknown, signed: Map<string, string>): SignedQuestionOption[] {
  return normalizeOptions(raw).map((option) => ({
    ...option,
    image_url: option.image_path ? (signed.get(option.image_path) ?? null) : null
  }));
}
