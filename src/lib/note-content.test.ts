import { describe, expect, it } from "vitest";

import {
  contentFromText,
  contentHash,
  isCanonicalContent,
  textFromContent,
} from "./note-content";

describe("canonical note content", () => {
  it("round-trips multiline text without losing blank lines", () => {
    const original = "First thought\n\nSecond thought";
    const content = contentFromText(original);

    expect(isCanonicalContent(content)).toBe(true);
    expect(textFromContent(content)).toBe(original);
  });

  it("keeps stable block ids when existing lines are edited", () => {
    const original = contentFromText("one\ntwo");
    const edited = contentFromText("one changed\ntwo", original);

    expect(edited.content.map((block) => block.id)).toEqual(
      original.content.map((block) => block.id),
    );
  });

  it("produces deterministic hashes", () => {
    const content = contentFromText("same source");
    expect(contentHash(content)).toBe(contentHash(content));
    expect(contentHash(content)).not.toBe(contentHash(contentFromText("different source")));
  });

  it("rejects malformed content", () => {
    expect(isCanonicalContent({ type: "doc", content: [{ type: "script" }] })).toBe(false);
  });
});
