import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link className="wordmark" href="/">
          EpiNote
        </Link>
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

      <section className="product-frame" aria-label="EpiNote workspace preview">
        <div className="preview-topbar">
          <span className="preview-brand">EpiNote</span>
          <span className="preview-search">Search your notes</span>
          <span className="preview-avatar">S</span>
        </div>
        <div className="preview-body">
          <aside className="preview-sidebar">
            <span className="preview-label">BOOKS</span>
            <strong>Unsorted</strong>
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
    </main>
  );
}
