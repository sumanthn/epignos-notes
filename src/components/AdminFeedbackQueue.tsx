"use client";

import { useState } from "react";

import styles from "@/app/admin/admin.module.css";
import {
  feedbackStatuses,
  feedbackStatusLabel,
  feedbackTypeLabel,
  type AdminFeedbackItem,
  type FeedbackStatus,
} from "@/lib/feedback";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function AdminFeedbackQueue({ initialItems }: { initialItems: AdminFeedbackItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function updateStatus(item: AdminFeedbackItem, status: FeedbackStatus) {
    if (status === item.status) return;
    setUpdatingId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as {
        error?: string;
        feedback?: { status: FeedbackStatus; updatedAt: string };
      };
      if (!response.ok || !data.feedback) {
        setError(data.error || "Unable to update that request.");
        return;
      }
      setItems((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, status: data.feedback!.status, updatedAt: data.feedback!.updatedAt }
        : entry));
    } catch {
      setError("EpiNote is unreachable. The request was not changed.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (items.length === 0) {
    return <p className={styles.feedbackEmpty}>No feedback has been submitted yet.</p>;
  }

  return (
    <div>
      {error && <p className={styles.feedbackQueueError} role="alert">{error}</p>}
      <div className={styles.feedbackList}>
        {items.map((item) => (
          <article className={styles.feedbackItem} key={item.id}>
            <div className={styles.feedbackItemMain}>
              <div className={styles.feedbackItemTopline}>
                <span className={`${styles.feedbackType} ${styles[item.type]}`}>
                  {feedbackTypeLabel(item.type)}
                </span>
                <span>#{item.id.slice(-8).toUpperCase()}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <footer>
                <strong>{item.reporterName}</strong>
                <span>{item.organizationName} / {item.workspaceName}</span>
                <span>{item.contextPath}</span>
                <time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))} UTC</time>
              </footer>
            </div>
            <label className={styles.feedbackStatus}>
              Status
              <select
                value={item.status}
                disabled={updatingId === item.id}
                onChange={(event) => void updateStatus(item, event.target.value as FeedbackStatus)}
              >
                {feedbackStatuses.map((status) => (
                  <option value={status} key={status}>{feedbackStatusLabel(status)}</option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>
    </div>
  );
}
