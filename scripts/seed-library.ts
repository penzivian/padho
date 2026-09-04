/**
 * Load extracted JEE questions into the SHARED question library (`bank_questions`,
 * `is_public = true`), so every teacher sees them in the paper builder's bank picker.
 *
 * Idempotent: rows are keyed by the same SHA-256 fingerprint the app uses
 * (`normalizeForFingerprint` over stem + options), and the unique index on
 * `(owner_teacher_id, fingerprint)` means re-running adds nothing.
 *
 * This writes rows that EVERY teacher on the platform can see, so it takes an explicit
 * --owner and refuses to guess.
 *
 * Usage:
 *   corepack pnpm@10.14.0 exec tsx scripts/seed-library.ts \
 *     --file ./jee-official-all.json --owner <profile-uuid> [--per-subject 100] [--dry-run]
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import { normalizeForFingerprint } from "../lib/question-bank";

type SourceQuestion = {
  question_text: string;
  question_type: "mcq" | "subjective";
  topic: string;
  subject?: string;
  options: string[] | null;
  correct_answer: string | null;
  max_marks: number;
  negative_marks?: number;
  rubric: string | null;
  source_label?: string;
};

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

// Picks the cleanest questions first. Extraction damage that survives the ingest classifiers
// is usually visible as an over-long stem, a stray one-character option, or near-duplicate
// options — so rank on those rather than taking whatever comes first in the file.
function quality(question: SourceQuestion) {
  const options = question.options ?? [];
  const stem = question.question_text.trim();
  let score = 0;

  // A stem that stands on its own: long enough to be a real question, short enough that it
  // did not swallow the next one.
  if (stem.length >= 40 && stem.length <= 400) score += 3;
  else if (stem.length > 400) score -= 2;

  if (options.length === 4) score += 2;
  if (options.every((option) => option.trim().length >= 1)) score += 1;
  if (new Set(options.map((o) => o.trim().toLowerCase())).size === options.length) score += 2;
  // Every option a single character is the signature of a formula that did not survive.
  if (options.every((option) => option.trim().length <= 2)) score -= 3;
  if (question.correct_answer?.trim()) score += 2;
  // Leftover layout debris.
  if (/\s\.\s|=\s*[,.)]/.test(stem)) score -= 4;
  if (/[⎡⎣⎤⎦⎧⎨⎩⎢⎥]/.test(stem)) score -= 5;

  return score;
}

async function main() {
  const file = arg("file");
  const owner = arg("owner");
  const perSubject = Number(arg("per-subject", "100"));
  const dryRun = process.argv.includes("--dry-run");

  if (!file || !owner) {
    console.error("Need --file <questions.json> and --owner <profile-uuid>.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // The owner must exist and be a teacher — bank_questions.owner_teacher_id references
  // profiles, and a bad id would fail late with an opaque FK error.
  const { data: profile } = await admin
    .from("profiles")
    .select("id,role,full_name")
    .eq("id", owner)
    .maybeSingle();

  if (!profile || profile.role !== "teacher") {
    console.error(`--owner ${owner} is not a teacher profile. Aborting.`);
    process.exit(1);
  }

  const all = JSON.parse(await readFile(file, "utf8")) as SourceQuestion[];

  const bySubject = new Map<string, SourceQuestion[]>();
  for (const question of all) {
    const subject = (question.subject || question.topic || "").trim();
    if (!subject) continue;
    if (question.question_type !== "mcq") continue;
    if (!question.correct_answer?.trim()) continue;
    bySubject.set(subject, [...(bySubject.get(subject) ?? []), question]);
  }

  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const [subject, questions] of [...bySubject.entries()].sort()) {
    const ranked = [...questions].sort((a, b) => quality(b) - quality(a));
    let taken = 0;

    for (const question of ranked) {
      if (taken >= perSubject) break;

      const options = question.options ?? [];
      if (options.length < 2) continue;

      const fingerprint = createHash("sha256")
        .update(
          normalizeForFingerprint({
            questionText: question.question_text,
            questionType: question.question_type,
            options
          })
        )
        .digest("hex");

      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);

      const maxMarks = Math.max(0.5, Number(question.max_marks) || 1);
      rows.push({
        owner_teacher_id: owner,
        question_text: question.question_text.trim(),
        question_type: "mcq",
        // No finer topic exists in these papers, so topic mirrors the subject. The picker
        // hides the duplicate rather than rendering "Physics · Physics".
        topic: subject,
        subject,
        options,
        correct_answer: question.correct_answer,
        max_marks: maxMarks,
        negative_marks: Math.min(Math.max(Number(question.negative_marks) || 0, 0), maxMarks),
        rubric: question.rubric ?? null,
        source_label: question.source_label ?? "JEE Main",
        difficulty: null,
        is_public: true,
        fingerprint
      });
      taken += 1;
    }

    console.log(`${subject.padEnd(12)} ${taken} selected of ${questions.length} available`);
  }

  if (dryRun) {
    console.log(`\nDRY RUN — ${rows.length} rows prepared, nothing written.`);
    console.log("Sample:", JSON.stringify(rows[0], null, 2).slice(0, 600));
    return;
  }

  // Chunked so one oversized request cannot fail the whole load.
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data, error } = await admin
      .from("bank_questions")
      .upsert(chunk, { onConflict: "owner_teacher_id,fingerprint", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error(`Chunk ${i / 100 + 1} failed: ${error.message}`);
      process.exit(1);
    }
    inserted += data?.length ?? 0;
  }

  console.log(`\n${inserted} new rows published to the shared library (${rows.length} submitted).`);
}

main();
