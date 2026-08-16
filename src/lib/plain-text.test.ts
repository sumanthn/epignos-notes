import { describe, expect, it } from "vitest";

import { normalizeOrganizedPlainText, normalizeOrganizedTitle } from "./plain-text";

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
});
