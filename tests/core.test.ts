import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractJson } from "@/lib/ai";
import { questionState, remainingMs, summarizeAttempt } from "@/lib/attempt";
import { parseAnswerKey } from "@/lib/extract";
import {
  buildProgressSnapshot,
  findKeylessMcqs,
  normalizeSuggestedMark,
  scoreMcqAnswer,
  scoreSubmission
} from "@/lib/grading";
import { homePathForRole } from "@/lib/routes";
import { monthStartUtcIso, scheduleInputToUtcIso } from "@/lib/time";
import { formatDateTime, generateInviteCode } from "@/lib/utils";

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

  it("deducts the penalty for a wrong answer but never for an unattempted one", () => {
    // The JEE/NEET rule: +4 correct, -1 wrong, 0 left blank. Penalising a blank would make
    // skipping strictly worse than guessing, which is the opposite of the intent.
    assert.equal(scoreMcqAnswer("Option A", "Option A", 4, 1), 4);
    assert.equal(scoreMcqAnswer("Option B", "Option A", 4, 1), -1);
    assert.equal(scoreMcqAnswer("", "Option A", 4, 1), 0);
    assert.equal(scoreMcqAnswer("   ", "Option A", 4, 1), 0);
  });

  it("treats a zero penalty as plain non-negative marking", () => {
    assert.equal(scoreMcqAnswer("Option B", "Option A", 4), 0);
    assert.equal(scoreMcqAnswer("Option B", "Option A", 4, 0), 0);
  });

  it("keeps a persisted negative mark instead of clamping it back to zero", () => {
    // Rebuilding a snapshot must not quietly erase every deduction.
    const scored = scoreSubmission([
      {
        questionId: "q1",
        type: "mcq",
        topic: "Optics",
        maxMarks: 4,
        correctAnswer: "A",
        studentAnswer: "B",
        awardedMarks: -1,
        negativeMarks: 1
      }
    ]);

    assert.equal(scored[0].awardedMarks, -1);
  });

  it("floors a subjective mark at zero even when a penalty is passed", () => {
    const scored = scoreSubmission([
      {
        questionId: "s1",
        type: "subjective",
        topic: "Optics",
        maxMarks: 5,
        correctAnswer: null,
        studentAnswer: "essay",
        awardedMarks: -3,
        negativeMarks: 1
      }
    ]);

    assert.equal(scored[0].awardedMarks, 0);
  });

  it("can produce a net-negative percent, which the DB now permits down to -100", () => {
    const snapshot = buildProgressSnapshot([
      {
        questionId: "a",
        type: "mcq",
        topic: "Optics",
        maxMarks: 4,
        correctAnswer: "A",
        studentAnswer: "A",
        negativeMarks: 1
      },
      {
        questionId: "b",
        type: "mcq",
        topic: "Optics",
        maxMarks: 4,
        correctAnswer: "A",
        studentAnswer: "B",
        negativeMarks: 1
      },
      {
        questionId: "c",
        type: "mcq",
        topic: "Optics",
        maxMarks: 4,
        correctAnswer: "A",
        studentAnswer: "C",
        negativeMarks: 1
      },
      // Unattempted: contributes 0, not -1.
      {
        questionId: "d",
        type: "mcq",
        topic: "Optics",
        maxMarks: 4,
        correctAnswer: "A",
        studentAnswer: "",
        negativeMarks: 1
      }
    ]);

    // earned 4 - 1 - 1 + 0 = 2 of a possible 16
    assert.equal(snapshot.scorePercent, 12.5);
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

describe("answer key applied later", () => {
  it("maps key letters onto options by question number", () => {
    // The paste box is numbered by the paper's own order, which is what a teacher reads off
    // their printed key — "2:C" must land on the second question's third option.
    const key = parseAnswerKey("1:B, 2:C, 3:A");
    assert.deepEqual(key, { 1: "B", 2: "C", 3: "A" });
  });

  it("accepts the loose formats teachers actually paste", () => {
    assert.deepEqual(parseAnswerKey("1. B  2) C  3 - A"), { 1: "B", 2: "C", 3: "A" });
    assert.deepEqual(parseAnswerKey("1 (b)\n2 (c)"), { 1: "B", 2: "C" });
  });

  it("returns nothing for text with no usable pairs, so the action can reject it", () => {
    assert.deepEqual(parseAnswerKey(""), {});
    assert.deepEqual(parseAnswerKey("please find the key attached"), {});
  });
});

describe("cbt attempt state", () => {
  const answer = (studentAnswer: string, markedForReview = false) => ({
    questionId: "q",
    studentAnswer,
    markedForReview
  });

  it("maps each answer row to its NTA-equivalent palette state", () => {
    // No row at all is the only thing that means "not visited" — visiting writes a blank row.
    assert.equal(questionState(undefined), "not_visited");
    assert.equal(questionState(answer("")), "visited");
    assert.equal(questionState(answer("   ")), "visited");
    assert.equal(questionState(answer("", true)), "marked");
    assert.equal(questionState(answer("Option B")), "answered");
    assert.equal(questionState(answer("Option B", true)), "answered_marked");
  });

  it("counts an answered-and-marked question as answered, matching NTA scoring", () => {
    const summary = summarizeAttempt(["a", "b", "c", "d", "e"], new Map([
      ["a", { questionId: "a", studentAnswer: "A", markedForReview: false }],
      ["b", { questionId: "b", studentAnswer: "B", markedForReview: true }],
      ["c", { questionId: "c", studentAnswer: "", markedForReview: true }],
      ["d", { questionId: "d", studentAnswer: "", markedForReview: false }]
      // "e" never visited
    ]));

    assert.deepEqual(summary, {
      answered: 2,
      notAnswered: 2,
      markedForReview: 2,
      notVisited: 1,
      total: 5
    });
  });

  it("floors the remaining time at zero once the window has passed", () => {
    const start = "2026-08-05T10:00:00.000Z";
    const atStart = Date.parse(start);
    assert.equal(remainingMs(start, 60, atStart), 60 * 60_000);
    assert.equal(remainingMs(start, 60, atStart + 59 * 60_000), 60_000);
    assert.equal(remainingMs(start, 60, atStart + 60 * 60_000), 0);
    assert.equal(remainingMs(start, 60, atStart + 99 * 60_000), 0);
  });
});

describe("schedule input timezone", () => {
  it("reads a datetime-local value as IST, not as the running process's zone", () => {
    // The reported bug: a teacher picked 12:30 AM and the test went live at 6:00 AM,
    // because Vercel's Node runs in UTC and resolved the bare string there.
    assert.equal(scheduleInputToUtcIso("2026-07-28T00:30"), "2026-07-27T19:00:00.000Z");
    assert.equal(scheduleInputToUtcIso("2026-07-28T00:30:00"), "2026-07-27T19:00:00.000Z");
  });

  it("round-trips back to the wall clock the teacher typed", () => {
    const iso = scheduleInputToUtcIso("2026-08-05T10:00");
    assert.ok(iso);
    assert.equal(formatDateTime(iso), "5 Aug 2026, 10:00 am");
  });

  it("starts the AI-credit month at IST midnight on the 1st, not the server's", () => {
    // The cap previously rolled over at 05:30 IST on the 1st because the boundary was
    // computed in the process's zone (UTC on Vercel).
    assert.equal(
      monthStartUtcIso(new Date("2026-07-28T17:00:00.000Z")),
      "2026-06-30T18:30:00.000Z" // = 1 Jul 2026, 00:00 IST
    );
  });

  it("uses the IST month even for an instant that is still last month in UTC", () => {
    // 1 Aug 2026 04:00 IST is 31 Jul 2026 22:30 UTC — the IST month has already turned.
    assert.equal(
      monthStartUtcIso(new Date("2026-07-31T22:30:00.000Z")),
      "2026-07-31T18:30:00.000Z" // = 1 Aug 2026, 00:00 IST
    );
  });

  it("rejects a malformed value instead of storing a bad instant", () => {
    assert.equal(scheduleInputToUtcIso(""), null);
    assert.equal(scheduleInputToUtcIso("tomorrow"), null);
    assert.equal(scheduleInputToUtcIso("2026-08-05"), null);
  });
});

describe("AI JSON extraction", () => {
  it("extracts JSON from a text-wrapped response", () => {
    assert.deepEqual(extractJson("Here:\n[{\"question_text\":\"Q\"}]"), [{ question_text: "Q" }]);
  });
});
