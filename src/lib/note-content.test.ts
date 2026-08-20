import { describe, expect, it } from "vitest";

import {
  contentFromText,
  contentHash,
  hasRichFormatting,
  isCanonicalContent,
  markdownFromContent,
  normalizeRichTextContent,
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

    expect(edited.content.map((block) => block.attrs?.id)).toEqual(
      original.content.map((block) => block.attrs?.id),
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

  it("extracts useful plain text from lists, checklists, code, and tables", () => {
    const content = normalizeRichTextContent({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Plan" }] },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Ship editor" }] }],
            },
          ],
        },
        {
          type: "codeBlock",
          attrs: { language: "typescript" },
          content: [{ type: "text", text: "const ready = true;" }],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Feature" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "State" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Markdown" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Optional" }] }] },
              ],
            },
          ],
        },
      ],
    });

    expect(content).not.toBeNull();
    expect(textFromContent(content)).toBe("Plan\nShip editor\nconst ready = true;\nFeature\tState\nMarkdown\tOptional");
    expect(markdownFromContent(content)).toContain("- [x] Ship editor");
    expect(markdownFromContent(content)).toContain("```typescript\nconst ready = true;\n```");
    expect(markdownFromContent(content)).toContain("| Feature | State |");
  });

  it("rejects unsafe links and unsupported nodes", () => {
    expect(normalizeRichTextContent({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "unsafe", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
      }],
    })).toBeNull();
    expect(normalizeRichTextContent({
      type: "doc",
      content: [{ type: "image", attrs: { src: "https://example.com/x.png" } }],
    })).toBeNull();
    expect(normalizeRichTextContent({
      type: "doc",
      content: [{ type: "text", text: "Text cannot be a direct document child" }],
    })).toBeNull();
  });

  it("detects formatting that an AI organization would replace", () => {
    expect(hasRichFormatting(contentFromText("plain text"))).toBe(false);
    expect(hasRichFormatting({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "bold", marks: [{ type: "bold" }] }] }],
    })).toBe(true);
    expect(hasRichFormatting({
      type: "doc",
      content: [{ type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph" }] }] }],
    })).toBe(true);
  });
});
