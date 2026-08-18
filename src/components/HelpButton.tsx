"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        window.setTimeout(() => triggerRef.current?.focus(), 0);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="help-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.7 9a2.4 2.4 0 1 1 3.8 2c-.9.6-1.5 1-1.5 2.2" />
          <path d="M12 17h.01" />
        </svg>
        <span>Help</span>
      </button>

      {open && (
        <div
          className="feedback-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            className="feedback-dialog help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <header>
              <div>
                <p>EpiNote guide</p>
                <h2 id="help-title">Help</h2>
              </div>
              <button
                ref={closeRef}
                className="feedback-close"
                type="button"
                onClick={close}
                aria-label="Close help"
              >
                ×
              </button>
            </header>

            <div className="help-content">
              <section>
                <span className="help-number">01</span>
                <div>
                  <h3>Capture first</h3>
                  <p>Create a note in Quick Capture when speed matters. EpiNote saves your writing automatically.</p>
                </div>
              </section>
              <section>
                <span className="help-number">02</span>
                <div>
                  <h3>Organize with books</h3>
                  <p>Create books for subjects or projects, then drag notes between them from the Library.</p>
                </div>
              </section>
              <section>
                <span className="help-number">03</span>
                <div>
                  <h3>Use intelligence deliberately</h3>
                  <p>Organize proposes a clearer note for review. Summary Cards build a quick reference for the whole book.</p>
                </div>
              </section>
              <section>
                <span className="help-number">04</span>
                <div>
                  <h3>Tell us what needs work</h3>
                  <p>Use the Feedback button beside Help to report a bug or request an improvement privately.</p>
                </div>
              </section>
            </div>

            <footer className="help-footer">
              <div>
                <strong>What changed recently?</strong>
                <span>See improvements, fixes, and newly available workflows.</span>
              </div>
              <Link className="button button-secondary button-small" href="/release-notes">
                Release notes
              </Link>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
