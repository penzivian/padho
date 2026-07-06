import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPracticeAttempt, isMcqAnswerCorrect } from "@/lib/practice";

describe("isMcqAnswerCorrect", () => {
  it("matches case- and whitespace-insensitively", () => {
    assert.equal(isMcqAnswerCorrect("  option a ", "Option A"), true);
    assert.equal(isMcqAnswerCorrect("Option B", "Option A"), false);
    assert.equal(isMcqAnswerCorrect("anything", null), false);
  });
});

describe("buildPracticeAttempt", () => {
  it("builds the attempt-log row shape", () => {
    assert.deepEqual(buildPracticeAttempt("q1", "  Option A ", true), {
      question_id: "q1",
      given_answer: "Option A",
      is_correct: true
    });
    assert.deepEqual(buildPracticeAttempt("q2", "my essay", null), {
      question_id: "q2",
      given_answer: "my essay",
      is_correct: null
    });
  });
});
