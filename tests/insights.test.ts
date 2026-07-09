import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildActivityCalendar } from "@/lib/activity";
import { aggregatePractice, feedText, mergeFeed } from "@/lib/activity-feed";
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

describe("buildActivityCalendar", () => {
  // 2026-07-07 is a Tuesday.
  const now = new Date("2026-07-07T20:00:00");
  const at = (daysAgo: number, hour = 10) =>
    new Date(2026, 6, 7 - daysAgo, hour).toISOString();

  it("builds a Monday-start grid ending on the current week's Sunday", () => {
    const calendar = buildActivityCalendar([], 2, now);
    assert.equal(calendar.weeks.length, 2);
    assert.equal(calendar.weeks[0].length, 7);

    const lastWeek = calendar.weeks[1];
    assert.equal(new Date(lastWeek[0].date).getDay(), 1); // Monday
    assert.equal(lastWeek[1].isToday, true); // Tuesday = today
    assert.equal(lastWeek[2].isFuture, true); // Wednesday onward is future
    assert.equal(lastWeek[6].isFuture, true);
  });

  it("counts events per day, flags test days, and tracks streaks", () => {
    const calendar = buildActivityCalendar(
      [
        { at: at(0), kind: "practice" },
        { at: at(0, 12), kind: "practice" },
        { at: at(1), kind: "test" },
        { at: at(1, 14), kind: "practice" },
        // gap on day 2
        { at: at(3), kind: "practice" }
      ],
      2,
      now
    );

    const days = calendar.weeks.flat();
    const today = days.find((day) => day.isToday)!;
    assert.equal(today.count, 2);
    const yesterday = days[days.indexOf(today) - 1];
    assert.equal(yesterday.hasTest, true);
    assert.equal(calendar.activeDays, 3);
    assert.equal(calendar.longestStreak, 2); // yesterday + today; gap breaks the run
  });
});

describe("activity feed", () => {
  it("aggregates practice attempts per student per day, keeping the latest time", () => {
    const events = aggregatePractice([
      { at: "2026-07-08T10:00:00", actor: "Rahul" },
      { at: "2026-07-08T11:30:00", actor: "Rahul" },
      { at: "2026-07-07T09:00:00", actor: "Rahul" },
      { at: "2026-07-08T10:15:00", actor: "Meera" }
    ]);
    assert.equal(events.length, 3); // Rahul×2 days + Meera×1

    const rahulToday = events.find(
      (event) =>
        event.actor === "Rahul" &&
        new Date(event.at).toDateString() === new Date("2026-07-08T11:30:00").toDateString()
    )!;
    assert.equal(rahulToday.count, 2);
    assert.equal(rahulToday.at, "2026-07-08T11:30:00");
  });

  it("merges newest-first with an optional limit and labels events", () => {
    const merged = mergeFeed(
      [
        { kind: "joined", actor: "Asha", detail: "XII Physics", at: "2026-07-01T00:00:00" },
        { kind: "submitted", actor: "Bala", detail: "Weekly", at: "2026-07-08T00:00:00" },
        { kind: "practiced", actor: "Dev", detail: "", count: 5, at: "2026-07-05T00:00:00" }
      ],
      2
    );
    assert.deepEqual(merged.map((event) => event.actor), ["Bala", "Dev"]);
    assert.equal(feedText(merged[0]), "Bala submitted Weekly");
    assert.equal(feedText(merged[1]), "Dev practiced 5 questions");
    assert.equal(feedText({ kind: "practiced", actor: "X", detail: "", count: 1, at: "" }), "X practiced 1 question");
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
