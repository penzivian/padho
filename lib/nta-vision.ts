import { z } from "zod";

// Vision transcription for NTA question images.
//
// NTA's papers hold every stem and option as a picture, so this is the only way to get their
// text. It is a deliberate upside as well as a cost: the image renders notation perfectly,
// which sidesteps the whole class of damage that text extraction inflicts on these papers —
// no flattened exponents, no collapsed stacked fractions, no bracket art.
//
// Follows the same shape as `lib/ai.ts`: zod-validated, retried once on a parse failure, and
// mock-first so the pipeline is exercisable end-to-end without a key or a bill.
//
// Kept out of `lib/ai.ts` on purpose. That adapter is the app's AI surface and every call
// through it must record usage against the per-teacher cap (`ai_usage_events`). This is an
// owner-run ingestion tool, not a teacher action; billing it to a teacher's monthly quota
// would be wrong, and so would quietly adding an uncapped path to the app's adapter.

const transcriptionSchema = z.object({
  // Markdown-ish plain text. LaTeX is allowed for real notation and is what makes these
  // transcriptions better than anything the PDF text layer can give us.
  stem: z.string().min(1),
  options: z.array(z.string()).default([]),
  // The model's own read of whether the picture carries a diagram the text cannot replace.
  has_diagram: z.boolean().default(false)
});

export type NtaTranscription = z.infer<typeof transcriptionSchema>;

export type VisionImage = { mediaType: string; base64: string };

const SYSTEM_PROMPT =
  "You transcribe exam questions from images of an official JEE Main paper. " +
  "Reproduce the text EXACTLY as printed — never solve, rephrase, translate or correct it. " +
  "Write mathematics as LaTeX between $ delimiters (e.g. $10^{-4}$, $\\frac{1}{2}$, $\\int_0^\\pi$). " +
  "Chemistry formulae keep their sub/superscripts ($\\mathrm{Al^{3+}}$, $\\mathrm{H_2SO_4}$). " +
  "If an image is a figure, circuit, graph or geometric diagram that the words cannot stand in " +
  "for, set has_diagram true and describe it in one clause rather than inventing detail.";

function mockTranscription(optionCount: number): NtaTranscription {
  return {
    stem: "Mock transcription of an NTA question stem.",
    options: Array.from({ length: optionCount }, (_, i) => `Mock option ${i + 1}`),
    has_diagram: false
  };
}

export type TranscribeOptions = {
  apiKey: string | undefined;
  model: string;
  // When true, returns deterministic placeholder text and makes no network call, so the
  // extraction and join can be verified without spending anything.
  mock: boolean;
};

export async function transcribeQuestion(
  stemImages: VisionImage[],
  optionImages: VisionImage[],
  options: TranscribeOptions
): Promise<NtaTranscription> {
  if (options.mock || !options.apiKey) return mockTranscription(optionImages.length);

  const content: unknown[] = [
    { type: "text", text: "Question stem:" },
    ...stemImages.map(asImageBlock)
  ];

  optionImages.forEach((image, index) => {
    content.push({ type: "text", text: `Option ${index + 1}:` });
    content.push(asImageBlock(image));
  });

  content.push({
    type: "text",
    text:
      'Return ONLY JSON: {"stem": string, "options": string[], "has_diagram": boolean}. ' +
      `The options array must have exactly ${optionImages.length} entries, in the order shown.`
  });

  return callWithRetry(content, options);
}

function asImageBlock(image: VisionImage) {
  return {
    type: "image",
    source: { type: "base64", media_type: image.mediaType, data: image.base64 }
  };
}

async function callWithRetry(content: unknown[], options: TranscribeOptions) {
  try {
    return transcriptionSchema.parse(extractJson(await call(content, options)));
  } catch {
    const retry = [
      ...content,
      { type: "text", text: "Your previous response was invalid. Return ONLY the JSON object." }
    ];
    return transcriptionSchema.parse(extractJson(await call(retry, options)));
  }
}

async function call(content: unknown[], options: TranscribeOptions) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": options.apiKey as string,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  const body = (await response.json()) as { content?: { type: string; text?: string }[] };
  return body.content?.find((part) => part.type === "text")?.text ?? "";
}

// Models sometimes wrap JSON in prose or a fenced block; take the outermost object.
export function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in response");
  return JSON.parse(candidate.slice(start, end + 1));
}
