import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { topicSegments } from "@/lib/topic-segments";

describe("topicSegments", () => {
  it("maps mixed strong / mid / weak topics to the right strengths", () => {
    const breakdown = {
      Kinematics: { earned: 8, possible: 10, percent: 80 },
      Graphs: { earned: 3, possible: 10, percent: 30 },
      Optics: { earned: 7, possible: 10, percent: 70 }
    };

    assert.deepEqual(
      topicSegments(breakdown).map((segment) => [segment.topic, segment.strength]),
      [
        ["Kinematics", "strong"],
        ["Graphs", "weak"],
        ["Optics", "mid"]
      ]
    );
  });

  it("applies the thresholds at the boundaries (75 strong, 60 mid, 59 weak)", () => {
    const breakdown = { A: { percent: 75 }, B: { percent: 60 }, C: { percent: 59 } };
    assert.deepEqual(
      topicSegments(breakdown).map((segment) => segment.strength),
      ["strong", "mid", "weak"]
    );
  });

  it("clamps and rounds the percent", () => {
    const [segment] = topicSegments({ A: { percent: 82.6 } });
    assert.equal(segment.percent, 83);
    assert.equal(segment.strength, "strong");
  });

  it("returns [] for empty, null, non-object, or percent-less breakdowns", () => {
    assert.deepEqual(topicSegments(null), []);
    assert.deepEqual(topicSegments({}), []);
    assert.deepEqual(topicSegments("nope" as unknown as never), []);
    assert.deepEqual(topicSegments({ Topic: { earned: 1, possible: 2 } }), []);
  });
});
