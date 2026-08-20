export interface RichTextMark {
  type: "bold" | "italic" | "underline" | "strike" | "code" | "highlight" | "link";
  attrs?: Record<string, unknown>;
}

export interface RichTextNode {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: RichTextMark[];
  text?: string;
  content?: RichTextNode[];
}

export interface RichTextContent extends RichTextNode {
  type: "doc";
  content: RichTextNode[];
}

export interface LegacyParagraphBlock {
  type: "paragraph";
  id: string;
  text: string;
}

export interface LegacyCanonicalContent {
  type: "doc";
  content: LegacyParagraphBlock[];
}

export type CanonicalContent = RichTextContent | LegacyCanonicalContent;

export const MAX_NOTE_TEXT_LENGTH = 1_000_000;
export const MAX_NOTE_CONTENT_BYTES = 4_000_000;

const ALLOWED_NODE_TYPES = new Set([
  "doc",
  "text",
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
]);

const BLOCK_NODE_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "taskItem",
  "codeBlock",
  "table",
]);

const ALLOWED_MARK_TYPES = new Set<RichTextMark["type"]>([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "highlight",
  "link",
]);

const HIGHLIGHT_COLORS = new Set([
  "#fff0a6",
  "#dfe8fa",
  "#dfeee2",
  "#f4dfe6",
  "#e8e0f3",
]);

const DOCUMENT_BLOCKS = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
  "codeBlock",
  "horizontalRule",
  "table",
]);

const CELL_BLOCKS = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
  "codeBlock",
  "horizontalRule",
  "table",
]);

function blockId(): string {
  return globalThis.crypto.randomUUID();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function legacyContent(value: unknown): value is LegacyCanonicalContent {
  if (!isRecord(value) || value.type !== "doc" || !Array.isArray(value.content)) return false;
  return value.content.every(
    (block) =>
      isRecord(block) &&
      block.type === "paragraph" &&
      typeof block.id === "string" &&
      typeof block.text === "string",
  );
}

function safeLink(href: unknown): string | null {
  if (typeof href !== "string" || href.length === 0 || href.length > 2_048) return null;
  if (href.startsWith("#") || href.startsWith("/")) return href;
  try {
    const parsed = new URL(href);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? href : null;
  } catch {
    return null;
  }
}

function normalizedMarks(value: unknown): RichTextMark[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const marks: RichTextMark[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || !ALLOWED_MARK_TYPES.has(candidate.type as RichTextMark["type"])) {
      return null;
    }
    const type = candidate.type as RichTextMark["type"];
    if (type === "link") {
      const href = safeLink(isRecord(candidate.attrs) ? candidate.attrs.href : undefined);
      if (!href) return null;
      marks.push({ type, attrs: { href, target: "_blank", rel: "noopener noreferrer" } });
      continue;
    }
    if (type === "highlight") {
      const color = isRecord(candidate.attrs) ? candidate.attrs.color : undefined;
      if (color !== undefined && (!HIGHLIGHT_COLORS.has(String(color).toLowerCase()))) return null;
      marks.push(color ? { type, attrs: { color: String(color).toLowerCase() } } : { type });
      continue;
    }
    marks.push({ type });
  }
  return marks;
}

function positiveInteger(value: unknown, fallback: number, maximum = 100): number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= maximum
    ? Number(value)
    : fallback;
}

function normalizedAttrs(type: string, value: unknown): Record<string, unknown> | null {
  const attrs = isRecord(value) ? value : {};
  const result: Record<string, unknown> = {};
  if (BLOCK_NODE_TYPES.has(type)) {
    result.id = typeof attrs.id === "string" && attrs.id.length <= 100 ? attrs.id : blockId();
  }
  if (type === "heading") {
    const level = positiveInteger(attrs.level, 1, 3);
    result.level = level;
  }
  if (type === "orderedList") result.start = positiveInteger(attrs.start, 1, 1_000_000);
  if (type === "taskItem") result.checked = attrs.checked === true;
  if (type === "codeBlock") {
    result.language = typeof attrs.language === "string" && attrs.language.length <= 50
      ? attrs.language
      : null;
  }
  if (type === "tableCell" || type === "tableHeader") {
    result.colspan = positiveInteger(attrs.colspan, 1, 100);
    result.rowspan = positiveInteger(attrs.rowspan, 1, 100);
    result.colwidth = Array.isArray(attrs.colwidth) && attrs.colwidth.every((width) => Number.isInteger(width))
      ? attrs.colwidth.slice(0, 100)
      : null;
  }
  return Object.keys(result).length > 0 ? result : null;
}

function validChildren(type: string, children: RichTextNode[] | undefined): boolean {
  const childTypes = (children ?? []).map((child) => child.type);
  if (type === "doc") return childTypes.length > 0 && childTypes.every((child) => DOCUMENT_BLOCKS.has(child));
  if (type === "paragraph" || type === "heading") {
    return childTypes.every((child) => child === "text" || child === "hardBreak");
  }
  if (type === "codeBlock") return childTypes.every((child) => child === "text");
  if (type === "bulletList" || type === "orderedList") {
    return childTypes.length > 0 && childTypes.every((child) => child === "listItem");
  }
  if (type === "taskList") {
    return childTypes.length > 0 && childTypes.every((child) => child === "taskItem");
  }
  if (type === "listItem" || type === "taskItem" || type === "blockquote") {
    return childTypes.length > 0 && childTypes.every((child) => CELL_BLOCKS.has(child));
  }
  if (type === "table") return childTypes.length > 0 && childTypes.every((child) => child === "tableRow");
  if (type === "tableRow") {
    return childTypes.length > 0 && childTypes.every((child) => child === "tableHeader" || child === "tableCell");
  }
  if (type === "tableHeader" || type === "tableCell") {
    return childTypes.length > 0 && childTypes.every((child) => CELL_BLOCKS.has(child));
  }
  if (type === "horizontalRule" || type === "hardBreak") return childTypes.length === 0;
  return true;
}

function normalizeNode(
  value: unknown,
  depth: number,
  counters: { nodes: number; text: number },
): RichTextNode | null {
  if (depth > 30 || !isRecord(value) || typeof value.type !== "string") return null;
  if (!ALLOWED_NODE_TYPES.has(value.type)) return null;
  counters.nodes += 1;
  if (counters.nodes > 100_000) return null;

  if (value.type === "text") {
    if (typeof value.text !== "string") return null;
    counters.text += value.text.length;
    if (counters.text > MAX_NOTE_TEXT_LENGTH) return null;
    const marks = normalizedMarks(value.marks);
    if (!marks) return null;
    return marks.length > 0
      ? { type: "text", text: value.text, marks }
      : { type: "text", text: value.text };
  }

  if (value.text !== undefined || value.marks !== undefined) return null;
  const attrs = normalizedAttrs(value.type, value.attrs);
  const node: RichTextNode = attrs ? { type: value.type, attrs } : { type: value.type };
  if (value.content !== undefined) {
    if (!Array.isArray(value.content)) return null;
    const children: RichTextNode[] = [];
    for (const child of value.content) {
      const normalized = normalizeNode(child, depth + 1, counters);
      if (!normalized) return null;
      children.push(normalized);
    }
    node.content = children;
  }
  if (!validChildren(value.type, node.content)) return null;
  return node;
}

export function normalizeRichTextContent(value: unknown): RichTextContent | null {
  if (!isRecord(value) || value.type !== "doc" || !Array.isArray(value.content)) return null;
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return null;
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_NOTE_CONTENT_BYTES) return null;
  const counters = { nodes: 0, text: 0 };
  const normalized = normalizeNode(value, 0, counters);
  if (!normalized || normalized.type !== "doc" || !normalized.content) return null;
  return normalized as RichTextContent;
}

export function isRichTextContent(value: unknown): value is RichTextContent {
  return normalizeRichTextContent(value) !== null;
}

export function isCanonicalContent(value: unknown): value is CanonicalContent {
  return legacyContent(value) || isRichTextContent(value);
}

export function hasRichFormatting(value: unknown): boolean {
  const normalized = normalizeRichTextContent(value);
  if (!normalized) return false;
  let formatted = false;
  function visit(node: RichTextNode): void {
    if (!["doc", "paragraph", "text"].includes(node.type) || (node.marks?.length ?? 0) > 0) {
      formatted = true;
      return;
    }
    for (const child of node.content ?? []) {
      if (!formatted) visit(child);
    }
  }
  visit(normalized);
  return formatted;
}

function previousBlockId(previous: CanonicalContent | undefined, index: number): string | null {
  if (!previous) return null;
  const block = previous.content[index];
  if (!block) return null;
  const candidate = block as unknown as Record<string, unknown>;
  if (typeof candidate.id === "string") return candidate.id;
  return isRecord(candidate.attrs) && typeof candidate.attrs.id === "string" ? candidate.attrs.id : null;
}

export function contentFromText(text: string, previous?: CanonicalContent): RichTextContent {
  const normalized = text.replace(/\r\n?/g, "\n");
  return {
    type: "doc",
    content: normalized.split("\n").map((line, index) => ({
      type: "paragraph",
      attrs: { id: previousBlockId(previous, index) ?? blockId() },
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

function inlineText(node: RichTextNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(inlineText).join("");
}

function blockText(node: RichTextNode): string {
  if (node.type === "text" || node.type === "hardBreak") return inlineText(node);
  if (node.type === "table") return (node.content ?? []).map(blockText).join("\n");
  if (node.type === "tableRow") return (node.content ?? []).map(blockText).join("\t");
  if (node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList") {
    return (node.content ?? []).map(blockText).join("\n");
  }
  if (node.type === "listItem" || node.type === "taskItem" || node.type === "blockquote") {
    return (node.content ?? []).map(blockText).join("\n");
  }
  if (node.type === "horizontalRule") return "---";
  return inlineText(node);
}

export function textFromContent(value: unknown): string {
  if (legacyContent(value)) return value.content.map((block) => block.text).join("\n");
  const normalized = normalizeRichTextContent(value);
  if (!normalized) return "";
  return normalized.content.map(blockText).join("\n");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_[\]<>])/gu, "\\$1");
}

function markedText(node: RichTextNode): string {
  let value = escapeMarkdownText(node.text ?? "");
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") value = `**${value}**`;
    else if (mark.type === "italic") value = `*${value}*`;
    else if (mark.type === "underline") value = `<u>${value}</u>`;
    else if (mark.type === "strike") value = `~~${value}~~`;
    else if (mark.type === "code") value = `\`${node.text ?? ""}\``;
    else if (mark.type === "highlight") value = `<mark>${value}</mark>`;
    else if (mark.type === "link") value = `[${value}](${String(mark.attrs?.href ?? "")})`;
  }
  return value;
}

function inlineMarkdown(node: RichTextNode): string {
  if (node.type === "text") return markedText(node);
  if (node.type === "hardBreak") return "  \n";
  return (node.content ?? []).map(inlineMarkdown).join("");
}

function markdownBlock(node: RichTextNode, depth = 0): string {
  if (node.type === "paragraph") return inlineMarkdown(node);
  if (node.type === "heading") return `${"#".repeat(Number(node.attrs?.level ?? 1))} ${inlineMarkdown(node)}`;
  if (node.type === "blockquote") {
    return (node.content ?? []).map((child) => markdownBlock(child, depth)).join("\n").split("\n").map((line) => `> ${line}`).join("\n");
  }
  if (node.type === "codeBlock") {
    return `\`\`\`${String(node.attrs?.language ?? "")}\n${inlineText(node)}\n\`\`\``;
  }
  if (node.type === "horizontalRule") return "---";
  if (node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList") {
    return (node.content ?? []).map((child, index) => {
      const prefix = node.type === "orderedList"
        ? `${Number(node.attrs?.start ?? 1) + index}. `
        : node.type === "taskList"
          ? `- [${child.attrs?.checked ? "x" : " "}] `
          : "- ";
      const body = (child.content ?? []).map((item) => markdownBlock(item, depth + 1)).join("\n");
      const [first, ...rest] = body.split("\n");
      return `${"  ".repeat(depth)}${prefix}${first}${rest.length ? `\n${rest.map((line) => `${"  ".repeat(depth + 1)}${line}`).join("\n")}` : ""}`;
    }).join("\n");
  }
  if (node.type === "table") {
    const rows = node.content ?? [];
    if (rows.length === 0) return "";
    const rendered = rows.map((row) => (row.content ?? []).map((cell) => inlineMarkdown(cell).replace(/\|/gu, "\\|")).join(" | "));
    const columns = rows[0]?.content?.length ?? 1;
    return `| ${rendered[0]} |\n| ${Array.from({ length: columns }, () => "---").join(" | ")} |${rendered.slice(1).map((row) => `\n| ${row} |`).join("")}`;
  }
  if (node.type === "tableCell" || node.type === "tableHeader" || node.type === "tableRow") {
    return (node.content ?? []).map((child) => markdownBlock(child, depth)).join(" ");
  }
  return inlineMarkdown(node);
}

export function markdownFromContent(value: unknown): string {
  const normalized = normalizeRichTextContent(value);
  if (!normalized) return textFromContent(value);
  return normalized.content.map((node) => markdownBlock(node)).join("\n\n");
}
