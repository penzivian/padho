import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  answerDoubt,
  generateQuestions,
  gradeSubjectiveAnswer,
  questionListSchema
} from "@/lib/ai";

// Force the deterministic mock path so these tests stay hermetic (no network or Supabase),
// independent of any ANTHROPIC_API_KEY / AI_MOCK_MODE in the ambient environment.
process.env.AI_MOCK_MODE = "true";

describe("AI mock: generateQuestions", () => {
  it("returns a schema-valid MCQ array for an mcq request", async () => {
    const questions = await generateQuestions({
      subject: "Physics",
      topic: "Kinematics",
      examTarget: "JEE",
      difficulty: "medium",
      count: 4,
      mix: "mcq"
    });

    const parsed = questionListSchema.parse(questions);
    assert.equal(parsed.length, 4);
    assert.ok(parsed.every((question) => question.question_type === "mcq"));
    for (const question of parsed) {
      assert.ok(Array.isArray(question.options) && question.options.length > 0);
      assert.equal(typeof question.correct_answer, "string");
    }
  });

  it("returns a schema-valid array mixing subjective and MCQ items", async () => {
    // The mock interleaves subjective items when the requested mix includes "subjective".
    const questions = await generateQuestions({
      subject: "Physics",
      topic: "Kinematics",
      examTarget: "JEE",
      difficulty: "medium",
      count: 4,
      mix: "subjective"
    });

    const parsed = questionListSchema.parse(questions);
    assert.equal(parsed.length, 4);
    assert.ok(parsed.some((question) => question.question_type === "subjective"));
    assert.ok(parsed.some((question) => question.question_type === "mcq"));

    for (const question of parsed.filter((item) => item.question_type === "subjective")) {
      assert.equal(question.options, null);
      assert.equal(question.correct_answer, null);
      assert.ok(typeof question.rubric === "string" && question.rubric.length > 0);
    }
  });
});

describe("AI mock: gradeSubjectiveAnswer", () => {
  it("keeps suggested marks within 0..maxMarks", async () => {
    for (const maxMarks of [1, 3, 5, 10]) {
      const result = await gradeSubjectiveAnswer({
        question: "Explain Newton's second law.",
        rubric: null,
        maxMarks,
        answer: "Force equals mass times acceleration."
      });

      assert.ok(result.suggested_marks >= 0, `marks >= 0 for max ${maxMarks}`);
      assert.ok(result.suggested_marks <= maxMarks, `marks <= ${maxMarks}`);
      assert.ok(result.feedback.length > 0);
    }
  });
});

describe("AI mock: answerDoubt", () => {
  it("returns a non-empty string for a given exam target", async () => {
    const answer = await answerDoubt("How do I solve a quadratic equation?", "JEE");
    assert.equal(typeof answer, "string");
    assert.ok(answer.trim().length > 0);
  });

  it("returns a non-empty string when the exam target is null", async () => {
    const answer = await answerDoubt("What is osmosis?", null);
    assert.ok(answer.trim().length > 0);
  });
});
