// Question bank — pure logic. Actions orchestrate; this computes.

export type BankCandidate = {
  questionText: string;
  questionType: "mcq" | "subjective";
  options: string[] | null;
};

// Normalized form used to decide "this is the same question I already have".
//
// Deliberately aggressive: case, punctuation, whitespace and option ORDER are all discarded,
// because the same question re-extracted from a different PDF rarely comes back byte-identical.
// Options are included because two questions can share a stem ("Which of the following is
// correct?") and differ only in their options.
export function normalizeForFingerprint(candidate: BankCandidate) {
  const stem = normalizeText(candidate.questionText);
  const options = (candidate.options ?? [])
    .map(normalizeText)
    .filter(Boolean)
    .sort()
    .join("|");

  return options ? `${stem}::${options}` : stem;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    // Apostrophes are DELETED rather than turned into a space: "Newton's" and "Newtons" are
    // the same question, and extraction is inconsistent about the character (' vs ' vs none).
    // Replacing with a space would split it into "newton s" and defeat the whole comparison.
    .replace(/['’‘`]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // remaining punctuation to space, any script kept
    .replace(/\s+/g, " ")
    .trim();
}

// `topic` is free text and drives every analytic in the app, so the bank groups
// case-insensitively while preserving whatever label the teacher actually typed.
export function topicKey(topic: string) {
  return topic.trim().toLowerCase();
}

// Collapses topic variants to the label used most often, so a bank filter offers
// "Kinematics" once rather than three near-identical entries.
export function groupTopics(topics: string[]) {
  const byKey = new Map<string, Map<string, number>>();

  for (const topic of topics) {
    const key = topicKey(topic);
    if (!key) continue;
    const label = topic.trim();
    const labels = byKey.get(key) ?? new Map<string, number>();
    labels.set(label, (labels.get(label) ?? 0) + 1);
    byKey.set(key, labels);
  }

  return [...byKey.entries()]
    .map(([key, labels]) => {
      const total = [...labels.values()].reduce((sum, count) => sum + count, 0);
      // Most-used label wins. On a tie prefer a normally-capitalised label ("Kinematics")
      // over "KINEMATICS" or "kinematics", since this is what a teacher sees in the filter;
      // alphabetical last so the result never depends on input order.
      const label = [...labels.entries()].sort(
        (a, b) =>
          b[1] - a[1] ||
          labelShapeRank(a[0]) - labelShapeRank(b[0]) ||
          a[0].localeCompare(b[0])
      )[0][0];
      return { key, label, count: total };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// Postgres websearch_to_tsquery handles quoted phrases and OR itself; this only guards
// against an empty/punctuation-only query reaching the database as a filter that matches
// everything or errors.
export function sanitizeSearchTerm(raw: string) {
  const cleaned = raw.replace(/[^\p{L}\p{N}\s"']/gu, " ").replace(/\s+/g, " ").trim();
  return cleaned.length >= 2 ? cleaned : "";
}

// 0 = Title Case, 1 = anything else. Used only to pick the nicest label among ties.
function labelShapeRank(label: string) {
  const isAllUpper = label === label.toUpperCase();
  const isAllLower = label === label.toLowerCase();
  return !isAllUpper && !isAllLower ? 0 : 1;
}
