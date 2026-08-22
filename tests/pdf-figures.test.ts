import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeFigureWarning,
  findDocumentFigures,
  findFigureGaps,
  type PdfTextItem
} from "@/lib/pdf-figures";

// Build a page of evenly-spaced text lines running DOWN the page, i.e. descending y, which is
// how PDF user space works (baseline y, bottom-left origin).
function lines(startY: number, count: number, pitch = 14): PdfTextItem[] {
  return Array.from({ length: count }, (_, index) => ({
    y: startY - index * pitch,
    height: 10
  }));
}

describe("findFigureGaps", () => {
  it("finds the empty band a figure leaves between two blocks of text", () => {
    // 6 lines, a 120pt hole, then 6 more — a circuit diagram sitting mid-page.
    const page = [...lines(700, 6), ...lines(700 - 5 * 14 - 120, 6)];
    const gaps = findFigureGaps(page);

    assert.equal(gaps.length, 1);
    assert.equal(gaps[0].height, 120);
    assert.equal(gaps[0].top, 700 - 5 * 14);
  });

  it("does not flag ordinary body text", () => {
    assert.deepEqual(findFigureGaps(lines(760, 40)), []);
  });

  it("ignores paragraph spacing, which is a small multiple of the line pitch", () => {
    // A double-spaced break (28pt against a 14pt pitch) is not a figure.
    const page = [...lines(700, 8), ...lines(700 - 7 * 14 - 28, 8)];
    assert.deepEqual(findFigureGaps(page), []);
  });

  it("keeps figures detectable on a page that is mostly figures", () => {
    // Three diagrams, each with only a stem and four options around it. Half the line pitches
    // on this page ARE the gaps, so a mean or median pitch is dragged up until nothing clears
    // the threshold and the page reports no figures at all. The lower quartile still finds the
    // body-text pitch.
    const page = [...lines(760, 6), ...lines(560, 6), ...lines(360, 6), ...lines(160, 6)];
    assert.equal(findFigureGaps(page).length, 3);
  });

  it("counts a labelled diagram once, not once per label", () => {
    // The case that matters most, and these are the REAL baselines measured off a generated
    // two-question physics page: a circuit diagram with "4 ohm" and "6 ohm" printed inside it,
    // then a ray diagram. Each interior label splits its figure's empty space, so naive gap
    // detection reports three figures where there are two.
    const page: PdfTextItem[] = [
      781.9, // "5. In the circuit shown, find the current ..."
      731.9, // "4 ohm"  — a label INSIDE the circuit diagram
      603.9, // "6 ohm"  — a label INSIDE the circuit diagram
      582.9, 566.9, 550.9, 534.9, // options A-D
      498.9, 482.9, // "6. The ray diagram below ..." (two lines)
      316.9, 300.9, 284.9, 268.9 // options A-D, below the ray diagram
    ].map((y) => ({ y, height: 10 }));

    const gaps = findFigureGaps(page);
    assert.equal(gaps.length, 2);
    // The circuit diagram is one band spanning both its labels, not two bands.
    assert.equal(gaps.some((gap) => gap.top === 781.9 && gap.bottom === 603.9), true);
    // The ray diagram sits between the stem and its options.
    assert.equal(gaps.some((gap) => gap.top === 482.9 && gap.bottom === 316.9), true);
  });

  it("does not merge two figures separated by a real block of text", () => {
    // Same shape as above, but with a full question between the diagrams rather than a label.
    // Merging here would under-count, which is the opposite failure.
    const page = [
      ...lines(760, 3),
      ...lines(560, 3), // first figure gap above
      ...lines(500, 6), // a genuine paragraph, too tall to be a label
      ...lines(300, 3) //  second figure gap above
    ];
    assert.equal(findFigureGaps(page).length, 2);
  });

  it("sorts gaps largest first", () => {
    const page = [...lines(760, 4), ...lines(600, 4), ...lines(300, 4)];
    const gaps = findFigureGaps(page);
    assert.ok(gaps.length >= 2);
    assert.ok(gaps[0].height >= gaps[1].height);
  });

  it("returns nothing for a page too sparse to have a meaningful line pitch", () => {
    assert.deepEqual(findFigureGaps(lines(700, 2)), []);
  });

  it("treats items a hair off the baseline as the same line, not a new one", () => {
    // A superscript sits ~1pt above its baseline; it must not register as its own line and
    // manufacture a gap.
    const page = lines(700, 20).flatMap((item) => [item, { y: item.y + 1, height: 6 }]);
    assert.deepEqual(findFigureGaps(page), []);
  });

  it("is order-independent — PDFs do not emit text items top to bottom", () => {
    const page = [...lines(700, 6), ...lines(700 - 5 * 14 - 120, 6)];
    const shuffled = [...page].reverse();
    assert.deepEqual(findFigureGaps(shuffled), findFigureGaps(page));
  });
});

describe("findDocumentFigures", () => {
  it("reports 1-based page numbers and skips text-only pages", () => {
    const figurePage = [...lines(700, 6), ...lines(700 - 5 * 14 - 120, 6)];
    const textPage = lines(760, 40);

    assert.deepEqual(findDocumentFigures([textPage, figurePage, textPage]), [
      { pageNumber: 2, count: 1 }
    ]);
  });
});

describe("describeFigureWarning", () => {
  it("stays silent on a text-only paper", () => {
    assert.equal(describeFigureWarning([lines(760, 40)]), null);
  });

  it("names the pages a teacher has to go and crop", () => {
    const figurePage = [...lines(700, 6), ...lines(700 - 5 * 14 - 120, 6)];
    const warning = describeFigureWarning([figurePage, lines(760, 40), figurePage]);

    assert.ok(warning);
    assert.match(warning, /2 figures/);
    assert.match(warning, /pages 1, 3/);
    assert.match(warning, /Crop from PDF/);
  });

  it("uses the singular for a single figure on a single page", () => {
    const figurePage = [...lines(700, 6), ...lines(700 - 5 * 14 - 120, 6)];
    const warning = describeFigureWarning([figurePage]);

    assert.ok(warning);
    assert.match(warning, /1 figure \(page 1\)/);
  });
});
