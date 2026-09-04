import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyVedantuQuestion,
  parseVedantuPaper,
  toDraftQuestions
} from "../lib/extract-vedantu";

// Shaped like the real extracted stream: no line breaks, no question numbers.
const PAPER =
  "JEE-Main-22-01-2025 (Memory Based) [MORNING SHIFT] Chemistry " +
  "Question: What is the charge on metal and shape of complex of [NiCl4]2- respectively? " +
  "Options: (a) +2, Tetrahedral (b) +2, Square planar (c) +4, Tetrahedral (d) +4, Square Planar " +
  "Answer: (a) " +
  "Question: The 7th harmonic of a closed organ pipe has the same frequency as the 4th harmonic " +
  "of an open pipe. Find the length of the open pipe " +
  "Options: (a) cm (b) cm (c) cm (d) cm Answer: (b) Solution : worked steps here " +
  "Question: Which will show a positive Fehling test? Options: (a) (b) (c) (d) Answer: (c)";

test("parses Vedantu's unnumbered Question/Options/Answer blocks", () => {
  const paper = parseVedantuPaper(PAPER);

  assert.equal(paper.memoryBased, true);
  assert.equal(paper.questions.length, 3);

  const first = paper.questions[0];
  assert.equal(
    first.stem,
    "What is the charge on metal and shape of complex of [NiCl4]2- respectively?"
  );
  assert.deepEqual(first.options, [
    "+2, Tetrahedral",
    "+2, Square planar",
    "+4, Tetrahedral",
    "+4, Square Planar"
  ]);
  assert.equal(first.answer, "A");
});

test("worked solutions are not absorbed into the question", () => {
  const paper = parseVedantuPaper(PAPER);
  assert.ok(!paper.questions[1].stem.includes("worked steps"));
  assert.ok(!paper.questions[1].options.some((option) => option.includes("worked steps")));
});

// The point of the module: a question can parse perfectly and still be worthless because
// the PDF held its formulas as images.
test("rejects questions whose options were images", () => {
  const paper = parseVedantuPaper(PAPER);

  assert.equal(classifyVedantuQuestion(paper.questions[0]), "clean");
  // "(a) cm (b) cm (c) cm (d) cm" — units survived, values did not.
  assert.equal(classifyVedantuQuestion(paper.questions[1]), "image-options");
  // "(a) (b) (c) (d)" — nothing survived at all.
  assert.equal(classifyVedantuQuestion(paper.questions[2]), "image-options");
});

test("flags questions that depend on a figure the PDF only has as an image", () => {
  const [question] = parseVedantuPaper(
    "Question: A spherical cavity is formed in the sphere as shown in figure. Find the ratio F2/F1. " +
      "Options: (a) 7/9 (b) 9/7 (c) 11/12 (d) 12/11 Answer: (c)"
  ).questions;

  assert.equal(classifyVedantuQuestion(question), "needs-diagram");
});

test("flags an unkeyed question rather than importing it blind", () => {
  const [question] = parseVedantuPaper(
    "Question: The correct decreasing order of electronegativity is " +
      "Options: (a) F > Cl > I > Br (b) Cl > F > Br > I (c) F > Cl > Br > I (d) Br > F > I > Cl"
  ).questions;

  assert.equal(classifyVedantuQuestion(question), "no-key");
});

test("drafts carry the answer as option TEXT, matching scoreMcqAnswer", () => {
  const drafts = toDraftQuestions(parseVedantuPaper(PAPER).questions, {
    topic: "Coordination Compounds",
    maxMarks: 4,
    negativeMarks: 1
  });

  // Only the one clean question survives; the two image-option ones are dropped.
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].correct_answer, "+2, Tetrahedral");
  assert.equal(drafts[0].topic, "Coordination Compounds");
  assert.equal(drafts[0].max_marks, 4);
  assert.equal(drafts[0].negative_marks, 1);
  assert.equal(drafts[0].question_type, "mcq");
});
