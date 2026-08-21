import { describe, expect, it } from "vitest";

import { OPENROUTER_PRIVATE_PROVIDER } from "./ai-privacy";

describe("OpenRouter privacy requirements", () => {
  it("requires a zero-retention, non-collecting provider", () => {
    expect(OPENROUTER_PRIVATE_PROVIDER).toEqual({
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
    });
  });
});
