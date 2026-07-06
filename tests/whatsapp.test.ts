import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildResultMessage, buildWaLink, normalizeWaPhone } from "@/lib/whatsapp";

describe("normalizeWaPhone", () => {
  it("normalizes Indian number formats to E.164 digits", () => {
    assert.equal(normalizeWaPhone("9876543210"), "919876543210"); // bare 10-digit
    assert.equal(normalizeWaPhone("+91 98765 43210"), "919876543210");
    assert.equal(normalizeWaPhone("091-9876-543-210"), "919876543210");
    assert.equal(normalizeWaPhone("+1 415 555 0100"), "14155550100"); // non-Indian passes through
  });
});

describe("buildResultMessage", () => {
  const base = {
    studentName: "Rahul",
    testTitle: "Physics Weekly",
    score: 14,
    maxScore: 16,
    percentage: 87.5,
    resultUrl: "https://padho.app/student/results/t1",
    teacherName: "Anwesha"
  };

  it("includes the rank line when ranks are visible", () => {
    const message = buildResultMessage({ ...base, rank: 2, totalStudents: 23 });
    assert.ok(message.includes("Rahul's result for Physics Weekly: 14/16 (87.5%)"));
    assert.ok(message.includes(", Rank 2 of 23."));
    assert.ok(message.includes("— Anwesha"));
    assert.ok(message.length < 300);
  });

  it("omits the rank line when ranks are hidden", () => {
    const message = buildResultMessage({ ...base, rank: null, totalStudents: null });
    assert.ok(!message.includes("Rank"));
    assert.ok(message.includes("(87.5%). View the full breakdown"));
  });
});

describe("buildWaLink", () => {
  it("builds a wa.me link with encoded text", () => {
    const link = buildWaLink("+91 98765 43210", "Result: 14/16 (87.5%) — Anwesha");
    assert.ok(link.startsWith("https://wa.me/919876543210?text="));
    assert.ok(link.includes("14%2F16")); // slash encoded
    assert.ok(link.includes("%E2%80%94")); // em-dash encoded
    assert.ok(!link.includes(" ")); // fully encoded
  });
});
