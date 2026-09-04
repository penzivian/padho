/**
 * Build library questions from NTA's OFFICIAL JEE Main papers.
 *
 * This is the only fully-official path. NTA publishes the real paper and the real Final
 * Answer Key, and they join exactly on Question Id — so both the question and its answer come
 * from the examining body rather than a coaching institute's transcription.
 *
 * The catch is that NTA's paper PDF contains no question text at all. It is an exam-engine
 * export: question ids, option ids, section metadata, and one embedded IMAGE per stem and per
 * option. Recovering the text therefore needs a vision model. That is also why the output is
 * better than any text-extraction route — the image renders notation perfectly, so exponents,
 * fractions and chemical formulae survive as LaTeX instead of collapsing.
 *
 * Coverage caveat: NTA keeps only the CURRENT cycle online. There is no archive, so this
 * reaches ~9 shifts of 2026, not the 2020-2025 history that `ingest-careerpoint.ts` covers.
 *
 * Usage:
 *   corepack pnpm@10.14.0 exec tsx scripts/ingest-nta.ts \
 *     --paper <paper.pdf|url> --key <finalkey.pdf|url> [--out DIR] [--limit N] [--live]
 *
 *   Runs in MOCK mode by default: images are extracted and everything is joined, but no API
 *   call is made and no money is spent. Pass --live (with ANTHROPIC_API_KEY set) to transcribe
 *   for real. --limit N transcribes only the first N questions, for costing a run first.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  isMcq,
  pairNtaImages,
  parseNtaPaper,
  parseNtaPaperMeta,
  resolveAnswerPosition,
  type NtaLayoutItem
} from "../lib/extract-nta";
import { buildAnswerLookup, parseNtaAnswerKey, type KeyCell } from "../lib/nta-answer-key";
import { encodePng } from "../lib/png";
import { transcribeQuestion, type VisionImage } from "../lib/nta-vision";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// JEE Main marking: +4 correct, -1 wrong, 0 unattempted.
const MAX_MARKS = 4;
const NEGATIVE_MARKS = 1;

type Ctm = [number, number, number, number, number, number];

const multiply = (m: number[], n: number[]): Ctm => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5]
];

async function load(target: string, cacheDir: string) {
  if (!/^https?:/.test(target)) return readFile(target);

  const cached = path.join(cacheDir, path.basename(new URL(target).pathname));
  if (existsSync(cached)) return readFile(cached);

  const response = await fetch(target, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${target}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(cached, buffer);
  return buffer;
}

// Walks the page content, tracking the graphics state so every painted image gets a position.
// pdf.js reports images through `paintImageXObject` with only a name and size; where it lands
// on the page lives in the current transformation matrix, which has to be replayed by hand.
async function readPaper(data: Uint8Array) {
  const { getDocumentProxy } = await import("unpdf");
  const { OPS } = (await import("unpdf/pdfjs")) as unknown as { OPS: Record<string, number> };
  const pdf = await getDocumentProxy(data);

  const layout: NtaLayoutItem[] = [];
  const textParts: string[] = [];
  const bitmaps = new Map<string, { width: number; height: number; kind: number; data: Uint8Array }>();

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const ops = await page.getOperatorList();

    let ctm: Ctm = [1, 0, 0, 1, 0, 0];
    const stack: Ctm[] = [];
    for (let i = 0; i < ops.fnArray.length; i += 1) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i] as [string, number, number];
      if (fn === OPS.save) stack.push([...ctm] as Ctm);
      else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
      else if (fn === OPS.transform) ctm = multiply(ctm, args as unknown as number[]);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
        layout.push({
          type: "image",
          ref: `${pageNumber}:${args[0]}`,
          width: args[1],
          height: args[2],
          page: pageNumber,
          y: ctm[5]
        });
        // Resolve the decoded bitmap now, while this page's objects are still loaded.
        const objId = args[0];
        const key = `${pageNumber}:${objId}`;
        if (!bitmaps.has(key)) {
          try {
            const obj = await new Promise<{
              width: number;
              height: number;
              kind: number;
              data: Uint8Array;
            }>((resolve) => page.objs.get(objId, resolve as never));
            if (obj?.data) bitmaps.set(key, obj);
          } catch {
            // A missing image degrades that one question, never the whole paper.
          }
        }
      }
    }

    const content = await page.getTextContent();
    for (const entry of content.items as unknown[]) {
      const item = entry as { str?: unknown; transform?: unknown };
      if (typeof item.str !== "string" || !Array.isArray(item.transform)) continue;
      const text = item.str.trim();
      if (!text) continue;
      const y = (item.transform as number[])[5];
      textParts.push(item.str);

      const question = text.match(/Question Id\s*:\s*(\d+)/);
      if (question) layout.push({ type: "question", questionId: question[1], page: pageNumber, y });
      else if (/^Options\s*:/.test(text)) layout.push({ type: "optionsMarker", page: pageNumber, y });
      else {
        // Option ids are printed as a bare "6911215." beside their image.
        const option = text.match(/^(\d{5,12})\.$/);
        if (option) layout.push({ type: "optionId", optionId: option[1], page: pageNumber, y });
      }
    }
  }

  return { layout, text: textParts.join(" "), bitmaps };
}

// The key is a table; cells must keep their x so columns do not weld together.
async function readKeyCells(data: Uint8Array): Promise<KeyCell[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(data);
  const cells: KeyCell[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    for (const entry of content.items as unknown[]) {
      const item = entry as { str?: unknown; transform?: unknown };
      if (typeof item.str !== "string" || !Array.isArray(item.transform)) continue;
      if (!item.str.trim()) continue;
      const transform = item.transform as number[];
      cells.push({ text: item.str.trim(), x: transform[4], y: transform[5], page: pageNumber });
    }
  }

  return cells;
}

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const paperTarget = arg("paper");
  const keyTarget = arg("key");
  const outDir = arg("out", "nta-out")!;
  const limit = Number(arg("limit", "0")) || 0;
  const live = process.argv.includes("--live");

  if (!paperTarget || !keyTarget) {
    console.error("Need --paper <pdf|url> and --key <pdf|url>. See the header comment.");
    process.exit(1);
  }

  const cacheDir = path.join(outDir, "pdfs");
  const imageDir = path.join(outDir, "images");
  await mkdir(cacheDir, { recursive: true });
  await mkdir(imageDir, { recursive: true });

  const paperData = new Uint8Array(await load(paperTarget, cacheDir));
  const keyData = new Uint8Array(await load(keyTarget, cacheDir));

  const { layout, text, bitmaps } = await readPaper(paperData);
  const meta = parseNtaPaperMeta(text);
  const questions = parseNtaPaper(text);
  const images = pairNtaImages(layout);
  const lookup = buildAnswerLookup(parseNtaAnswerKey(await readKeyCells(keyData)));

  const label = meta.paperName ? `JEE Main · ${meta.paperName} (NTA official)` : "JEE Main (NTA official)";
  const mcqs = questions.filter(isMcq);
  const keyed = mcqs.filter((q) => resolveAnswerPosition(q, lookup) !== null);

  console.log(`paper : ${meta.paperName ?? "(unnamed)"}`);
  console.log(`parsed: ${questions.length} questions (${mcqs.length} MCQ, ${questions.length - mcqs.length} numerical)`);
  console.log(`key   : ${keyed.length}/${mcqs.length} MCQs resolved against the official key`);
  console.log(`images: ${bitmaps.size} decoded`);
  console.log(`mode  : ${live ? "LIVE (billable)" : "MOCK (no API calls)"}${limit ? `, limit ${limit}` : ""}\n`);

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;
  if (live && !apiKey) {
    console.error("--live needs ANTHROPIC_API_KEY in the environment. Aborting before any spend.");
    process.exit(1);
  }

  const toPng = (ref: string): VisionImage | null => {
    const bitmap = bitmaps.get(ref);
    if (!bitmap) return null;
    return { mediaType: "image/png", base64: encodePng(bitmap).toString("base64") };
  };

  const drafts: Record<string, unknown>[] = [];
  const targets = limit ? keyed.slice(0, limit) : keyed;

  for (const [index, question] of targets.entries()) {
    const entry = images.get(question.questionId);
    if (!entry) continue;

    const stem = entry.stem.map((image) => toPng(image.ref)).filter(Boolean) as VisionImage[];
    const optionImages = question.optionIds
      .map((id) => entry.options.get(id))
      .map((image) => (image ? toPng(image.ref) : null));

    if (stem.length === 0 || optionImages.some((image) => !image)) {
      console.log(`Q${question.questionNumber} ${question.questionId} — missing images, skipped`);
      continue;
    }

    // Save the images alongside the output so a reviewer can check a transcription against
    // what the model actually saw.
    const slug = `q${String(question.questionNumber).padStart(3, "0")}_${question.questionId}`;
    const answerPosition = resolveAnswerPosition(question, lookup)!;
    await writeFile(path.join(imageDir, `${slug}_stem.png`), Buffer.from(stem[0].base64, "base64"));
    // Options are saved too, with the official answer marked in the filename, so a reviewer
    // can confirm the key resolved to the option they'd actually pick.
    for (const [i, image] of (optionImages as VisionImage[]).entries()) {
      const mark = i + 1 === answerPosition ? "_CORRECT" : "";
      await writeFile(
        path.join(imageDir, `${slug}_opt${i + 1}${mark}.png`),
        Buffer.from(image.base64, "base64")
      );
    }

    const transcription = await transcribeQuestion(stem, optionImages as VisionImage[], {
      apiKey,
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6",
      mock: !live
    });

    const position = answerPosition;
    const optionTexts = transcription.options;
    if (optionTexts.length !== question.optionIds.length) {
      console.log(`Q${question.questionNumber} — model returned ${optionTexts.length} options, skipped`);
      continue;
    }

    drafts.push({
      question_text: transcription.stem,
      question_type: "mcq",
      topic: question.subject || "General",
      options: optionTexts,
      // Stored as option TEXT, matching applyAnswerKey and scoreMcqAnswer.
      correct_answer: optionTexts[position - 1],
      max_marks: MAX_MARKS,
      negative_marks: NEGATIVE_MARKS,
      rubric: null,
      subject: question.subject,
      source_label: label,
      nta_question_id: question.questionId,
      has_diagram: transcription.has_diagram
    });

    if ((index + 1) % 10 === 0 || index + 1 === targets.length) {
      console.log(`  transcribed ${index + 1}/${targets.length}`);
    }
  }

  await writeFile(path.join(outDir, "questions.json"), JSON.stringify(drafts, null, 2));
  const withDiagram = drafts.filter((d) => d.has_diagram).length;
  console.log(`\n${drafts.length} drafts -> ${path.join(outDir, "questions.json")}`);
  console.log(`${withDiagram} flagged as needing their diagram; images saved to ${imageDir}`);
  if (!live) console.log("\nMOCK run — question text is placeholder. Re-run with --live to transcribe.");
}

main();
