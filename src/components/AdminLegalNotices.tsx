"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "@/app/admin/admin.module.css";

export function AdminLegalNotices({
  initialPending,
  initialNotified,
  emailConfigured,
}: {
  initialPending: number;
  initialNotified: number;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(initialPending);
  const [notified, setNotified] = useState(initialNotified);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function sendNotices() {
    setSending(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/admin/legal-notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendToPendingUsers: true }),
      });
      const data = (await response.json()) as {
        error?: string;
        sent?: number;
        remaining?: number;
      };
      if (!response.ok) {
        setFailed(true);
        setMessage(data.error || "Unable to send legal notices.");
        return;
      }
      const sent = data.sent || 0;
      setNotified((current) => current + sent);
      setPending(data.remaining ?? pending);
      setMessage(sent === 0 ? "No unsent legal notices remain." : `Sent ${sent} legal notice${sent === 1 ? "" : "s"}.`);
      router.refresh();
    } catch {
      setFailed(true);
      setMessage("EpiNote is unreachable. No delivery result was recorded.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.legalNoticeBody}>
      <div>
        <strong>{pending}</strong>
        <span>accounts still require the current acceptance</span>
      </div>
      <div>
        <strong>{notified}</strong>
        <span>have already received this version&apos;s notice</span>
      </div>
      <button
        type="button"
        disabled={!emailConfigured || sending || pending === 0}
        onClick={() => void sendNotices()}
      >
        {sending ? "Sending…" : emailConfigured ? "Email pending users" : "Email not configured"}
      </button>
      {message && <p className={failed ? styles.legalNoticeError : styles.legalNoticeSuccess} role="status">{message}</p>}
    </div>
  );
}
