import { describe, expect, it } from "vitest";

import {
  MAX_FAST_ORGANIZE_COMPLETION_TOKENS,
  MAX_FAST_ORGANIZE_USER_MESSAGE_BYTES,
  MAX_LARGE_ORGANIZE_COMPLETION_TOKENS,
  MAX_LARGE_ORGANIZE_USER_MESSAGE_BYTES,
  MAX_STANDARD_ORGANIZE_COMPLETION_TOKENS,
  MAX_STANDARD_ORGANIZE_USER_MESSAGE_BYTES,
  organizeCompletionTokenBudget,
  organizeMessageBytes,
} from "./organize-limits";

describe("large-note organization limits", () => {
  it("routes real 30,000-to-64,000 character notes through the fast-model tier", () => {
    expect(organizeMessageBytes("a".repeat(40_000))).toBeGreaterThan(
      MAX_STANDARD_ORGANIZE_USER_MESSAGE_BYTES,
    );
    expect(organizeMessageBytes("a".repeat(64_007))).toBeLessThan(
      MAX_FAST_ORGANIZE_USER_MESSAGE_BYTES,
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
    expect(MAX_FAST_ORGANIZE_USER_MESSAGE_BYTES).toBeGreaterThan(
      MAX_STANDARD_ORGANIZE_USER_MESSAGE_BYTES,
    );
    expect(MAX_LARGE_ORGANIZE_USER_MESSAGE_BYTES).toBeGreaterThan(
      MAX_FAST_ORGANIZE_USER_MESSAGE_BYTES,
    );
    expect(
      organizeCompletionTokenBudget(
        MAX_FAST_ORGANIZE_USER_MESSAGE_BYTES,
        MAX_FAST_ORGANIZE_COMPLETION_TOKENS,
      ),
    ).toBeLessThanOrEqual(MAX_FAST_ORGANIZE_COMPLETION_TOKENS);
    expect(
      organizeCompletionTokenBudget(
        MAX_LARGE_ORGANIZE_USER_MESSAGE_BYTES,
        MAX_LARGE_ORGANIZE_COMPLETION_TOKENS,
      ),
    ).toBeLessThanOrEqual(MAX_LARGE_ORGANIZE_COMPLETION_TOKENS);
  });
});
