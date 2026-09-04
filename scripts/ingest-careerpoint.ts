/**
 * Pull official JEE Main papers from Career Point (cms.careerpoint.ac.in) and turn them into
 * draft questions for the shared library (`publishToLibraryAction`).
 *
 * Prefer this over `ingest-vedantu.ts`. Vedantu publishes memory-based reconstructions whose
 * distractors are invented — on 22 Jan 2025 Maths Q3 it lists 20/21/22/23 where the real
 * options are 24/19/21/22. Career Point publishes the actual paper: one PDF per shift with
 * all three subjects, 20 MCQs plus 5 numerical questions each, and a worked solution.
 *
 * Text is read through `lib/pdf-text.ts` rather than unpdf's `extractText`, so exponents and
 * indices survive as "e^2" / "10^(-4)" / "Z_1" instead of flattening to "e2" / "10-4" / "Z1".
 * Stacked fractions are 2D layout and still cannot be recovered; questions damaged by one are
 * detected and dropped rather than published.
 *
 * Usage:
 *   corepack pnpm@10.14.0 exec tsx scripts/ingest-careerpoint.ts <year-page-url|pdf-url>...
 *     [--out DIR] [--include-numerical]
 *
 *   # every shift of 2025, MCQs only
 *   ... ingest-careerpoint.ts https://ecareerpoint.com/jee-main-2025-answer-key --out ./jee-2025
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  classifyCareerPointQuestion,
  parseCareerPointPaper,
  toDraftQuestions,
  type CareerPointVerdict
} from "../lib/extract-careerpoint";
import { extractLayoutText } from "../lib/pdf-text";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const PDF_LINK = /https:\/\/cms\.careerpoint\.ac\.in\/pdf\/[A-Za-z0-9_\-]+\.pdf/g;

// JEE Main marking: +4 correct, -1 wrong, 0 unattempted.
const MAX_MARKS = 4;
const NEGATIVE_MARKS = 1;

// "JEE Main Online Exam 2025 Questions & Solution 22st January 2025 | Morning"
const PAPER_HEADER =
  /Questions?\s*&\s*Solutions?\s*(.{4,40}?)\s*\|\s*(Morning|Evening|Afternoon)/i;

const VERDICTS: CareerPointVerdict[] = [
  "clean",
  "numerical",
  "image-options",
  "needs-diagram",
  "mangled-math",
  "malformed"
];

async function fetchText(url: string) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function fetchPdf(url: string, cacheDir: string) {
  const cached = path.join(cacheDir, url.split("/").pop()!);
  if (existsSync(cached)) return readFile(cached);

  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(cached, buffer);
  return buffer;
}

// A year page ("…/jee-main-2025-answer-key") lists every shift's PDF. A direct PDF URL is
// passed through unchanged so a single paper can be re-run.
async function resolvePdfUrls(target: string) {
  if (target.endsWith(".pdf")) return [target];
  const html = await fetchText(target);
  return [...new Set(html.match(PDF_LINK) ?? [])];
}

// The shift label comes from the PDF's own header, not the listing page: the page shows one
// date per row with two undifferentiated "Download" links.
function sourceLabel(text: string, fallback: string) {
  const match = text.match(PAPER_HEADER);
  if (!match) return `JEE Main · ${fallback}`;
  // Ordinal suffixes are set as superscripts in the PDF, so after layout-aware extraction
  // they arrive as "22^(st)" rather than "22st". Strip both forms.
  const date = match[1]
    .replace(/\^\(?(?:st|nd|rd|th)\)?/gi, "")
    .replace(/(\d+)(?:st|nd|rd|th)/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const shift = match[2][0].toUpperCase() + match[2].slice(1).toLowerCase();
  return `JEE Main ${date} · ${shift}`;
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : "careerpoint-out";
  const includeNumerical = args.includes("--include-numerical");
  const targets = args.filter(
    (arg, i) => !arg.startsWith("--") && i !== outIndex + 1
  );

  if (targets.length === 0) {
    console.error("Pass a year page URL or a PDF URL. See the header comment.");
    process.exit(1);
  }

  const cacheDir = path.join(outDir, "pdfs");
  await mkdir(cacheDir, { recursive: true });

  const urls: string[] = [];
  for (const target of targets) urls.push(...(await resolvePdfUrls(target)));
  console.log(`${urls.length} paper PDFs to process\n`);

  const totals: Record<string, number> = {};
  const drafts: (ReturnType<typeof toDraftQuestions>[number] & {
    source_label: string;
    subject: string;
  })[] = [];

  for (const url of urls) {
    const name = url.split("/").pop()!;
    try {
      const buffer = await fetchPdf(url, cacheDir);
      const text = await extractLayoutText(new Uint8Array(buffer));
      const questions = parseCareerPointPaper(text);
      if (questions.length === 0) {
        console.log(`${name.padEnd(24)} no questions parsed — skipped`);
        continue;
      }

      const label = sourceLabel(text, name);
      const counts: Record<string, number> = {};
      for (const question of questions) {
        const verdict = classifyCareerPointQuestion(question);
        counts[verdict] = (counts[verdict] ?? 0) + 1;
        totals[verdict] = (totals[verdict] ?? 0) + 1;
      }

      for (const draft of toDraftQuestions(questions, {
        maxMarks: MAX_MARKS,
        negativeMarks: NEGATIVE_MARKS,
        includeNumerical
      })) {
        drafts.push({ ...draft, source_label: label, subject: draft.topic });
      }

      const kept = (counts.clean ?? 0) + (includeNumerical ? counts.numerical ?? 0 : 0);
      console.log(
        `${name.padEnd(24)} ${label.padEnd(34)} ${String(kept).padStart(3)}/${String(questions.length).padStart(3)} kept  ` +
          `(${VERDICTS.filter((v) => v !== "clean" && counts[v]).map((v) => `${counts[v]} ${v}`).join(", ") || "all clean"})`
      );
    } catch (error) {
      console.log(`${name.padEnd(24)} FAILED — ${(error as Error).message}`);
    }
  }

  // The bank dedupes on a fingerprint of normalized stem + options, but doing it here too
  // keeps the reviewable output honest about how many distinct questions there really are.
  const seen = new Set<string>();
  const unique = drafts.filter((draft) => {
    const key = (draft.question_text + "::" + (draft.options ?? []).join("|"))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await writeFile(path.join(outDir, "questions.json"), JSON.stringify(unique, null, 2));

  const grand = Object.values(totals).reduce((sum, n) => sum + n, 0);
  console.log(`\n${grand} questions parsed`);
  for (const verdict of VERDICTS) if (totals[verdict]) console.log(`  ${String(totals[verdict]).padStart(5)}  ${verdict}`);
  console.log(`\n${unique.length} drafts (${drafts.length - unique.length} duplicates dropped) -> ${path.join(outDir, "questions.json")}`);
  console.log("Review before publishing: stacked fractions are detected, but no heuristic catches every layout loss.");
}

main();
