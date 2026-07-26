import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyAnswerKey, extractDraftQuestions, parseAnswerKey } from "@/lib/extract";
import type { DraftQuestion } from "@/lib/ai";

describe("extractDraftQuestions", () => {
  it("parses MCQ + subjective questions and applies an embedded answer key", () => {
    const text = [
      "1. What is 2 + 2?",
      "A) 3",
      "B) 4",
      "C) 5",
      "D) 6",
      "2. The capital of France is:",
      "(A) Berlin",
      "(B) Madrid",
      "(C) Paris",
      "(D) Rome",
      "3. Explain Newton's second law of motion.",
      "Answer Key",
      "1. B",
      "2. C"
    ].join("\n");

    const questions = extractDraftQuestions(text);
    assert.equal(questions.length, 3);

    assert.equal(questions[0].question_type, "mcq");
    assert.equal(questions[0].question_text, "What is 2 + 2?");
    assert.deepEqual(questions[0].options, ["3", "4", "5", "6"]);
    assert.equal(questions[0].correct_answer, "4");

    assert.equal(questions[1].question_type, "mcq");
    assert.deepEqual(questions[1].options, ["Berlin", "Madrid", "Paris", "Rome"]);
    assert.equal(questions[1].correct_answer, "Paris");

    assert.equal(questions[2].question_type, "subjective");
    assert.equal(questions[2].question_text, "Explain Newton's second law of motion.");
    assert.equal(questions[2].options, null);
    assert.equal(questions[2].correct_answer, null);
  });

  it("splits options crammed onto one line", () => {
    const questions = extractDraftQuestions("1. What is 2+2? A) 3 B) 4 C) 5 D) 6");
    assert.equal(questions.length, 1);
    assert.equal(questions[0].question_type, "mcq");
    assert.equal(questions[0].question_text, "What is 2+2?");
    assert.deepEqual(questions[0].options, ["3", "4", "5", "6"]);
  });

  it("parses a continuous stream with no line breaks (real PDF-style)", () => {
    const text =
      "1. What is 2+2? A) 3 B) 4 C) 5 D) 6 2. Capital of France? A) Berlin B) Paris C) Rome D) Madrid";
    const questions = extractDraftQuestions(text);
    assert.equal(questions.length, 2);
    assert.equal(questions[0].question_text, "What is 2+2?");
    assert.deepEqual(questions[0].options, ["3", "4", "5", "6"]);
    assert.equal(questions[1].question_text, "Capital of France?");
    assert.deepEqual(questions[1].options, ["Berlin", "Paris", "Rome", "Madrid"]);
  });

  it("returns nothing when no numbered questions are present", () => {
    assert.deepEqual(extractDraftQuestions(""), []);
    assert.deepEqual(extractDraftQuestions("just a paragraph with no question numbers"), []);
  });

  it("handles Q-prefixed numbering and lowercase parenthesised options", () => {
    const text =
      "Q1) Which document is a valid ID? (a) Utility bill (b) Passport (c) Selfie (d) None " +
      "Q2) Define a Politically Exposed Person.";
    const questions = extractDraftQuestions(text);
    assert.equal(questions.length, 2);
    assert.equal(questions[0].question_type, "mcq");
    assert.equal(questions[0].question_text, "Which document is a valid ID?");
    assert.deepEqual(questions[0].options, ["Utility bill", "Passport", "Selfie", "None"]);
    assert.equal(questions[1].question_type, "subjective");
    assert.equal(questions[1].question_text, "Define a Politically Exposed Person.");
  });

  it("handles paren-style numbering (1) 2)) and period-style options (A. B.)", () => {
    const text = "1) What is 2+2? A. 3 B. 4 C. 5 D. 6 2) Name a prime number.";
    const questions = extractDraftQuestions(text);
    assert.equal(questions.length, 2);
    assert.deepEqual(questions[0].options, ["3", "4", "5", "6"]);
    assert.equal(questions[1].question_type, "subjective");
  });
});

describe("parseAnswerKey", () => {
  it("parses comma, colon and paren formats", () => {
    assert.deepEqual(parseAnswerKey("1:B, 2:C, 3:A"), { 1: "B", 2: "C", 3: "A" });
    assert.deepEqual(parseAnswerKey("1) D 2) A"), { 1: "D", 2: "A" });
    assert.deepEqual(parseAnswerKey("1. b\n2. e"), { 1: "B", 2: "E" });
  });
});

describe("applyAnswerKey", () => {
  it("fills MCQ correct answers by position and leaves other rows untouched", () => {
    const questions: DraftQuestion[] = [
      { question_text: "q1", question_type: "mcq", topic: "General", options: ["3", "4", "5", "6"], correct_answer: null, max_marks: 1, rubric: null },
      { question_text: "q2", question_type: "subjective", topic: "General", options: null, correct_answer: null, max_marks: 2, rubric: null },
      { question_text: "q3", question_type: "mcq", topic: "General", options: ["w", "x", "y", "z"], correct_answer: null, max_marks: 1, rubric: null }
    ];

    const result = applyAnswerKey(questions, "1:B, 3:D");
    assert.equal(result[0].correct_answer, "4"); // B -> index 1
    assert.equal(result[1].correct_answer, null); // subjective untouched
    assert.equal(result[2].correct_answer, "z"); // D -> index 3
  });

  it("ignores out-of-range letters", () => {
    const questions: DraftQuestion[] = [
      { question_text: "q1", question_type: "mcq", topic: "General", options: ["3", "4"], correct_answer: null, max_marks: 1, rubric: null }
    ];
    assert.equal(applyAnswerKey(questions, "1:D")[0].correct_answer, null);
  });
});
