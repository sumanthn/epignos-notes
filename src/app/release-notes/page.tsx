import type { Metadata } from "next";
import Link from "next/link";

import { ProductWordmark } from "@/components/ProductWordmark";

import styles from "./release-notes.module.css";

export const metadata: Metadata = {
  title: "Release notes",
  description: "What is new and improved in EpiNote Beta.",
};

const releases = [
  {
    date: "August 18, 2026",
    title: "Help, feedback, and operations",
    current: true,
    changes: [
      "A new Help guide is available directly from the workspace top bar.",
      "Users can privately submit bugs and feature requests without copying their email or note contents.",
      "Every submitted report receives a compact reference number and enters the administrator's feedback queue.",
      "The dedicated superadmin console now includes system health, storage usage, and feedback status management.",
    ],
  },
  {
    date: "August 16, 2026",
    title: "Knowledge workspace foundations",
    current: false,
    changes: [
      "Books gained clearer tree navigation, note counts, rename, delete, and drag-and-drop organization.",
      "Notes save automatically and support simple text editing without requiring Markdown.",
      "Organize creates a reviewable AI proposal while preserving the original note until approval.",
      "Book Summary Cards provide compact, source-linked study references with stable semantic colors.",
    ],
  },
  {
    date: "August 16, 2026",
    title: "Secure public beta",
    current: false,
    changes: [
      "EpiNote launched at epinote.epignos.dev with HTTPS and secure session cookies.",
      "Accounts are isolated into organizations and workspaces with server-side authorization.",
      "The Paper, Ink, and Cobalt visual system is consistent across landing, login, and workspace pages.",
    ],
  },
];

export default function ReleaseNotesPage() {
  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <ProductWordmark href="/" />
        <Link href="/workspace">Return to workspace</Link>
      </header>

      <div className={styles.page}>
        <section className={styles.intro}>
          <p>Product updates</p>
          <h1>Release notes</h1>
          <span>A clear record of useful changes to EpiNote Beta.</span>
        </section>

        <div className={styles.timeline}>
          {releases.map((release) => (
            <article className={styles.release} key={`${release.date}-${release.title}`}>
              <aside>
                <time>{release.date}</time>
                {release.current && <span>Latest</span>}
              </aside>
              <div>
                <h2>{release.title}</h2>
                <ul>
                  {release.changes.map((change) => <li key={change}>{change}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
