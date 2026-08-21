import Link from "next/link";

import { ProductWordmark } from "@/components/ProductWordmark";

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Main navigation">
        <ProductWordmark href="/" />
        <div className="landing-actions">
          <Link className="text-link" href="/login">
            Sign in
          </Link>
          <Link className="button button-small" href="/register">
            Start writing
          </Link>
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">A calm place for useful knowledge</p>
        <h1>Capture the thought.<br />Keep the meaning.</h1>
        <p className="hero-copy">
          EpiNote gives your notes a simple home—organized into workspaces and
          books, ready to understand and reuse when you need them.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/register">
            Create your workspace
          </Link>
          <Link className="button button-secondary" href="/login">
            Open EpiNote
          </Link>
        </div>
        <p className="hero-note">Simple notes first. Intelligence when it helps.</p>
      </section>

      <section className="privacy-promise" aria-labelledby="privacy-promise-title">
        <div className="privacy-promise-heading">
          <p className="eyebrow">Private by practice</p>
          <h2 id="privacy-promise-title">Your notes are yours.</h2>
          <p>Clear protections, with no vague promises.</p>
        </div>
        <div className="privacy-promise-items">
          <article>
            <span aria-hidden="true">01</span>
            <h3>No routine human review</h3>
            <p>People do not routinely read your Notes. Access is limited to support you authorize, security response, or legal obligations.</p>
          </article>
          <article>
            <span aria-hidden="true">02</span>
            <h3>Never sold or used to train AI</h3>
            <p>Note content is not sold, used for advertising, or used to train models. Optional AI requests use zero-retention providers.</p>
          </article>
          <article>
            <span aria-hidden="true">03</span>
            <h3>Encrypted off-site backups</h3>
            <p>Recovery backups are encrypted before upload, and the private recovery key is kept away from the application server.</p>
          </article>
        </div>
        <p className="privacy-promise-detail">
          EpiNote is not end-to-end encrypted and is not a vault for secrets. <Link href="/privacy">Read the full privacy notice</Link>.
        </p>
      </section>

      <section className="product-frame" aria-label="EpiNote workspace preview">
        <div className="preview-topbar">
          <ProductWordmark className="preview-brand" />
          <span className="preview-search">Search your notes</span>
          <span className="preview-avatar">S</span>
        </div>
        <div className="preview-body">
          <aside className="preview-sidebar">
            <span className="preview-label">LIBRARY</span>
            <strong>Quick Capture</strong>
            <span className="preview-note active">Product thinking</span>
            <span className="preview-note">Research notes</span>
            <span className="preview-note">Ideas to revisit</span>
          </aside>
          <article className="preview-editor">
            <span className="preview-label">UNSORTED / PRODUCT THINKING</span>
            <h2>Knowledge should stay useful</h2>
            <div className="preview-toolbar">Text&nbsp;&nbsp; B &nbsp; I &nbsp; List</div>
            <p>
              Capture the original thought clearly. Organize it without slowing
              down. Let intelligence suggest connections, while the note stays
              yours.
            </p>
          </article>
        </div>
      </section>
      <footer className="landing-footer">
        <span>EpiNote Beta</span>
        <Link href="/terms">Terms of Use</Link>
        <Link href="/privacy">Privacy Notice</Link>
      </footer>
    </main>
  );
}
