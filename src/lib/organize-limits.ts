export const MAX_STANDARD_ORGANIZE_USER_MESSAGE_BYTES = 30_000;
export const MAX_STANDARD_ORGANIZE_COMPLETION_TOKENS = 16_000;
export const MAX_FAST_ORGANIZE_USER_MESSAGE_BYTES = 130_000;
export const MAX_FAST_ORGANIZE_COMPLETION_TOKENS = 60_000;
export const MAX_LARGE_ORGANIZE_USER_MESSAGE_BYTES = 680_000;
export const MAX_LARGE_ORGANIZE_COMPLETION_TOKENS = 320_000;
const MIN_ORGANIZE_COMPLETION_TOKENS = 8_000;

export function organizeMessageBytes(message: string): number {
  return Buffer.byteLength(message, "utf8");
}

export function organizeCompletionTokenBudget(
  messageBytes: number,
  maximumTokens = MAX_STANDARD_ORGANIZE_COMPLETION_TOKENS,
): number {
  return Math.min(
    maximumTokens,
    Math.max(MIN_ORGANIZE_COMPLETION_TOKENS, Math.ceil(messageBytes / 2.25)),
  );
}
