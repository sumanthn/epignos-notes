import { createHash, randomUUID } from "node:crypto";

export interface ParagraphBlock {
  type: "paragraph";
  id: string;
  text: string;
}

export interface CanonicalContent {
  type: "doc";
  content: ParagraphBlock[];
}

export const MAX_NOTE_TEXT_LENGTH = 1_000_000;

export function contentFromText(
  text: string,
  previous?: CanonicalContent,
): CanonicalContent {
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  return {
    type: "doc",
    content: lines.map((line, index) => ({
      type: "paragraph",
      id: previous?.content[index]?.id ?? randomUUID(),
      text: line,
    })),
  };
}

export function textFromContent(value: unknown): string {
  if (!isCanonicalContent(value)) return "";
  return value.content.map((block) => block.text).join("\n");
}

export function isCanonicalContent(value: unknown): value is CanonicalContent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CanonicalContent>;

  return (
    candidate.type === "doc" &&
    Array.isArray(candidate.content) &&
    candidate.content.every(
      (block) =>
        block &&
        block.type === "paragraph" &&
        typeof block.id === "string" &&
        typeof block.text === "string",
    )
  );
}

export function contentHash(content: CanonicalContent): string {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}
