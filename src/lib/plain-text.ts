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
