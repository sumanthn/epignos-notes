import { describe, expect, it } from "vitest";

import {
  MAX_LARGE_ORGANIZE_COMPLETION_TOKENS,
  MAX_LARGE_ORGANIZE_USER_MESSAGE_BYTES,
  MAX_STANDARD_ORGANIZE_COMPLETION_TOKENS,
  MAX_STANDARD_ORGANIZE_USER_MESSAGE_BYTES,
  organizeCompletionTokenBudget,
  organizeMessageBytes,
} from "./organize-limits";

describe("large-note organization limits", () => {
  it("routes the previously failing 30,000-to-40,000 character range as large", () => {
    expect(organizeMessageBytes("a".repeat(40_000))).toBeGreaterThan(
      MAX_STANDARD_ORGANIZE_USER_MESSAGE_BYTES,
    );
    expect(organizeMessageBytes("a".repeat(40_000))).toBeLessThan(
      MAX_LARGE_ORGANIZE_USER_MESSAGE_BYTES,
    );
  });

  it("measures UTF-8 bytes instead of assuming every character has the same size", () => {
    expect(organizeMessageBytes("🙂".repeat(10))).toBe(40);
  });

  it("grows the completion budget for large notes without exceeding the model allowance", () => {
    expect(organizeCompletionTokenBudget(10_000)).toBe(8_000);
    expect(organizeCompletionTokenBudget(40_000)).toBeGreaterThan(8_000);
    expect(
      organizeCompletionTokenBudget(MAX_STANDARD_ORGANIZE_USER_MESSAGE_BYTES),
    ).toBeLessThanOrEqual(MAX_STANDARD_ORGANIZE_COMPLETION_TOKENS);
  });

  it("provides a separate long-context allowance without weakening the normal route", () => {
    expect(MAX_LARGE_ORGANIZE_USER_MESSAGE_BYTES).toBeGreaterThan(
      MAX_STANDARD_ORGANIZE_USER_MESSAGE_BYTES,
    );
    expect(
      organizeCompletionTokenBudget(
        MAX_LARGE_ORGANIZE_USER_MESSAGE_BYTES,
        MAX_LARGE_ORGANIZE_COMPLETION_TOKENS,
      ),
    ).toBeLessThanOrEqual(MAX_LARGE_ORGANIZE_COMPLETION_TOKENS);
  });
});
