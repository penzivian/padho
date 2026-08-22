// Detects where a question paper's figures sit, without rendering or OCR.
//
// Extraction reads a PDF's text layer and silently drops everything else, so a paper full of
// circuit and ray diagrams extracts as "45/45 questions" with every figure missing. This finds
// the figures so the teacher is told rather than discovering it from a student mid-test.
//
// The signal is geometric: body text on a page runs at a near-constant line pitch, so a
// vertical band with no text in it is almost always a figure. That catches VECTOR diagrams
// (LaTeX/TikZ, Word shapes) as well as raster ones — unpdf's extractImages only sees embedded
// raster objects, and most JEE figures are drawn as paths, so it would miss them entirely.
//
// Coordinates are PDF user space, taken straight off the text item's transform: y is the
// BASELINE, the origin is bottom-left, and y increases UPWARD. (unpdf's types call this
// "device space", but no viewport transform is applied.) So a page reads top to bottom in
// DESCENDING y — the inverse of canvas coordinates.

export type PdfTextItem = { y: number; height: number };

// A band of empty vertical space, in PDF user space. `top` is the larger y.
export type FigureGap = { top: number; bottom: number; height: number };

// Lines closer together than this share a baseline: superscripts, inline fractions and
// option letters typeset slightly off the line would otherwise each read as their own line.
const SAME_LINE_TOLERANCE = 2;

// A gap must beat the page's own line pitch by this much to count as a figure. Chosen high
// enough that paragraph spacing and section headings don't register — a false "this question
// has a figure" is worse than silence, because it trains the teacher to ignore the warning.
const PITCH_MULTIPLE = 3;

// Absolute floor in points (~0.7in). Guards a page with only two or three text lines, where
// the line pitch is meaningless and any gap would otherwise look enormous.
const MIN_GAP_POINTS = 48;

// Two empty bands separated by no more than this many lines of text are one figure whose own
// labels sit inside it. Real diagrams nearly always carry interior text — component values on
// a circuit, axis numbers on a graph, angle marks on a ray diagram — and each label splits the
// figure's empty space in two. Without this a single labelled circuit reads as two or three
// figures, which is over-counting on precisely the diagram-heavy papers this exists for.
const LABEL_LINES_ALLOWED = 2.5;

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(fraction * (sorted.length - 1))];
}

// Collapse text items onto their baselines, ordered down the page (descending y).
function baselines(items: PdfTextItem[]): number[] {
  const sorted = [...items].map((item) => item.y).sort((a, b) => b - a);
  const lines: number[] = [];
  for (const y of sorted) {
    if (lines.length === 0 || Math.abs(lines[lines.length - 1] - y) > SAME_LINE_TOLERANCE) {
      lines.push(y);
    }
  }
  return lines;
}

// Empty vertical bands on one page, largest gaps first.
export function findFigureGaps(items: PdfTextItem[]): FigureGap[] {
  const lines = baselines(items);
  if (lines.length < 3) return [];

  const pitches: number[] = [];
  for (let i = 1; i < lines.length; i += 1) pitches.push(lines[i - 1] - lines[i]);

  // A low percentile, not the mean or even the median. On a page that is half figures, half
  // the pitches ARE the gaps, so both the mean and the median get dragged up until the figures
  // no longer clear their own threshold and the page reports nothing. Body-text pitch is the
  // dominant SMALL value on any page, whatever else is on it, so the lower quartile finds it.
  const bodyPitch = percentile(pitches, 0.25);
  const threshold = Math.max(bodyPitch * PITCH_MULTIPLE, MIN_GAP_POINTS);

  const gaps: FigureGap[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const height = lines[i - 1] - lines[i];
    if (height >= threshold) {
      gaps.push({ top: lines[i - 1], bottom: lines[i], height });
    }
  }

  // Coalesce bands split by a figure's own labels. Gaps are still in page order here
  // (descending y), which is what makes a single forward pass enough.
  const slack = bodyPitch * LABEL_LINES_ALLOWED;
  const merged: FigureGap[] = [];
  for (const gap of gaps) {
    const previous = merged[merged.length - 1];
    if (previous && previous.bottom - gap.top <= slack) {
      previous.bottom = gap.bottom;
      previous.height = previous.top - previous.bottom;
    } else {
      merged.push({ ...gap });
    }
  }

  return merged.sort((a, b) => b.height - a.height);
}

// How many figures a whole document appears to carry, by page. Pages are 0-indexed to match
// the array unpdf's extractTextItems returns; `pageNumber` is the 1-based number a teacher
// would actually type into the crop tool.
export function findDocumentFigures(pages: PdfTextItem[][]): { pageNumber: number; count: number }[] {
  return pages
    .map((items, index) => ({ pageNumber: index + 1, count: findFigureGaps(items).length }))
    .filter((page) => page.count > 0);
}

// One line for the teacher, or null when the paper looks like plain text. Deliberately hedged
// ("appears to") — this is a geometric guess, and a wide table or a signature block can read
// as a figure. It points at the fix rather than blocking the save.
export function describeFigureWarning(pages: PdfTextItem[][]): string | null {
  const figures = findDocumentFigures(pages);
  if (figures.length === 0) return null;

  const total = figures.reduce((sum, page) => sum + page.count, 0);
  const pageList = figures.map((page) => page.pageNumber).join(", ");
  return (
    `This paper appears to contain ${total} figure${total === 1 ? "" : "s"} ` +
    `(page${figures.length === 1 ? "" : "s"} ${pageList}). ` +
    "Extraction reads text only, so diagrams are not attached automatically — " +
    'use "Crop from PDF" on each question that needs one.'
  );
}
