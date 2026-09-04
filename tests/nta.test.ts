import assert from "node:assert/strict";
import test from "node:test";

import {
  isMcq,
  parseNtaPaper,
  parseNtaPaperMeta,
  resolveAnswerPosition
} from "../lib/extract-nta";
import { buildAnswerLookup, parseNtaAnswerKey, type KeyCell } from "../lib/nta-answer-key";
import { encodePng, IMAGE_KIND } from "../lib/png";

// ---------------------------------------------------------------- paper skeleton

const PAPER =
  "National Testing Agency Question Paper Name : B Tech 2nd Apr 2026 Shift 1 Subject Name : B. Tech " +
  "Creation Date : 2026-04-02 14:02:41 Duration : 180 Total Marks : 300 " +
  "Mathematics Section A Section Id : 6911211 Number of Questions : 20 " +
  "Question Number : 1 Question Id : 6911211 Question Type : MCQ Option Shuffling : Yes " +
  "Display Question Number : Yes Options : 6911211. 6911212. 6911213. 6911214. " +
  "Question Number : 2 Question Id : 6911212 Question Type : MCQ Option Shuffling : Yes " +
  "Display Question Number : Yes Options : 6911215. 6911216. 6911217. 6911218. " +
  "Mathematics Section B Section Id : 6911299 Number of Questions : 5 " +
  "Question Number : 21 Question Id : 6911231 Question Type : SA Display Question Number : Yes " +
  "Physics Section A Section Id : 6911300 " +
  "Question Number : 26 Question Id : 6911226 Question Type : MCQ Option Shuffling : Yes " +
  "Display Question Number : Yes Options : 69112101. 69112102. 69112103. 69112104.";

test("reads the paper header", () => {
  const meta = parseNtaPaperMeta(PAPER);
  assert.equal(meta.paperName, "B Tech 2nd Apr 2026 Shift 1");
  assert.equal(meta.creationDate, "2026-04-02 14:02:41");
});

test("recovers every question with its ids, subject and section", () => {
  const questions = parseNtaPaper(PAPER);
  assert.equal(questions.length, 4);

  const [first] = questions;
  assert.equal(first.questionNumber, 1);
  assert.equal(first.questionId, "6911211");
  assert.equal(first.questionType, "MCQ");
  assert.equal(first.subject, "Maths");
  assert.equal(first.section, "A");
  assert.deepEqual(first.optionIds, ["6911211", "6911212", "6911213", "6911214"]);

  // Subject and section headings carry forward to the questions that follow them.
  assert.equal(questions[2].section, "B");
  assert.equal(questions[3].subject, "Physics");
  assert.equal(questions[3].section, "A");
});

test("a Section B numerical question has no options", () => {
  const numerical = parseNtaPaper(PAPER)[2];
  assert.deepEqual(numerical.optionIds, []);
  assert.equal(isMcq(numerical), false);
  assert.equal(isMcq(parseNtaPaper(PAPER)[0]), true);
});

// ---------------------------------------------------------------- answer key

function cell(text: string, x: number, y: number, page = 1): KeyCell {
  return { text, x, y, page };
}

// Session 2 layout: QUESTION ID | CORRECT OPTION ID, three subject groups across.
const OPTION_ID_KEY: KeyCell[] = [
  cell("Exam Date : 02.04.2026", 139, 779),
  cell("Exam Shift : First", 288, 779),
  cell("QUESTION ID CORRECT OPTION ID", 5, 765),
  cell("( MATHEMATICS )", 15, 742),
  cell("6911211", 5, 728),
  cell("6911213", 67, 728),
  cell("69112126", 204, 728),
  cell("69112187", 265, 728),
  cell("6911212", 5, 704),
  cell("6911218", 67, 704)
];

test("parses the option-id key layout across subject column groups", () => {
  const [section] = parseNtaAnswerKey(OPTION_ID_KEY);
  assert.equal(section.examDate, "02.04.2026");
  assert.deepEqual(section.answers.slice(0, 3), [
    { kind: "optionId", questionId: "6911211", optionId: "6911213" },
    { kind: "optionId", questionId: "69112126", optionId: "69112187" },
    { kind: "optionId", questionId: "6911212", optionId: "6911218" }
  ]);
});

// Session 1 layout: Domestic | International | Correct Answer (a 1-4 position).
const POSITION_KEY: KeyCell[] = [
  cell("Exam Date : 21.01.2026", 139, 779),
  cell("Domestic", 9, 728),
  cell("International", 70, 728),
  cell("Correct Answer", 130, 728),
  cell("8606541126", 8, 707),
  cell("8606541201", 74, 707),
  cell("2", 144, 707),
  cell("8606541151", 206, 707),
  cell("8606541226", 273, 707),
  cell("3", 342, 707)
];

test("parses the position key layout and keeps the domestic id", () => {
  const [section] = parseNtaAnswerKey(POSITION_KEY);
  assert.deepEqual(section.answers, [
    { kind: "position", questionId: "8606541126", position: 2 },
    { kind: "position", questionId: "8606541151", position: 3 }
  ]);
});

// The regression this module exists for: read as a text stream, adjacent columns weld into
// "691121369112" and nothing joins. Grouping by x is what keeps the ids intact.
test("adjacent columns are not welded into one token", () => {
  const [section] = parseNtaAnswerKey(OPTION_ID_KEY);
  const ids = section.answers.map((a) => a.questionId);
  assert.ok(ids.includes("6911211"));
  assert.ok(!ids.some((id) => id.length > 12));
});

test("rows on different pages never merge into one row", () => {
  const sections = parseNtaAnswerKey([
    cell("QUESTION ID CORRECT OPTION ID", 5, 765, 1),
    cell("6911211", 5, 100, 1),
    cell("6911213", 67, 100, 1),
    // Same y, next page — a different printed row entirely.
    cell("6911299", 5, 100, 2),
    cell("6911288", 67, 100, 2)
  ]);
  const answers = sections.flatMap((s) => s.answers);
  assert.equal(answers.length, 2);
  assert.deepEqual(answers.map((a) => a.questionId), ["6911211", "6911299"]);
});

// ---------------------------------------------------------------- the join

test("an option-id key resolves to the position of that option in this paper", () => {
  const question = parseNtaPaper(PAPER)[0];
  const lookup = buildAnswerLookup(parseNtaAnswerKey(OPTION_ID_KEY));
  // Q1's options are 6911211..6911214 and the key names 6911213 — the third.
  assert.equal(resolveAnswerPosition(question, lookup), 3);
});

test("a key naming an option the question does not have resolves to null", () => {
  const question = parseNtaPaper(PAPER)[0];
  const lookup = buildAnswerLookup(
    parseNtaAnswerKey([
      cell("QUESTION ID CORRECT OPTION ID", 5, 765),
      cell("6911211", 5, 728),
      cell("999999999", 67, 728)
    ])
  );
  assert.equal(resolveAnswerPosition(question, lookup), null);
});

test("the position layout is used as a fallback", () => {
  const question = parseNtaPaper(PAPER)[0];
  const lookup = buildAnswerLookup(
    parseNtaAnswerKey([
      cell("Domestic", 9, 728),
      cell("International", 70, 728),
      cell("Correct Answer", 130, 728),
      cell("6911211", 8, 707),
      cell("6911201", 74, 707),
      cell("4", 144, 707)
    ])
  );
  assert.equal(resolveAnswerPosition(question, lookup), 4);
});

// ---------------------------------------------------------------- png

test("encodes a bitmap as a decodable PNG", () => {
  const png = encodePng({
    width: 2,
    height: 2,
    kind: IMAGE_KIND.RGB_24BPP,
    data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255])
  });

  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  assert.equal(png.readUInt32BE(16), 2); // width
  assert.equal(png.readUInt32BE(20), 2); // height
  assert.ok(png.includes(Buffer.from("IDAT", "ascii")));
  assert.ok(png.subarray(-8).includes(Buffer.from("IEND", "ascii")));
});

// Question renderings are black-on-transparent; compositing onto black would invert them.
test("transparent pixels composite onto white, not black", () => {
  const png = encodePng({
    width: 1,
    height: 1,
    kind: IMAGE_KIND.RGBA_32BPP,
    data: new Uint8Array([0, 0, 0, 0])
  });
  const { inflateSync } = require("node:zlib") as typeof import("node:zlib");
  const start = png.indexOf(Buffer.from("IDAT", "ascii")) + 4;
  const length = png.readUInt32BE(start - 8);
  const raw = inflateSync(png.subarray(start, start + length));
  // [filter byte, R, G, B]
  assert.deepEqual([...raw], [0, 255, 255, 255]);
});

test("a zero-sized bitmap is rejected rather than producing a corrupt file", () => {
  assert.throws(
    () => encodePng({ width: 0, height: 5, kind: IMAGE_KIND.RGB_24BPP, data: new Uint8Array() }),
    /zero-sized/
  );
});

// ---------------------------------------------------------------- image pairing

test("pairs the stem image and each option image with its question", () => {
  const { pairNtaImages } = require("../lib/extract-nta") as typeof import("../lib/extract-nta");

  // The real layout from page 2 of "B Tech 2nd Apr 2026 Shift 1".
  const paired = pairNtaImages([
    { type: "question", questionId: "6911212", page: 2, y: 800 },
    { type: "image", ref: "img_p1_1", width: 883, height: 103, page: 2, y: 752 },
    { type: "optionsMarker", page: 2, y: 742 },
    { type: "optionId", optionId: "6911215", page: 2, y: 716 },
    { type: "image", ref: "img_p1_2", width: 35, height: 35, page: 2, y: 716 },
    { type: "optionId", optionId: "6911216", page: 2, y: 679 },
    { type: "image", ref: "img_p1_3", width: 35, height: 35, page: 2, y: 679 },
    { type: "question", questionId: "6911213", page: 2, y: 564 },
    { type: "image", ref: "img_p1_6", width: 507, height: 195, page: 2, y: 434 }
  ]);

  const first = paired.get("6911212")!;
  assert.deepEqual(first.stem.map((s) => s.ref), ["img_p1_1"]);
  assert.equal(first.options.get("6911215")?.ref, "img_p1_2");
  assert.equal(first.options.get("6911216")?.ref, "img_p1_3");

  // The next question's stem is not absorbed by the previous question's option list.
  assert.deepEqual(paired.get("6911213")!.stem.map((s) => s.ref), ["img_p1_6"]);
  assert.equal(paired.get("6911213")!.options.size, 0);
});

test("two option ids never claim the same image", () => {
  const { pairNtaImages } = require("../lib/extract-nta") as typeof import("../lib/extract-nta");
  const paired = pairNtaImages([
    { type: "question", questionId: "Q", page: 1, y: 800 },
    { type: "optionsMarker", page: 1, y: 790 },
    // Both ids sit close together; only one image is available.
    { type: "optionId", optionId: "a", page: 1, y: 700 },
    { type: "optionId", optionId: "b", page: 1, y: 704 },
    { type: "image", ref: "only", width: 10, height: 10, page: 1, y: 702 }
  ]);
  const options = paired.get("Q")!.options;
  assert.equal(options.size, 1);
});
