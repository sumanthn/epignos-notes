import { describe, expect, it } from "vitest";

import {
  isUntitledNoteTitle,
  normalizeOrganizedPlainText,
  normalizeOrganizedSummary,
  normalizeOrganizedTitle,
  noteTextWithoutApprovedSummary,
  noteTextWithSummary,
} from "./plain-text";

describe("plain-text AI output normalization", () => {
  it("turns common Markdown structure into readable plain text", () => {
    const input = [
      "## Background",
      "**Nationalism** developed over time.",
      "",
      "- 0:00 Intro",
      "* 4:49 France",
      "```",
      "accidental fence",
      "```",
    ].join("\n");

    expect(normalizeOrganizedPlainText(input)).toBe(
      [
        "Background",
        "Nationalism developed over time.",
        "",
        "• 0:00 Intro",
        "• 4:49 France",
        "accidental fence",
      ].join("\n"),
    );
  });

  it("preserves URLs and ordinary underscores", () => {
    const input = "Source\nhttps://example.com/watch?v=a_b-c\nfile_name stays readable";
    expect(normalizeOrganizedPlainText(input)).toBe(input);
  });

  it("removes Markdown decoration from a proposed title", () => {
    expect(normalizeOrganizedTitle("# **Nationalism notes**")).toBe("Nationalism notes");
  });

  it("keeps summaries to one plain-text paragraph", () => {
    expect(normalizeOrganizedSummary("**A short overview.**\nNo facts are added.")).toBe(
      "A short overview. No facts are added.",
    );
  });

  it("recognizes only default untitled titles", () => {
    expect(isUntitledNoteTitle("Untitled note")).toBe(true);
    expect(isUntitledNoteTitle("UNTITLED")).toBe(true);
    expect(isUntitledNoteTitle("My untitled research")).toBe(false);
  });

  it("places and removes an approved summary without touching source text", () => {
    const rendered = noteTextWithSummary("A short overview.", "Source\n• Detail");
    expect(rendered).toBe("Summary\nA short overview.\n\nSource\n• Detail");
    expect(noteTextWithoutApprovedSummary(rendered, "A short overview.")).toBe(
      "Source\n• Detail",
    );
    expect(noteTextWithoutApprovedSummary(rendered, "A different summary.")).toBe(rendered);
  });
});
