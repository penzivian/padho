// Layout-aware PDF text extraction.
//
// `unpdf`'s `extractText` concatenates glyph runs and throws away their geometry, which
// silently destroys exponents and indices: "e²" arrives as "e2", "10⁻⁴" as "10-4", "Al³⁺"
// as "Al3". That is the worst possible failure for a question bank, because the result is
// still readable — a student sees "10-4 NaCl" and reads "10 minus 4". Wrong but plausible.
//
// PDFs do not mark a superscript; they just draw a smaller glyph on a raised baseline. So
// this reconstructs the distinction from the text items' own geometry and re-emits it as
// caret/underscore notation ("e^2", "10^-4", "Z_1"), which survives as plain text and is a
// step toward the LaTeX rendering the papers will eventually want.

export type TextItem = {
  str: string;
  // From pdf.js `transform`: [scaleX, skewY, skewX, scaleY, x, y].
  x: number;
  y: number;
  size: number;
};

// A glyph run counts as raised/lowered only if it is BOTH meaningfully smaller than the
// line's body text and offset from its baseline. Size alone catches fraction bars and
// bracket art; offset alone catches ordinary kerning jitter.
const SCRIPT_SIZE_RATIO = 0.85;
// Offset is measured as a fraction of the body size so it holds at any zoom. Real exponents
// in these papers sit at ~0.48 of body size; fraction-stack noise sits near ~0.12.
const SCRIPT_OFFSET_RATIO = 0.25;
// Items whose baselines are within this many points belong to the same visual line. A
// superscript is raised, so the tolerance must exceed its offset or it starts a new line.
const LINE_TOLERANCE = 6;

type Script = "normal" | "super" | "sub";
// Only produced by classifyScript for whitespace; never appears in an emitted run.
type ScriptOrInherit = Script | "inherit";

export function groupIntoLines(items: TextItem[]): TextItem[][] {
  // Whitespace-only runs are kept: pdf.js emits the gaps between words as their own items,
  // so dropping them welds neighbouring words together ("Q.2Let f").
  const sorted = [...items]
    .filter((item) => item.str.length > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: TextItem[][] = [];
  for (const item of sorted) {
    const current = lines[lines.length - 1];
    if (current && Math.abs(current[0].y - item.y) < LINE_TOLERANCE) current.push(item);
    else lines.push([item]);
  }

  return lines.map((line) => [...line].sort((a, b) => a.x - b.x));
}

function classifyScript(item: TextItem, bodySize: number, baseline: number): ScriptOrInherit {
  // A space carries no glyph, so its geometry is meaningless — classifying it would split a
  // run in two and emit a stray marker. Let it inherit whatever run it lands in.
  if (!item.str.trim()) return "inherit";
  if (item.size >= bodySize * SCRIPT_SIZE_RATIO) return "normal";

  const offset = item.y - baseline;
  if (offset > bodySize * SCRIPT_OFFSET_RATIO) return "super";
  if (offset < -bodySize * SCRIPT_OFFSET_RATIO) return "sub";
  return "normal";
}

// Single characters read better bare ("e^2"); anything longer needs grouping or the
// notation becomes ambiguous ("e^-iπ/4" vs "e^(-iπ/4)").
function wrap(text: string, script: Script) {
  if (script === "normal") return text;
  const core = text.trim();
  if (!core) return text;

  // Whitespace stays outside the marker, or "e" + "2 " renders as "e^2" and the space that
  // separated the next token is swallowed ("e^2– 1" instead of "e^2 – 1").
  const lead = text.slice(0, text.length - text.trimStart().length);
  const trail = text.slice(text.trimEnd().length);
  const marker = script === "super" ? "^" : "_";
  const body = core.length === 1 ? `${marker}${core}` : `${marker}(${core})`;
  return `${lead}${body}${trail}`;
}

export function renderLine(items: TextItem[]): string {
  if (items.length === 0) return "";

  // Sorted here rather than relying on the caller: reading order is left-to-right, and a
  // caller holding items in PDF draw order would otherwise get them concatenated backwards.
  const line = [...items].sort((a, b) => a.x - b.x);

  // Body size is the largest run on the line; the baseline is the lowest normal-sized run,
  // not the minimum overall, so a subscript cannot drag the reference down with it.
  const bodySize = Math.max(...line.map((item) => item.size));
  const bodyItems = line.filter((item) => item.size >= bodySize * SCRIPT_SIZE_RATIO);
  const baseline = bodyItems.length
    ? Math.min(...bodyItems.map((item) => item.y))
    : Math.min(...line.map((item) => item.y));

  // Merge consecutive runs sharing a script so "e" + "–i" + "π" + "/4" becomes one
  // "^(–iπ/4)" rather than four separate carets.
  const runs: { script: Script; text: string }[] = [];
  for (const item of line) {
    const script = classifyScript(item, bodySize, baseline);
    const last = runs[runs.length - 1];
    if (last && (script === "inherit" || last.script === script)) last.text += item.str;
    else runs.push({ script: script === "inherit" ? "normal" : script, text: item.str });
  }

  return runs.map((run) => wrap(run.text, run.script)).join("");
}

export function renderPage(items: TextItem[]): string {
  return groupIntoLines(items).map(renderLine).join("\n");
}

// Reads a PDF preserving super/subscripts. Mirrors how `lib/ai.ts` loads `unpdf`, so the
// dependency stays a dynamic import and never lands in a client bundle.
export async function extractLayoutText(data: Uint8Array): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(data);

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    // pdf.js types `items` as (TextItem | TextMarkedContent)[]; only the former carries a
    // glyph run, and marked-content entries have neither `str` nor `transform`.
    const items: TextItem[] = [];
    for (const entry of content.items as unknown[]) {
      const candidate = entry as { str?: unknown; transform?: unknown };
      if (typeof candidate.str !== "string" || !Array.isArray(candidate.transform)) continue;
      const transform = candidate.transform as number[];
      items.push({
        str: candidate.str,
        x: transform[4],
        y: transform[5],
        size: Math.abs(transform[3]) || 1
      });
    }
    pages.push(renderPage(items));
  }

  return pages.join("\n");
}
