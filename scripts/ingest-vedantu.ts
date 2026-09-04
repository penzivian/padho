/**
 * Pull JEE Main previous-year papers from Vedantu's public PDFs and turn them into
 * draft questions ready for the shared library (`publishToLibraryAction`).
 *
 * Read this before using the output:
 *
 *   1. Vedantu's PDFs are MEMORY-BASED reconstructions from student recall, not the
 *      official NTA papers. The script refuses to treat them as authoritative and
 *      stamps every source label with "(memory-based)".
 *   2. Every formula, graph and circuit in these PDFs is an IMAGE with no text layer.
 *      Roughly a third of Physics/Maths questions therefore come out unanswerable and
 *      are rejected. The report prints exactly how many were lost and why.
 *   3. What survives still needs a human read. Superscripts flatten ("10^-4" -> "10-4",
 *      "Al^3+" -> "Al3"), and characters are occasionally misread ("I" -> "1"). That is
 *      wrong-but-plausible content, which is the dangerous kind — REVIEW BEFORE PUBLISHING.
 *
 * Usage:
 *   corepack pnpm@10.14.0 exec tsx scripts/ingest-vedantu.ts <slug> [slug...] [--out DIR]
 *
 *   Slugs are the page names on vedantu.com/jee-main/, e.g.
 *     2025-chemistry-question-paper-22-january-shift-1
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  classifyVedantuQuestion,
  parseVedantuPaper,
  toDraftQuestions,
  type VedantuVerdict
} from "../lib/extract-vedantu";

const PDF_BASE = "https://www.vedantu.com/content-files-downloadable/jee-main";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// JEE Main marking. Kept here rather than in the parser because it is a product decision,
// not a property of the source document.
const MAX_MARKS = 4;
const NEGATIVE_MARKS = 1;

type PaperReport = {
  slug: string;
  subject: string;
  sourceLabel: string;
  memoryBased: boolean;
  counts: Record<VedantuVerdict, number>;
  drafts: ReturnType<typeof toDraftQuestions>;
};

async function fetchPdf(slug: string, cacheDir: string) {
  const cached = path.join(cacheDir, `${slug}.pdf`);
  if (existsSync(cached)) return readFile(cached);

  const response = await fetch(`${PDF_BASE}/${slug}.pdf`, {
    headers: { "user-agent": USER_AGENT }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(cached, buffer);
  return buffer;
}

// "2025-chemistry-question-paper-22-january-shift-1"
//   -> subject "Chemistry", label "JEE Main 2025 · 22 January Shift 1 (memory-based)"
function describe(slug: string, memoryBased: boolean) {
  const year = slug.match(/^(\d{4})/)?.[1] ?? "";
  const subjectMatch = slug.match(/^\d{4}-(physics|chemistry|maths|mathematics)-/);
  const subject = subjectMatch
    ? subjectMatch[1].replace(/^m.*/, "Maths").replace(/^p.*/, "Physics").replace(/^c.*/, "Chemistry")
    : "";

  const day = slug.match(/-(\d{1,2})-(january|february|april|june|july|august|september)/i);
  const shift = slug.match(/shift-(\d)/i);

  const parts = [`JEE Main ${year}`.trim()];
  if (day) parts.push(`${day[1]} ${day[2][0].toUpperCase()}${day[2].slice(1)}`);
  if (shift) parts.push(`Shift ${shift[1]}`);

  const label = parts.join(" · ") + (memoryBased ? " (memory-based)" : "");
  return { subject, label };
}

async function processPaper(slug: string, cacheDir: string): Promise<PaperReport> {
  const buffer = await fetchPdf(slug, cacheDir);
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });

  const paper = parseVedantuPaper(text);
  const { subject, label } = describe(slug, paper.memoryBased);

  const counts = { clean: 0, "image-options": 0, "needs-diagram": 0, "no-key": 0, malformed: 0 };
  for (const question of paper.questions) counts[classifyVedantuQuestion(question)] += 1;

  return {
    slug,
    subject,
    sourceLabel: label,
    memoryBased: paper.memoryBased,
    counts,
    // Topic defaults to the subject. It is deliberately NOT guessed per question: `topic`
    // drives the reteach radar and every progress analytic, and a wrong guess silently
    // corrupts those. Refine topics in the library UI before publishing.
    drafts: toDraftQuestions(paper.questions, {
      topic: subject || "General",
      maxMarks: MAX_MARKS,
      negativeMarks: NEGATIVE_MARKS
    })
  };
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : "vedantu-out";
  const slugs = args.filter((arg, i) => !arg.startsWith("--") && i !== outIndex + 1);

  if (slugs.length === 0) {
    console.error("Pass at least one paper slug. See the header comment for the format.");
    process.exit(1);
  }

  const cacheDir = path.join(outDir, "pdfs");
  await mkdir(cacheDir, { recursive: true });

  const reports: PaperReport[] = [];
  for (const slug of slugs) {
    try {
      const report = await processPaper(slug, cacheDir);
      reports.push(report);
      const { clean, ...rejected } = report.counts;
      const total = Object.values(report.counts).reduce((sum, n) => sum + n, 0);
      console.log(
        `${slug.padEnd(52)} ${String(clean).padStart(3)}/${String(total).padStart(3)} clean  ` +
          `(dropped: ${Object.entries(rejected).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(", ") || "none"})`
      );
    } catch (error) {
      console.log(`${slug.padEnd(52)} FAILED — ${(error as Error).message}`);
    }
  }

  const all = reports.flatMap((report) =>
    report.drafts.map((draft) => ({ ...draft, source_label: report.sourceLabel, subject: report.subject }))
  );
  await writeFile(path.join(outDir, "questions.json"), JSON.stringify(all, null, 2));

  const totals = reports.reduce(
    (acc, report) => {
      for (const [verdict, n] of Object.entries(report.counts)) acc[verdict] = (acc[verdict] ?? 0) + n;
      return acc;
    },
    {} as Record<string, number>
  );
  const grand = Object.values(totals).reduce((sum, n) => sum + n, 0);

  console.log(`\n${reports.length} papers · ${grand} questions parsed · ${totals.clean ?? 0} clean`);
  console.log(`dropped: ${Object.entries(totals).filter(([k, n]) => k !== "clean" && n > 0).map(([k, n]) => `${n} ${k}`).join(", ")}`);
  console.log(`\nWrote ${all.length} drafts -> ${path.join(outDir, "questions.json")}`);
  if (reports.some((report) => report.memoryBased)) {
    console.log("\nNOTE: memory-based reconstructions, not official NTA papers. Review before publishing.");
  }
}

main();
