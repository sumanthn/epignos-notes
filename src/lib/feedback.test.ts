import { describe, expect, it } from "vitest";

import {
  feedbackInputSchema,
  feedbackStatusInputSchema,
  feedbackStatusLabel,
  feedbackTypeLabel,
} from "./feedback";

describe("feedback input", () => {
  it("normalizes a valid user report", () => {
    const parsed = feedbackInputSchema.parse({
      type: "bug",
      title: "  Save button appears blocked  ",
      description: "  Saving does not complete after editing a long note.  ",
      contextPath: "/workspace",
    });

    expect(parsed).toEqual({
      type: "bug",
      title: "Save button appears blocked",
      description: "Saving does not complete after editing a long note.",
      contextPath: "/workspace",
    });
  });

  it("rejects short, oversized, and unexpected content", () => {
    expect(feedbackInputSchema.safeParse({
      type: "bug",
      title: "No",
      description: "Too short",
      contextPath: "/workspace",
    }).success).toBe(false);
    expect(feedbackInputSchema.safeParse({
      type: "feature",
      title: "A valid request",
      description: "A".repeat(4_001),
      contextPath: "/workspace",
    }).success).toBe(false);
    expect(feedbackInputSchema.safeParse({
      type: "feature",
      title: "A valid request",
      description: "Please add a useful new workflow.",
      contextPath: "/workspace",
      email: "copied@example.com",
    }).success).toBe(false);
  });
});

describe("feedback administration", () => {
  it("accepts only known statuses and presents readable labels", () => {
    expect(feedbackStatusInputSchema.parse({ status: "in_progress" })).toEqual({
      status: "in_progress",
    });
    expect(feedbackStatusInputSchema.safeParse({ status: "deleted" }).success).toBe(false);
    expect(feedbackTypeLabel("feature")).toBe("Feature request");
    expect(feedbackStatusLabel("in_progress")).toBe("In progress");
  });
});
