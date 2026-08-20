import { createHash } from "node:crypto";

export {
  MAX_NOTE_CONTENT_BYTES,
  MAX_NOTE_TEXT_LENGTH,
  contentFromText,
  hasRichFormatting,
  isCanonicalContent,
  isRichTextContent,
  markdownFromContent,
  normalizeRichTextContent,
  textFromContent,
} from "./rich-text";
export type {
  CanonicalContent,
  LegacyCanonicalContent,
  RichTextContent,
  RichTextMark,
  RichTextNode,
} from "./rich-text";

import type { CanonicalContent } from "./rich-text";

export function contentHash(content: CanonicalContent): string {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}
