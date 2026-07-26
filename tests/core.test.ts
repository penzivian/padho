import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractJson } from "@/lib/ai";
import {
  buildProgressSnapshot,
  findKeylessMcqs,
  normalizeSuggestedMark,
  scoreMcqAnswer
} from "@/lib/grading";
import { homePathForRole } from "@/lib/routes";
import { generateInviteCode } from "@/lib/utils";

describe("invite codes", () => {
  it("generates compact uppercase codes without ambiguous letters", () => {
    const code = generateInviteCode();

    assert.match(code, /^[A-Z0-9]{7}$/);
    assert.equal(/[IO01]/.test(code), false);
  });
});

describe("role routing", () => {
  it("routes teachers and students to role-specific homes", () => {
    assert.equal(homePathForRole("teacher"), "/teacher");
    assert.equal(homePathForRole("student"), "/student");
  });
});

describe("grading", () => {
  it("scores MCQ answers case-insensitively", () => {
    assert.equal(scoreMcqAnswer("Option A", "option a", 2), 2);
    assert.equal(scoreMcqAnswer("Option B", "Option A", 2), 0);
  });

  it("bounds AI suggested marks to the question max", () => {
    assert.equal(normalizeSuggestedMark(7, 5), 5);
    assert.equal(normalizeSuggestedMark(-2, 5), 0);
  });

  it("finds 1-based positions of MCQs missing an answer key in a mixed paper", () => {
    const positions = findKeylessMcqs([
      { type: "mcq", correctAnswer: "Option A" }, // 1 — keyed
      { type: "mcq", correctAnswer: null }, // 2 — missing
      { type: "subjective", correctAnswer: null }, // 3 — subjective never counts
      { type: "mcq", correctAnswer: "  " }, // 4 — whitespace-only counts as missing
      { type: "mcq", correctAnswer: "" } // 5 — empty counts as missing
    ]);

    assert.deepEqual(positions, [2, 4, 5]);
    assert.deepEqual(findKeylessMcqs([]), []);
  });

  it("builds score and topic snapshots", () => {
    const snapshot = buildProgressSnapshot([
      {
        questionId: "q1",
        type: "mcq",
        topic: "Algebra",
        maxMarks: 2,
        correctAnswer: "A",
        studentAnswer: "A"
      },
      {
        questionId: "q2",
        type: "subjective",
        topic: "Algebra",
        maxMarks: 3,
        correctAnswer: null,
        studentAnswer: "x = 2",
        awardedMarks: 1.5
      }
    ]);

    assert.equal(snapshot.scorePercent, 70);
    assert.deepEqual(snapshot.topicBreakdown, {
      Algebra: { earned: 3.5, possible: 5, percent: 70 }
    });
  });

  it("aggregates a mixed multi-topic submission with partial subjective marks", () => {
    const snapshot = buildProgressSnapshot([
      // Algebra: case-insensitive correct MCQ (2/2) + partial subjective (3/4)
      {
        questionId: "a1",
        type: "mcq",
        topic: "Algebra",
        maxMarks: 2,
        correctAnswer: "A",
        studentAnswer: "a"
      },
      {
        questionId: "a2",
        type: "subjective",
        topic: "Algebra",
        maxMarks: 4,
        correctAnswer: null,
        studentAnswer: "Detailed working",
        awardedMarks: 3
      },
      // Geometry: wrong MCQ (0/2) + partial subjective (2.5/5)
      {
        questionId: "g1",
        type: "mcq",
        topic: "Geometry",
        maxMarks: 2,
        correctAnswer: "B",
        studentAnswer: "C"
      },
      {
        questionId: "g2",
        type: "subjective",
        topic: "Geometry",
        maxMarks: 5,
        correctAnswer: null,
        studentAnswer: "Partial proof",
        awardedMarks: 2.5
      }
    ]);

    // earned 7.5 of 13 overall
    assert.equal(snapshot.scorePercent, 57.69);
    assert.deepEqual(snapshot.topicBreakdown, {
      Algebra: { earned: 5, possible: 6, percent: 83.33 },
      Geometry: { earned: 2.5, possible: 7, percent: 35.71 }
    });
  });

  it("credits a teacher's manual mark on a keyless MCQ instead of re-scoring it to 0", () => {
    // A paper scheduled without an answer key: the MCQ cannot be auto-scored, so the
    // teacher's approved mark is the only truth the snapshot may use.
    const snapshot = buildProgressSnapshot([
      {
        questionId: "k1",
        type: "mcq",
        topic: "Civics",
        maxMarks: 4,
        correctAnswer: null,
        studentAnswer: "Option C",
        awardedMarks: 4
      }
    ]);

    assert.equal(snapshot.scorePercent, 100);
    assert.deepEqual(snapshot.topicBreakdown, {
      Civics: { earned: 4, possible: 4, percent: 100 }
    });
  });

  it("caps a manual MCQ mark at the question max and scores an ungraded keyless MCQ as 0", () => {
    const snapshot = buildProgressSnapshot([
      {
        questionId: "k1",
        type: "mcq",
        topic: "Civics",
        maxMarks: 2,
        correctAnswer: null,
        studentAnswer: "Option C",
        awardedMarks: 9 // fat-fingered override — clamped to maxMarks
      },
      {
        questionId: "k2",
        type: "mcq",
        topic: "Civics",
        maxMarks: 2,
        correctAnswer: null,
        studentAnswer: "Option A",
        awardedMarks: null // not yet graded
      }
    ]);

    assert.deepEqual(snapshot.topicBreakdown, {
      Civics: { earned: 2, possible: 4, percent: 50 }
    });
  });
});

describe("AI JSON extraction", () => {
  it("extracts JSON from a text-wrapped response", () => {
    assert.deepEqual(extractJson("Here:\n[{\"question_text\":\"Q\"}]"), [{ question_text: "Q" }]);
  });
});
