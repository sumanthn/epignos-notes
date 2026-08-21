"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { AdminSignOutButton } from "@/components/AdminSignOutButton";

import styles from "@/app/legal-review/legal-review.module.css";

export function LegalAcceptanceForm() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted) {
      setError("Read the documents and tick the agreement box to continue.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      const data = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) {
        setError(data.error || "Unable to save your acceptance.");
        return;
      }
      router.push(data.redirectTo || "/workspace");
      router.refresh();
    } catch {
      setError("EpiNote is unreachable. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.documents}>
        <Link href="/terms" target="_blank" rel="noreferrer">
          <span>Terms of Use</span>
          <small>Read the agreement ↗</small>
        </Link>
        <Link href="/privacy" target="_blank" rel="noreferrer">
          <span>Privacy Notice</span>
          <small>See how data is handled ↗</small>
        </Link>
      </div>

      <aside className={styles.privacy}>
        <strong>Your Notes remain yours</strong>
        <p>
          People do not routinely read your Notes. EpiNote does not sell them, use them
          for advertising, or train models on them. Optional AI uses zero-retention
          providers, and off-site recovery backups are encrypted before upload.
        </p>
      </aside>

      <aside className={styles.safety}>
        <strong>Keep sensitive information out of EpiNote Beta</strong>
        <p>
          Do not store passwords, private keys, payment-card data, government IDs,
          medical records, or other regulated or highly confidential information.
          Keep an independent copy of important material.
        </p>
      </aside>

      <label className={styles.acceptance}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span>
          I have read and agree to the Terms of Use and acknowledge the Privacy Notice.
        </span>
      </label>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        <button type="submit" disabled={!accepted || submitting}>
          {submitting ? "Saving…" : "Agree and continue"}
        </button>
        <AdminSignOutButton />
      </div>
    </form>
  );
}
