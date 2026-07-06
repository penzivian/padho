import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeRankList } from "@/lib/ranks";

describe("computeRankList", () => {
  it("applies standard competition ranking with ties sharing a rank", () => {
    const { ranked, pending } = computeRankList([
      { studentId: "a", name: "Asha", awarded: 18, max: 20, graded: true }, // 90%
      { studentId: "b", name: "Bala", awarded: 18, max: 20, graded: true }, // 90% tie
      { studentId: "c", name: "Chitra", awarded: 15, max: 20, graded: true }, // 75%
      { studentId: "d", name: "Dev", awarded: 10, max: 20, graded: true } // 50%
    ]);

    assert.equal(pending.length, 0);
    assert.deepEqual(
      ranked.map((row) => [row.name, row.rank, row.percentage]),
      [
        ["Asha", 1, 90],
        ["Bala", 1, 90],
        ["Chitra", 3, 75], // rank 2 is skipped after the tie
        ["Dev", 4, 50]
      ]
    );
    assert.equal(ranked[2].percentile, 75); // ceil(3/4*100)
  });

  it("handles a single graded student", () => {
    const { ranked } = computeRankList([
      { studentId: "a", name: "Solo", awarded: 7, max: 10, graded: true }
    ]);
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[0].percentage, 70);
    assert.equal(ranked[0].percentile, 100);
  });

  it("ranks only fully graded submissions; pending are listed separately", () => {
    const { ranked, pending } = computeRankList([
      { studentId: "a", name: "Asha", awarded: 16, max: 20, graded: true },
      { studentId: "b", name: "Bala", awarded: 0, max: 20, graded: false },
      { studentId: "c", name: "Chitra", awarded: 12.5, max: 20, graded: true }
    ]);

    assert.deepEqual(pending, [{ studentId: "b", name: "Bala" }]);
    assert.deepEqual(
      ranked.map((row) => [row.name, row.rank, row.percentage]),
      [
        ["Asha", 1, 80],
        ["Chitra", 2, 62.5] // 1-decimal percentage
      ]
    );
  });
});
