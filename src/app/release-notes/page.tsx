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
    date: "August 21, 2026",
    title: "A concrete privacy promise for Notes",
    current: true,
    changes: [
      "EpiNote now states plainly that people do not routinely read Notes and that limited access is reserved for authorized support, security response, or legal obligations.",
      "Note content is not sold, used for advertising, or used to train models.",
      "Every optional AI request now requires a zero-retention, non-collecting provider route and fails closed when one is unavailable.",
      "The privacy notice distinguishes the live service from encrypted off-site recovery backups, whose private recovery key is stored away from the server.",
    ],
  },
  {
    date: "August 21, 2026",
    title: "Existing users can review terms without registering again",
    current: false,
    changes: [
      "Signed-in users whose acceptance is missing or outdated see one focused review page before returning to their workspace.",
      "Agreement requires an unchecked confirmation inside EpiNote; opening an email link alone never counts as acceptance.",
      "The server stores the exact Terms and Privacy versions, acceptance time, and a separate audit record while leaving existing notes unchanged.",
      "The superadmin can send idempotent transactional notices only to active users who still need the current review.",
    ],
  },
  {
    date: "August 21, 2026",
    title: "Clearer safety guidance at signup",
    current: false,
    changes: [
      "Registration now clearly warns against storing passwords, credentials, payment-card data, government IDs, medical records, and other sensitive or regulated information.",
      "New plain-language Terms of Use and Privacy Notice explain user-content responsibility, optional AI processing, security limits, retention, and acceptable use.",
      "Creating an account requires explicit agreement to the Terms and acknowledgement of the Privacy Notice; EpiNote records the accepted versions and time.",
    ],
  },
  {
    date: "August 20, 2026",
    title: "Book Concepts connect the notes",
    current: false,
    changes: [
      "Every Book now has a Concepts collection beside Summary Cards, kept above its ordinary Notes.",
      "Generate a compact view of the Book’s important ideas, people, organizations, places, works, and events.",
      "Concepts and their connections link directly to the Notes that support them, so the original context remains one click away.",
      "Concepts are generated in the background, report progress through the bell, and show when the Book has changed and needs a refresh.",
    ],
  },
  {
    date: "August 20, 2026",
    title: "Menus and the Library now behave naturally",
    current: false,
    changes: [
      "Menus, popovers, and AI panels close when you click elsewhere or press Escape; touch dismissal works the same way.",
      "Click an open Book again to collapse its note tree without changing or closing the Note you are editing.",
      "Account, table, and export menus no longer remain stuck open, and exports close their menu after download starts.",
      "Small, restrained transitions make temporary surfaces easier to follow while respecting reduced-motion settings.",
    ],
  },
  {
    date: "August 20, 2026",
    title: "Code blocks that stay out of the way",
    current: false,
    changes: [
      "Type three backticks and press Enter to start a code block, even when general Markdown shortcuts are off.",
      "Choose a common language only while working inside code, then use Done, Ctrl/⌘+Enter, or a closing fence to return to normal writing.",
      "Complete fenced snippets pasted into a Note are preserved as structured code and remain fenced when exported as Markdown.",
    ],
  },
  {
    date: "August 19, 2026",
    title: "A simple editor with serious formatting",
    current: false,
    changes: [
      "Notes still open as a clean writing surface, with Markdown shortcuts off by default.",
      "The compact editor bar now supports headings, fonts, bold, italic, underline, highlights, links, bullets, numbered lists, and checklists.",
      "Code blocks and editable tables can be inserted without leaving the note.",
      "Markdown-oriented users can enable shortcuts and paste conversion, then export a note as Markdown.",
      "Rich content autosaves as validated structured data while search, summaries, and AI continue using a plain-text view.",
    ],
  },
  {
    date: "August 18, 2026",
    title: "Help, feedback, and operations",
    current: false,
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
