"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import type { FeedbackType } from "@/lib/feedback";

type SubmitState = "idle" | "submitting" | "sent";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    if (submitState === "submitting") return;
    setOpen(false);
    if (submitState === "sent") {
      setType("bug");
      setTitle("");
      setDescription("");
      setSubmitState("idle");
      setReference("");
    }
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, [submitState]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => titleRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && submitState !== "submitting") close();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [close, open, submitState]);

  function show() {
    setOpen(true);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitState("submitting");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          description,
          contextPath: window.location.pathname,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        feedback?: { id: string };
      };
      if (!response.ok || !data.feedback) {
        setError(data.error || "Unable to send your report right now.");
        setSubmitState("idle");
        return;
      }

      setReference(data.feedback.id.slice(-8).toUpperCase());
      setSubmitState("sent");
    } catch {
      setError("EpiNote is unreachable. Your report has not been sent.");
      setSubmitState("idle");
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        className="feedback-trigger"
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 5.5h14v10H9l-4 3Z" />
          <path d="M9 9h6M9 12h4" />
        </svg>
        <span>Feedback</span>
      </button>

      {open && (
        <div
          className="feedback-overlay"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            className="feedback-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
          >
            <header>
              <div>
                <p>Help improve EpiNote</p>
                <h2 id="feedback-title">Send feedback</h2>
              </div>
              <button
                className="feedback-close"
                type="button"
                onClick={close}
                disabled={submitState === "submitting"}
                aria-label="Close feedback"
              >
                ×
              </button>
            </header>

            {submitState === "sent" ? (
              <div className="feedback-success" role="status">
                <span aria-hidden="true">✓</span>
                <h3>Thank you. It is in the queue.</h3>
                <p>Your private reference is <strong>{reference}</strong>.</p>
                <button className="button" type="button" onClick={close}>Done</button>
              </div>
            ) : (
              <form className="feedback-form" onSubmit={(event) => void submit(event)}>
                <fieldset>
                  <legend>What are you sending?</legend>
                  <div className="feedback-types">
                    <button
                      className={type === "bug" ? "selected" : ""}
                      type="button"
                      onClick={() => setType("bug")}
                      aria-pressed={type === "bug"}
                    >
                      <strong>Bug</strong>
                      <span>Something is not working</span>
                    </button>
                    <button
                      className={type === "feature" ? "selected" : ""}
                      type="button"
                      onClick={() => setType("feature")}
                      aria-pressed={type === "feature"}
                    >
                      <strong>Feature request</strong>
                      <span>An improvement or new idea</span>
                    </button>
                  </div>
                </fieldset>

                <label>
                  Short title
                  <input
                    ref={titleRef}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    minLength={4}
                    maxLength={120}
                    placeholder={type === "bug" ? "What went wrong?" : "What would help?"}
                    required
                  />
                </label>

                <label>
                  Details
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    minLength={10}
                    maxLength={4_000}
                    rows={6}
                    placeholder="Tell us what happened, what you expected, or how the idea should work."
                    required
                  />
                  <span>{description.length.toLocaleString()} / 4,000</span>
                </label>

                <p className="feedback-privacy">
                  We attach your account and workspace references only. Do not include passwords,
                  API keys, or private note content.
                </p>
                {error && <p className="feedback-error" role="alert">{error}</p>}

                <footer>
                  <button className="button button-secondary" type="button" onClick={close}>
                    Cancel
                  </button>
                  <button className="button" type="submit" disabled={submitState === "submitting"}>
                    {submitState === "submitting" ? "Sending…" : "Send feedback"}
                  </button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
