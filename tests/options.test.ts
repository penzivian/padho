import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectOptionImagePaths,
  normalizeOptions,
  optionLabel,
  optionTexts,
  signOptions,
  toStoredOptions
} from "@/lib/options";

describe("normalizeOptions", () => {
  it("reads the legacy string[] shape every saved paper uses", () => {
    assert.deepEqual(normalizeOptions(["ut", "ut + at²/2"]), [
      { text: "ut", image_path: null },
      { text: "ut + at²/2", image_path: null }
    ]);
  });

  it("keeps empty legacy strings, matching what the old call sites did", () => {
    // A paper that already carries a blank option must render exactly as it did before.
    assert.deepEqual(normalizeOptions(["", "b"]), [
      { text: "", image_path: null },
      { text: "b", image_path: null }
    ]);
  });

  it("reads the object shape with per-option diagrams", () => {
    assert.deepEqual(
      normalizeOptions([
        { text: "Graph A", image_path: "uid/a.webp" },
        { text: "Graph B", image_path: "uid/b.webp" }
      ]),
      [
        { text: "Graph A", image_path: "uid/a.webp" },
        { text: "Graph B", image_path: "uid/b.webp" }
      ]
    );
  });

  it("labels an image-only option with its letter", () => {
    // correct_answer stores the option TEXT, so a blank option would be indistinguishable from
    // its neighbour and would silently mis-score.
    assert.deepEqual(
      normalizeOptions([
        { image_path: "uid/a.webp" },
        { image_path: "uid/b.webp" },
        { text: "", image_path: "uid/c.webp" }
      ]),
      [
        { text: "A", image_path: "uid/a.webp" },
        { text: "B", image_path: "uid/b.webp" },
        { text: "C", image_path: "uid/c.webp" }
      ]
    );
  });

  it("handles a paper part-way through being given diagrams", () => {
    assert.deepEqual(normalizeOptions(["plain", { text: "with figure", image_path: "uid/x.webp" }]), [
      { text: "plain", image_path: null },
      { text: "with figure", image_path: "uid/x.webp" }
    ]);
  });

  it("drops junk rather than rendering a blank choice", () => {
    assert.deepEqual(normalizeOptions([{ text: "", image_path: "" }, {}, null, 42, "keep"]), [
      { text: "keep", image_path: null }
    ]);
  });

  it("returns nothing for a subjective question or a malformed column", () => {
    for (const raw of [null, undefined, "not an array", 7, {}]) {
      assert.deepEqual(normalizeOptions(raw), []);
    }
  });

  it("ignores a non-string image_path", () => {
    assert.deepEqual(normalizeOptions([{ text: "a", image_path: 5 }]), [
      { text: "a", image_path: null }
    ]);
  });
});

describe("optionTexts", () => {
  it("flattens to the plain strings that scoring and fingerprints use", () => {
    assert.deepEqual(
      optionTexts(["a", { text: "b", image_path: "uid/b.webp" }, { image_path: "uid/c.webp" }]),
      ["a", "b", "C"]
    );
  });
});

describe("optionLabel", () => {
  it("numbers options the way a paper prints them", () => {
    assert.deepEqual([0, 1, 2, 3].map(optionLabel), ["A", "B", "C", "D"]);
  });
});

describe("collectOptionImagePaths", () => {
  it("gathers every option image across a paper for one signing call", () => {
    assert.deepEqual(
      collectOptionImagePaths([
        ["plain", "text"],
        [{ text: "a", image_path: "uid/a.webp" }, { text: "b", image_path: "uid/b.webp" }],
        null
      ]),
      [null, null, "uid/a.webp", "uid/b.webp"]
    );
  });
});

describe("signOptions", () => {
  it("attaches a signed URL to each option that has a diagram", () => {
    const signed = new Map([["uid/a.webp", "https://signed/a"]]);
    assert.deepEqual(signOptions([{ text: "a", image_path: "uid/a.webp" }, "b"], signed), [
      { text: "a", image_path: "uid/a.webp", image_url: "https://signed/a" },
      { text: "b", image_path: null, image_url: null }
    ]);
  });

  it("renders as text when a diagram cannot be signed, rather than failing the paper", () => {
    assert.deepEqual(signOptions([{ text: "a", image_path: "uid/gone.webp" }], new Map()), [
      { text: "a", image_path: "uid/gone.webp", image_url: null }
    ]);
  });
});

describe("toStoredOptions", () => {
  it("drops the UI-only image_url so a URL can never reach the database", () => {
    assert.deepEqual(
      toStoredOptions([
        { text: "a", image_path: "uid/a.webp", image_url: "blob:whatever" },
        { text: "b", image_path: null, image_url: null }
      ]),
      [
        { text: "a", image_path: "uid/a.webp" },
        { text: "b", image_path: null }
      ]
    );
  });

  it("fills the letter before saving, so correct_answer always has something to match", () => {
    assert.deepEqual(toStoredOptions([{ image_path: "uid/a.webp" }, { image_path: "uid/b.webp" }]), [
      { text: "A", image_path: "uid/a.webp" },
      { text: "B", image_path: "uid/b.webp" }
    ]);
  });
});
