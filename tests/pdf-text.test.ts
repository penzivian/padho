import assert from "node:assert/strict";
import test from "node:test";

import { groupIntoLines, renderLine, type TextItem } from "../lib/pdf-text";

// Geometry copied from a real Career Point JEE paper: 10.5pt body, 7pt scripts raised 5pt.
const BODY = 10.5;
const SCRIPT = 7;

function body(str: string, x: number, y = 100): TextItem {
  return { str, x, y, size: BODY };
}
function sup(str: string, x: number, y = 100): TextItem {
  return { str, x, y: y + 5, size: SCRIPT };
}
function sub(str: string, x: number, y = 100): TextItem {
  return { str, x, y: y - 5, size: SCRIPT };
}

test("a raised smaller glyph becomes caret notation", () => {
  // "e² – 1" as the PDF actually stores it: "e", then a small raised "2 ".
  assert.equal(renderLine([body("e", 0), sup("2 ", 6), body("– 1", 12)]), "e^2 – 1");
});

test("a lowered smaller glyph becomes underscore notation", () => {
  assert.equal(renderLine([body("Z", 0), sub("1", 6), body(" = 4", 10)]), "Z_1 = 4");
});

// The regression that made this module necessary: flattening turns "10⁻⁴" into "10-4",
// which reads as a subtraction and is wrong-but-plausible.
test("a negative exponent keeps its sign inside the marker", () => {
  assert.equal(
    renderLine([body("10", 0), sup("–4", 10), body(" NaCl", 18)]),
    "10^(–4) NaCl"
  );
});

test("multi-character scripts are parenthesised, single characters are not", () => {
  assert.equal(renderLine([body("e", 0), sup("λx", 6)]), "e^(λx)");
  assert.equal(renderLine([body("x", 0), sup("2", 6)]), "x^2");
});

test("adjacent script runs merge into one marker", () => {
  // pdf.js splits "e^(–iπ/4)" into four separate raised runs.
  const line = [body("e", 0), sup("–i", 6), sup("π", 10), sup("/4", 13)];
  assert.equal(renderLine(line), "e^(–iπ/4)");
});

// Spaces are their own zero-height items; classifying them by geometry would split runs and
// emit stray markers, and dropping them welds words together.
test("whitespace between words survives and does not split a run", () => {
  const line = [body("Q.2", 0), body(" ", 14), body("Let", 18)];
  assert.equal(renderLine(line), "Q.2 Let");
});

test("a small glyph on the baseline is not a script", () => {
  // Fraction-stack art sits slightly off the baseline but is not an exponent; at dy=1.3 on a
  // 10.5pt line it falls under the 0.25 offset ratio.
  const line = [body("π", 0), { str: "2", x: 6, y: 101.3, size: SCRIPT }];
  assert.equal(renderLine(line), "π2");
});

test("groupIntoLines keeps a raised superscript on its own line", () => {
  const lines = groupIntoLines([body("e", 0, 200), sup("2", 6, 200), body("next", 0, 180)]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].length, 3 - 1);
  assert.equal(renderLine(lines[0]), "e^2");
  assert.equal(renderLine(lines[1]), "next");
});

test("items are ordered by x within a line regardless of input order", () => {
  assert.equal(renderLine([body("world", 50), body("hello ", 0)]), "hello world");
});
