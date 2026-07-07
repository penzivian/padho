import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calcDayStreak } from "@/lib/streak";
import { weakestTopics } from "@/lib/topics";
import { buildStudentShareMessage, buildWaShareLink } from "@/lib/whatsapp";

describe("calcDayStreak", () => {
  const now = new Date("2026-07-07T20:00:00");
  const day = (offset: number, hour = 10) =>
    new Date(2026, 6, 7 - offset, hour).toISOString();

  it("counts consecutive active days including today", () => {
    assert.equal(calcDayStreak([day(0), day(1), day(2)], now), 3);
  });

  it("keeps the streak alive when today has no activity yet (grace day)", () => {
    assert.equal(calcDayStreak([day(1), day(2)], now), 2);
  });

  it("breaks on a missed full day and handles empty input", () => {
    assert.equal(calcDayStreak([day(2), day(3)], now), 0); // last activity 2 days ago
    assert.equal(calcDayStreak([], now), 0);
  });
});

describe("weakestTopics", () => {
  it("aggregates marks-weighted topic strength ascending", () => {
    const result = weakestTopics([
      { Kinematics: { earned: 2, possible: 4, percent: 50 }, Graphs: { earned: 2, possible: 2, percent: 100 } },
      { Kinematics: { earned: 1, possible: 4, percent: 25 }, "Laws of Motion": { earned: 6, possible: 10, percent: 60 } }
    ]);

    assert.deepEqual(result, [
      { topic: "Kinematics", percent: 38 }, // (2+1)/(4+4)
      { topic: "Laws of Motion", percent: 60 },
      { topic: "Graphs", percent: 100 }
    ]);
  });

  it("ignores malformed entries and respects the limit", () => {
    const result = weakestTopics(
      [null, "junk" as never, { Algebra: { earned: 1, possible: 2, percent: 50 } }, { Bad: { percent: 10 } }],
      1
    );
    assert.deepEqual(result, [{ topic: "Algebra", percent: 50 }]);
  });
});

describe("student share message", () => {
  it("builds the student-voice message with optional rank", () => {
    assert.equal(
      buildStudentShareMessage({ testTitle: "Physics Weekly", percentage: 87.5, rank: 2, totalStudents: 23 }),
      "Namaskar! I scored 87.5% in Physics Weekly, Rank 2 of 23 — via Padho."
    );
    assert.ok(!buildStudentShareMessage({ testTitle: "T", percentage: 50 }).includes("Rank"));
  });

  it("builds a phoneless wa.me share link", () => {
    const link = buildWaShareLink("I scored 87.5%");
    assert.ok(link.startsWith("https://wa.me/?text="));
    assert.ok(link.includes("87.5%25"));
  });
});
