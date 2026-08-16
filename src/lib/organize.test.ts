import { describe, expect, it } from "vitest";

import { organizedSourceCoverageError } from "./organize-coverage";

describe("organized source coverage", () => {
  it("rejects a proposal that summarizes away most of a note", () => {
    expect(
      organizedSourceCoverageError("a".repeat(10_000), "a".repeat(2_000)),
    ).toContain("retained 2000 of 10000");
  });

  it("rejects an otherwise long proposal that drops a source URL", () => {
    const source = `${"a".repeat(1_000)} https://example.com/source`;
    expect(organizedSourceCoverageError(source, "a".repeat(1_000))).toBe(
      "The organized body omitted a source URL.",
    );
  });

  it("rejects an otherwise long proposal that drops a source timestamp", () => {
    const source = `${"a".repeat(1_000)} 01:23:45`;
    expect(organizedSourceCoverageError(source, "a".repeat(1_000))).toBe(
      "The organized body omitted a source timestamp.",
    );
  });

  it("accepts a reorganized body that retains sufficient text and evidence markers", () => {
    const source = `${"a".repeat(1_000)} 12:34 https://example.com/source`;
    const organized = `${"a".repeat(700)} 12:34 https://example.com/source`;
    expect(organizedSourceCoverageError(source, organized)).toBeNull();
  });
});
