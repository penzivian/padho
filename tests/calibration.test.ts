import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCalibrationBlock,
  hasUsefulCalibration,
  sanitizeMark,
  selectCalibrationExamples,
  type ApprovedAnswer
} from "@/lib/calibration";

const answer = (id: string, awardedMarks: number, answerText = `answer ${id}`): ApprovedAnswer => ({
  id,
  answerText,
  awardedMarks
});

describe("calibration example selection", () => {
  it("returns nothing when there is nothing usable to learn from", () => {
    assert.deepEqual(selectCalibrationExamples([], 5), []);
    assert.deepEqual(selectCalibrationExamples([answer("a", 3)], 0), []);
    assert.deepEqual(selectCalibrationExamples([answer("a", 3)], -1), []);
    assert.deepEqual(selectCalibrationExamples([answer("a", 3)], 5, { limit: 0 }), []);
  });

  it("drops blank answers, which carry no marking signal", () => {
    const picked = selectCalibrationExamples(
      [answer("a", 3, "   "), answer("b", 4, ""), answer("c", 5, "real answer")],
      5
    );

    assert.deepEqual(
      picked.map((example) => example.id),
      ["c"]
    );
  });

  it("spreads across the mark range instead of returning the most common mark", () => {
    // The bug this whole module exists to prevent. Most of the batch scored full marks; a
    // naive "take the most recent k" returns [5,5,5,5] and teaches the model to award 5.
    const skewed = [
      ...Array.from({ length: 8 }, (_, index) => answer(`full-${index}`, 5)),
      answer("zero", 0),
      answer("half", 2.5)
    ];

    const marks = selectCalibrationExamples(skewed, 5, { limit: 4 }).map(
      (example) => example.awardedMarks
    );

    assert.ok(marks.includes(0), `expected a 0 in ${JSON.stringify(marks)}`);
    assert.ok(marks.includes(2.5), `expected a 2.5 in ${JSON.stringify(marks)}`);
    assert.ok(marks.includes(5), `expected a 5 in ${JSON.stringify(marks)}`);
  });

  it("is deterministic and independent of input order", () => {
    const pool = [answer("a", 1), answer("b", 4), answer("c", 2), answer("d", 5), answer("e", 3)];
    const forward = selectCalibrationExamples(pool, 5, { limit: 3 });
    const reversed = selectCalibrationExamples([...pool].reverse(), 5, { limit: 3 });
    const again = selectCalibrationExamples(pool, 5, { limit: 3 });

    assert.deepEqual(forward, again);
    assert.deepEqual(forward, reversed);
  });

  it("emits examples in ascending mark order", () => {
    const marks = selectCalibrationExamples(
      [answer("a", 5), answer("b", 1), answer("c", 3)],
      5
    ).map((example) => example.awardedMarks);

    assert.deepEqual(marks, [1, 3, 5]);
  });

  it("clamps a stale mark left behind by a max_marks edit", () => {
    // The teacher lowered the question from 10 marks to 5 after marking some answers.
    const picked = selectCalibrationExamples([answer("a", 9), answer("b", 1)], 5);

    assert.deepEqual(
      picked.map((example) => example.awardedMarks),
      [1, 5]
    );
  });

  it("puts a full-mark answer in the top band rather than off the end", () => {
    const picked = selectCalibrationExamples([answer("top", 5)], 5, { limit: 4 });

    assert.deepEqual(
      picked.map((example) => example.id),
      ["top"]
    );
  });

  it("truncates a long answer so one essay cannot dominate the prompt", () => {
    const picked = selectCalibrationExamples([answer("a", 3, "x".repeat(50))], 5, {
      maxAnswerChars: 10
    });

    assert.equal(picked[0].answerText, `${"x".repeat(10)}…`);
  });

  it("never exceeds the limit, and returns everything when supply is short", () => {
    const many = Array.from({ length: 30 }, (_, index) => answer(`q-${index}`, index % 6));
    assert.equal(selectCalibrationExamples(many, 5, { limit: 6 }).length, 6);

    const few = [answer("a", 1), answer("b", 4)];
    assert.equal(selectCalibrationExamples(few, 5, { limit: 6 }).length, 2);
  });
});

describe("calibration usefulness gate", () => {
  it("rejects too few examples", () => {
    assert.equal(hasUsefulCalibration([]), false);
    assert.equal(hasUsefulCalibration([answer("a", 1), answer("b", 4)]), false);
  });

  it("rejects a spread where every mark is identical", () => {
    // Three examples all at 5 would anchor the model on "award full marks".
    assert.equal(
      hasUsefulCalibration([answer("a", 5), answer("b", 5), answer("c", 5)]),
      false
    );
  });

  it("accepts three or more examples with real variation", () => {
    assert.equal(hasUsefulCalibration([answer("a", 0), answer("b", 3), answer("c", 5)]), true);
  });
});

describe("calibration mark formatting", () => {
  it("normalizes -0 to 0", () => {
    const result = sanitizeMark(-0);

    assert.equal(result, 0);
    assert.equal(Object.is(result, -0), false);
  });

  it("rounds float noise and never emits -0 in the rendered block", () => {
    const block = formatCalibrationBlock(
      [{ id: "a", answerText: "some working", awardedMarks: 2.5000000001 }],
      5
    );

    assert.match(block, /awarded 2\.5 \/ 5/);
    assert.equal(block.includes("-0"), false);
  });

  it("renders an empty block for no examples, leaving the prompt unchanged", () => {
    assert.equal(formatCalibrationBlock([], 5), "");
  });

  it("numbers examples and states the mark out of the maximum", () => {
    const block = formatCalibrationBlock(
      [
        { id: "a", answerText: "weak attempt", awardedMarks: 1 },
        { id: "b", answerText: "full method", awardedMarks: 4 }
      ],
      4
    );

    assert.match(block, /Example 1 — awarded 1 \/ 4\nweak attempt/);
    assert.match(block, /Example 2 — awarded 4 \/ 4\nfull method/);
  });
});
