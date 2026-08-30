import { z } from "zod";

import { aiMockMode, optionalEnv, requiredEnv } from "@/lib/env";
import { extractDraftQuestions } from "@/lib/extract";
import { normalizeOptions, type DraftOption } from "@/lib/options";

const draftQuestionSchema = z.object({
  question_text: z.string().min(1),
  question_type: z.enum(["mcq", "subjective"]),
  topic: z.string().default("General"),
  options: z.array(z.string()).nullable().default(null),
  correct_answer: z.string().nullable().default(null),
  max_marks: z.coerce.number().positive().default(1),
  negative_marks: z.coerce.number().min(0).default(0).optional(),
  rubric: z.string().nullable().default(null)
});

export const questionListSchema = z.array(draftQuestionSchema).min(1);

const gradeSchema = z.object({
  suggested_marks: z.coerce.number().min(0),
  feedback: z.string().min(1)
});

export type DraftQuestion = {
  question_text: string;
  question_type: "mcq" | "subjective";
  topic: string;
  // Objects rather than plain strings so an answer can carry its own diagram (four graphs as
  // the four choices). normalizeOptions accepts the legacy string form too, so extraction and
  // the AI path can keep emitting strings and be normalized at the boundary.
  options: DraftOption[] | null;
  correct_answer: string | null;
  max_marks: number;
  // Penalty magnitude for a wrong MCQ answer. Optional on the draft so extraction and the
  // AI path need not supply it; normalizeDraftQuestions defaults it to 0 before saving.
  negative_marks?: number;
  // Storage path of a diagram for this question. Never a URL — the app signs it per request.
  image_path?: string | null;
  // Preview URL for the paper-builder UI only: a blob: URL for a crop the teacher just made,
  // or a short-lived signed URL for a bank question's diagram. Deliberately NOT persisted —
  // normalizeDraftQuestions builds its rows field by field and drops it. Never store a URL,
  // or the diagram leaks to anyone holding the link, including before the test opens.
  image_url?: string | null;
  rubric: string | null;
};
export type AiGradeSuggestion = z.infer<typeof gradeSchema>;

type ParsedDraftQuestion = {
  question_text: string;
  question_type: "mcq" | "subjective";
  topic?: string;
  options?: string[] | null;
  correct_answer?: string | null;
  max_marks?: number;
  negative_marks?: number;
  rubric?: string | null;
};

type GenerateQuestionInput = {
  subject: string;
  topic: string;
  examTarget: string;
  difficulty: string;
  count: number;
  mix: string;
};

type GradeInput = {
  question: string;
  rubric: string | null;
  maxMarks: number;
  answer: string;
  // Few-shot block of this teacher's own previously-approved marks for this question, or ""
  // when there is not enough signal — see lib/calibration.ts. Empty leaves the prompt
  // byte-for-byte what it was before calibration existed.
  calibration?: string;
};

export async function generateQuestions(input: GenerateQuestionInput) {
  if (aiMockMode()) return mockQuestions(input);

  const prompt = `Generate ${input.count} ${input.difficulty} ${input.subject} questions for ${input.examTarget}.
Topic: ${input.topic}. Mix: ${input.mix}.
Return ONLY a JSON array. Each item must contain question_text, question_type, topic, options, correct_answer, max_marks, rubric.
MCQ options must be an array and correct_answer must match one option. Subjective questions need a concise rubric.`;

  return normalizeAiQuestions(await claudeValidatedJson(prompt, questionListSchema));
}

export async function extractQuestionsFromFile(file: File) {
  if (aiMockMode()) {
    return extractQuestionsLocally(file);
  }

  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mediaType = file.type || "application/octet-stream";
  const attachment =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: mediaType, data: bytes } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: bytes } };

  const content = [
    {
      type: "text",
      text: "Extract questions from this paper. Return ONLY a JSON array with question_text, question_type, topic, options, correct_answer, max_marks, rubric."
    },
    attachment
  ];

  return normalizeAiQuestions(await claudeValidatedJsonFromContent(content, questionListSchema));
}

// Key-free path: read the PDF's text locally (no API key) and structure it heuristically.
// Images/scans need OCR, so they require the AI path instead.
async function extractQuestionsLocally(file: File): Promise<DraftQuestion[]> {
  const mediaType = file.type || "";
  if (!mediaType.includes("pdf")) {
    throw new Error(
      "Key-free extraction supports text PDFs. For images or scanned files, add an Anthropic API key or enter questions manually."
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : text;

  const questions = extractDraftQuestions(merged);
  if (questions.length === 0) {
    const looksScanned = merged.replace(/\s/g, "").length < 30;
    throw new Error(
      looksScanned
        ? "This PDF has almost no selectable text — it looks scanned. Key-free extraction needs a text PDF; add an Anthropic API key for image/scan support, or enter questions manually."
        : "Read the PDF but couldn't detect numbered questions. It works best when questions are numbered like 1. / 1) / Q1). Enter them manually, or add an Anthropic API key for AI extraction."
    );
  }
  return questions;
}

export async function gradeSubjectiveAnswer(input: GradeInput) {
  if (aiMockMode()) {
    const suggested = Math.max(0, Math.round(input.maxMarks * 0.7 * 100) / 100);
    return {
      suggested_marks: suggested,
      feedback: "Covers the main idea. Add one more supporting step or example for full marks."
    };
  }

  const prompt = [
    "Grade this student answer as a suggestion for the teacher.",
    `Question: ${input.question}`,
    `Rubric: ${input.rubric || "Use a fair subject-specific rubric."}`,
    `Max marks: ${input.maxMarks}`,
    input.calibration,
    `Student answer: ${input.answer}`,
    "Return ONLY JSON with suggested_marks and feedback."
  ]
    .filter(Boolean)
    .join("\n");

  return claudeValidatedJson(prompt, gradeSchema);
}

export async function answerDoubt(question: string, examTarget: string | null) {
  if (aiMockMode()) {
    return `Let's break it down for ${examTarget || "your batch"}: ${question.trim()} usually becomes easier if you identify the known values, choose the relevant formula or concept, and then solve one step at a time.`;
  }

  const prompt = `You are a patient tutor for ${examTarget || "an Indian coaching batch"}.
Answer this doubt with clear step-by-step reasoning and no unnecessary fluff:
${question}`;

  return claudeText(prompt);
}

function mockQuestions(input: GenerateQuestionInput): DraftQuestion[] {
  const count = Math.max(1, Math.min(input.count, 12));

  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const subjective = input.mix.toLowerCase().includes("subjective") && n % 2 === 0;

    if (subjective) {
      return {
        question_text: `Explain the key idea behind ${input.topic} for ${input.examTarget}.`,
        question_type: "subjective",
        topic: input.topic || "General",
        options: null,
        correct_answer: null,
        max_marks: 3,
        rubric: "Award marks for concept clarity, correct terminology, and a complete final explanation."
      };
    }

    return {
      question_text: `${input.subject}: which option best matches ${input.topic} concept ${n}?`,
      question_type: "mcq",
      topic: input.topic || "General",
      options: normalizeOptions(["Option A", "Option B", "Option C", "Option D"]),
      correct_answer: "Option A",
      max_marks: 1,
      rubric: null
    };
  });
}

function normalizeAiQuestions(questions: ParsedDraftQuestion[]): DraftQuestion[] {
  return questions.map((question) => ({
    question_text: question.question_text,
    question_type: question.question_type,
    topic: question.topic ?? "General",
    options: question.options ? normalizeOptions(question.options) : null,
    correct_answer: question.correct_answer ?? null,
    max_marks: question.max_marks ?? 1,
    negative_marks: question.negative_marks ?? 0,
    rubric: question.rubric ?? null
  }));
}

async function claudeValidatedJson<T>(prompt: string, schema: z.ZodType<T>) {
  return claudeValidatedJsonFromContent([{ type: "text", text: prompt }], schema);
}

// Single validate-and-retry path shared by text prompts and multimodal (vision/document)
// extraction. On a parse failure it retries once, appending an explicit "valid JSON"
// instruction while preserving the original content (including any attachment).
async function claudeValidatedJsonFromContent<T>(content: unknown[], schema: z.ZodType<T>) {
  try {
    return schema.parse(extractJson(await claudeRaw(content)));
  } catch {
    const retryContent = [
      ...content,
      {
        type: "text",
        text: "Your previous response was invalid. Return ONLY valid JSON matching the requested schema."
      }
    ];
    return schema.parse(extractJson(await claudeRaw(retryContent)));
  }
}

async function claudeText(prompt: string) {
  return claudeRaw([{ type: "text", text: prompt }]);
}

async function claudeRaw(content: unknown[]) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": requiredEnv("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: optionalEnv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
      max_tokens: 2000,
      messages: [{ role: "user", content }]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude request failed: ${response.status}`);
  }

  const body = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };

  return body.content?.find((item) => item.type === "text")?.text ?? "";
}

export function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const firstArray = text.indexOf("[");
    const lastArray = text.lastIndexOf("]");
    const firstObject = text.indexOf("{");
    const lastObject = text.lastIndexOf("}");

    if (firstArray >= 0 && lastArray > firstArray) {
      return JSON.parse(text.slice(firstArray, lastArray + 1));
    }

    if (firstObject >= 0 && lastObject > firstObject) {
      return JSON.parse(text.slice(firstObject, lastObject + 1));
    }

    throw new Error("AI response did not contain valid JSON");
  }
}
