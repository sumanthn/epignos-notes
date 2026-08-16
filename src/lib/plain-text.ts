const FENCED_CODE_LINE = /^\s*```/;
const MARKDOWN_HEADING = /^\s{0,3}#{1,6}\s+/;
const MARKDOWN_BULLET = /^\s*[-*+]\s+/;

function removeInlineMarkdown(value: string): string {
  return value
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");
}

export function normalizeOrganizedPlainText(value: string): string {
  return value
    .split("\n")
    .filter((line) => !FENCED_CODE_LINE.test(line))
    .map((line) =>
      removeInlineMarkdown(
        line.replace(MARKDOWN_HEADING, "").replace(MARKDOWN_BULLET, "• "),
      ).trimEnd(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeOrganizedTitle(value: string): string {
  return removeInlineMarkdown(value.replace(MARKDOWN_HEADING, "")).trim();
}

export function normalizeOrganizedSummary(value: string): string {
  return normalizeOrganizedPlainText(value).replace(/\s*\n\s*/g, " ").trim();
}

export function isUntitledNoteTitle(value: string): boolean {
  const normalized = value.trim().toLocaleLowerCase();
  return normalized === "untitled" || normalized === "untitled note";
}

export function noteTextWithSummary(summary: string, body: string): string {
  return `Summary\n${summary.trim()}\n\n${body.trim()}`.trim();
}

export function noteTextWithoutApprovedSummary(body: string, summary: unknown): string {
  if (typeof summary !== "string" || !summary.trim()) return body.trim();
  const prefix = `Summary\n${summary.trim()}`;
  const trimmed = body.trim();
  if (trimmed === prefix) return "";
  if (trimmed.startsWith(`${prefix}\n\n`)) return trimmed.slice(prefix.length + 2).trim();
  return trimmed;
}
