import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupTopics,
  normalizeForFingerprint,
  sanitizeSearchTerm,
  topicKey
} from "@/lib/question-bank";
import { optionTexts } from "@/lib/options";

const mcq = (questionText: string, options: string[] | null = null) => ({
  questionText,
  questionType: "mcq" as const,
  options
});

describe("bank fingerprinting", () => {
  it("treats the same question as the same regardless of case, spacing and punctuation", () => {
    // The same paper re-extracted from a different PDF rarely comes back byte-identical.
    assert.equal(
      normalizeForFingerprint(mcq("What is Newton's  second   law?")),
      normalizeForFingerprint(mcq("what is newtons second law"))
    );
  });

  it("ignores option order, which extraction does not preserve reliably", () => {
    assert.equal(
      normalizeForFingerprint(mcq("Pick one", ["alpha", "beta", "gamma"])),
      normalizeForFingerprint(mcq("Pick one", ["gamma", "alpha", "beta"]))
    );
  });

  it("separates two questions that share a stem but differ in options", () => {
    // "Which of the following is correct?" is a stem shared by hundreds of questions.
    assert.notEqual(
      normalizeForFingerprint(mcq("Which of the following is correct?", ["a", "b"])),
      normalizeForFingerprint(mcq("Which of the following is correct?", ["c", "d"]))
    );
  });

  it("does not confuse a written question with an MCQ that shares its stem", () => {
    assert.notEqual(
      normalizeForFingerprint(mcq("Explain inertia", ["a", "b"])),
      normalizeForFingerprint({
        questionText: "Explain inertia",
        questionType: "subjective",
        options: null
      })
    );
  });

  it("keeps non-Latin scripts intact rather than stripping them to nothing", () => {
    const hindi = normalizeForFingerprint({
      questionText: "जड़त्व क्या है?",
      questionType: "subjective",
      options: null
    });

    assert.ok(hindi.length > 0);
    assert.notEqual(hindi, "");
  });
});

describe("bank topic grouping", () => {
  it("folds case and spacing variants into one entry", () => {
    // topic is free text and drives every analytic, so the bank must not offer the teacher
    // three near-identical filters for what is really one topic.
    const grouped = groupTopics(["Kinematics", "kinematics", "  KINEMATICS  ", "Optics"]);

    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].label, "Kinematics");
    assert.equal(grouped[0].count, 3);
  });

  it("picks the most-used label, breaking ties deterministically", () => {
    const grouped = groupTopics(["optics", "optics", "Optics"]);
    assert.equal(grouped[0].label, "optics");

    const tied = groupTopics(["Optics", "optics"]);
    assert.equal(tied[0].label, "Optics");
  });

  it("ignores blank topics", () => {
    assert.deepEqual(groupTopics(["   ", ""]), []);
  });

  it("normalizes a topic key for filtering", () => {
    assert.equal(topicKey("  Laws Of Motion "), "laws of motion");
  });
});

describe("bank search term", () => {
  it("drops a query too short or too noisy to be a real filter", () => {
    assert.equal(sanitizeSearchTerm(""), "");
    assert.equal(sanitizeSearchTerm("a"), "");
    assert.equal(sanitizeSearchTerm("?!  *"), "");
  });

  it("keeps quoted phrases, which websearch_to_tsquery understands", () => {
    assert.equal(sanitizeSearchTerm('"newton\'s third law"'), '"newton\'s third law"');
  });

  it("collapses noise around real terms", () => {
    assert.equal(sanitizeSearchTerm("  kinematics!!   graphs  "), "kinematics graphs");
  });
});

describe("fingerprint ignores option diagrams (D3)", () => {
  it("dedupes the same question re-extracted with different crops", () => {
    // The bank stores option TEXT in the fingerprint and never the image. Re-importing the same
    // paper from a different PDF produces differently-cropped diagrams; if those entered the
    // hash, every re-import would create duplicate rows.
    const withoutImages = normalizeForFingerprint({
      questionText: "Which graph shows uniform acceleration?",
      questionType: "mcq",
      options: optionTexts(["A", "B", "C", "D"])
    });
    const withImages = normalizeForFingerprint({
      questionText: "Which graph shows uniform acceleration?",
      questionType: "mcq",
      options: optionTexts([
        { text: "A", image_path: "uid/crop-1-a.webp" },
        { text: "B", image_path: "uid/crop-1-b.webp" },
        { text: "C", image_path: "uid/crop-1-c.webp" },
        { text: "D", image_path: "uid/crop-1-d.webp" }
      ])
    });

    assert.equal(withImages, withoutImages);
  });

  it("still separates two questions that share a stem but differ in options", () => {
    const a = normalizeForFingerprint({
      questionText: "Which of the following is correct?",
      questionType: "mcq",
      options: optionTexts([{ text: "Only I", image_path: "uid/a.webp" }, { text: "Only II" }])
    });
    const b = normalizeForFingerprint({
      questionText: "Which of the following is correct?",
      questionType: "mcq",
      options: optionTexts([{ text: "Only III", image_path: "uid/a.webp" }, { text: "Only IV" }])
    });

    assert.notEqual(a, b);
  });
});
