import { z } from "zod";

export const feedbackTypes = ["bug", "feature"] as const;
export const feedbackStatuses = ["open", "in_progress", "resolved", "closed"] as const;

export type FeedbackType = (typeof feedbackTypes)[number];
export type FeedbackStatus = (typeof feedbackStatuses)[number];

export type AdminFeedbackItem = {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  title: string;
  description: string;
  contextPath: string;
  reporterName: string;
  organizationName: string;
  workspaceName: string;
  createdAt: string;
  updatedAt: string;
};

export const feedbackInputSchema = z
  .object({
    type: z.enum(feedbackTypes),
    title: z.string().trim().min(4).max(120),
    description: z.string().trim().min(10).max(4_000),
    contextPath: z.string().trim().startsWith("/").max(200).default("/workspace"),
  })
  .strict();

export const feedbackStatusInputSchema = z
  .object({ status: z.enum(feedbackStatuses) })
  .strict();

export function feedbackTypeLabel(type: FeedbackType): string {
  return type === "bug" ? "Bug" : "Feature request";
}

export function feedbackStatusLabel(status: FeedbackStatus): string {
  if (status === "in_progress") return "In progress";
  return status[0].toUpperCase() + status.slice(1);
}

export function isFeedbackType(value: unknown): value is FeedbackType {
  return feedbackTypes.some((type) => type === value);
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return feedbackStatuses.some((status) => status === value);
}
