import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCareerPointQuestion,
  parseCareerPointPaper,
  stripFurniture,
  toDraftQuestions
} from "../lib/extract-careerpoint";

const FURNITURE =
  "CAREER POINT CAREER POINT Ltd., CP Tower, IPIA, Road No.1, Kota (Raj.), " +
  "Ph: 081-47250011 www.careerpoint.ac.in 2 JEE Main Online Paper ";

const PAPER =
  FURNITURE +
  "MATHEMATICS Section-A: This section contains 20 multiple choice questions. " +
  "Q.1 The number of non-empty equivalence relations on the set {1,2,3} is : " +
  "(1) 6 (2) 7 (3) 5 (4) 4 Ans. [3] Sol. Let R be the required relation Ans. (5) " +
  FURNITURE +
  "Q.2 Let the triangle PQR be the image of the triangle with vertices (1,3), (3,1) and (2, 4) " +
  "in the line x + 2y = 2. If the centroid is (α, β), then 15(α – β) is equal to : " +
  "(1) 24 (2) 19 (3) 21 (4) 22 Ans. [4] Sol. working here " +
  "Section-B: Numerical Value Type Questions: This section contains 5 Numerical based questions. " +
  "Q.21 The number of distinct real roots of the given polynomial is ______. Ans. [34] Sol. more working " +
  "CHEMISTRY Section-A: This section contains 20 multiple choice questions. " +
  "Q.51 Lanthanoid ions with 4f^7 configuration are : (A) Eu^(2+) (B) Gd^(3+) (C) Eu^(3+) " +
  "Choose the correct answer from the options given below : " +
  "(1) (A) and (B) only (2) (A) and (D) only (3) (B) and (E) only (4) (B) and (C) only Ans. [1] Sol. x";

test("strips repeated page furniture", () => {
  const stripped = stripFurniture(PAPER);
  assert.ok(!stripped.includes("CP Tower"));
  assert.ok(!stripped.includes("careerpoint.ac.in"));
  assert.ok(stripped.includes("equivalence relations"));
});

test("parses every question and attributes it to its subject", () => {
  const questions = parseCareerPointPaper(PAPER);
  assert.equal(questions.length, 4);
  assert.deepEqual(
    questions.map((q) => [q.subject, q.number]),
    [
      ["Maths", 1],
      ["Maths", 2],
      ["Maths", 21],
      ["Chemistry", 51]
    ]
  );
});

// "Ans. [3]" is an INDEX, unlike the letter keys the other two extractors deal with.
test("resolves the numeric key to the option it points at", () => {
  const [first, second] = parseCareerPointPaper(PAPER);
  assert.equal(first.answerIndex, 3);
  assert.equal(first.options[first.answerIndex! - 1], "5");
  assert.equal(second.options[second.answerIndex! - 1], "22");
});

// Solutions restate "Ans." and are full of "(1)"-shaped text, so the cut has to be at the
// FIRST key or the working leaks into the question.
test("worked solutions never leak into the stem or options", () => {
  const [first] = parseCareerPointPaper(PAPER);
  assert.ok(!first.stem.includes("Sol."));
  assert.ok(!first.options.some((option) => option.includes("required relation")));
  assert.equal(first.options.length, 4);
});

// The stem of Q.2 contains "(1,3), (3,1) and (2, 4)" — a naive "(n)" split would treat those
// coordinates as option markers.
test("coordinate pairs in a stem do not hijack the option split", () => {
  const second = parseCareerPointPaper(PAPER)[1];
  assert.deepEqual(second.options, ["24", "19", "21", "22"]);
  assert.ok(second.stem.includes("vertices (1,3), (3,1) and (2, 4)"));
});

test("a Section-B question is numerical, not a broken MCQ", () => {
  const numerical = parseCareerPointPaper(PAPER)[2];
  assert.equal(numerical.options.length, 0);
  assert.equal(numerical.answerRaw, "34");
  assert.equal(classifyCareerPointQuestion(numerical), "numerical");
  // The trailing blank the candidate fills is not part of the question.
  assert.ok(!numerical.stem.includes("___"));
});

// Regression: labelled sub-lists look like loose-token drift but are perfectly good questions.
test("a labelled sub-list question is not mistaken for mangled maths", () => {
  const chemistry = parseCareerPointPaper(PAPER)[3];
  assert.equal(classifyCareerPointQuestion(chemistry), "clean");
  assert.ok(chemistry.stem.includes("4f^7"));
});

test("a collapsed stacked fraction is rejected wherever it lands", () => {
  const stemDamage = parseCareerPointPaper(
    "PHYSICS Q.1 Let arg (z1) = , arg(z2) = 0 and 4 π 22 2 arg(z3) = . " +
      "(1) 24 (2) 41 (3) 31 (4) 29 Ans. [4] Sol. x"
  )[0];
  assert.equal(classifyCareerPointQuestion(stemDamage), "mangled-math");

  // Prose intact, damage confined to one option — the case a stem-only check misses.
  const optionDamage = parseCareerPointPaper(
    "PHYSICS Q.1 Which of the following statement is not true for radioactive decay ? " +
      "(1) Decay constant does not depend upon temperature. (2) Decay constant increases. " +
      "(3) Half life is ln 2 times of . rateconstant (4) Amount remained after three half lives. " +
      "Ans. [3] Sol. x"
  )[0];
  assert.equal(classifyCareerPointQuestion(optionDamage), "mangled-math");
});

test("drafts carry option text as the answer and route numericals to subjective", () => {
  const questions = parseCareerPointPaper(PAPER);

  const withoutNumerical = toDraftQuestions(questions, {
    maxMarks: 4,
    negativeMarks: 1,
    includeNumerical: false
  });
  assert.equal(withoutNumerical.length, 3);
  assert.ok(withoutNumerical.every((draft) => draft.question_type === "mcq"));
  assert.equal(withoutNumerical[0].correct_answer, "5");
  assert.equal(withoutNumerical[0].negative_marks, 1);

  const withNumerical = toDraftQuestions(questions, {
    maxMarks: 4,
    negativeMarks: 1,
    includeNumerical: true
  });
  const subjective = withNumerical.find((draft) => draft.question_type === "subjective");
  assert.ok(subjective);
  assert.equal(subjective.options, null);
  // The official answer belongs in the rubric: teacher-only, never served to students.
  assert.equal(subjective.rubric, "Official answer: 34");
  // A written answer is never negatively marked.
  assert.equal(subjective.negative_marks, 0);
});

// 2022 and earlier letter their options and key them by letter. Handling only the modern
// numeric form routed every older paper into "malformed" and lost the whole year.
test("parses the older lettered option format", () => {
  const [question] = parseCareerPointPaper(
    "PHYSICS Q.1 In two different experiments, an object of mass 5 kg moving with a speed of " +
      "25 ms^(–1) hits two different walls and comes to rest. The ratio is " +
      "(A) [ML^2T^(–2)] (B) [MLT^(–2)] (C) [ML^(–1)T^(–2)] (D) [ML^2T^(–2)A^(–1)] Ans. [C] Sol. x"
  );

  assert.equal(question.options.length, 4);
  assert.equal(question.answerIndex, 3);
  assert.equal(question.options[question.answerIndex! - 1], "[ML^(–1)T^(–2)]");
  assert.equal(classifyCareerPointQuestion(question), "clean");
});

// In the modern format a lettered sub-list inside the stem must not beat the real "(1)..(4)".
test("a numbered option run wins over a lettered decoy in the stem", () => {
  const [question] = parseCareerPointPaper(
    "CHEMISTRY Q.1 Lanthanoid ions with 4f^7 configuration are : (A) Eu^(2+) (B) Gd^(3+) " +
      "(C) Eu^(3+) (D) Tb^(3+) Choose the correct answer : " +
      "(1) (A) and (B) only (2) (A) and (D) only (3) (B) and (E) only (4) (B) and (C) only " +
      "Ans. [1] Sol. x"
  );

  assert.deepEqual(question.options, [
    "(A) and (B) only",
    "(A) and (D) only",
    "(B) and (E) only",
    "(B) and (C) only"
  ]);
  assert.ok(question.stem.includes("Lanthanoid"));
});
