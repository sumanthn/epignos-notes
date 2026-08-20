# EpiNote Implementation Decisions

Status: active implementation record
Last updated: 2026-08-16

This file records concrete engineering decisions as EpiNote is built. Product,
storage, and authentication contracts remain in their dedicated design files.

## 2026-08-16: application framework

Decision: use one **Next.js 16 App Router application with TypeScript and React**.

Why:

- The landing page, authentication pages, notes UI, and same-origin API can ship
  as one deployable application.
- Server-rendered protected pages and route handlers avoid a second backend
  service without coupling browser code directly to MongoDB.
- React is appropriate for the interactive note editor and navigation tree.
- Plain CSS is sufficient for the approved Paper, Ink, Cobalt theme; no UI
  framework or design-system dependency is needed initially.

Runtime baseline:

```text
Node.js 24 LTS
Next.js 16.3.x
React 19.2.x
TypeScript strict mode
npm with committed package-lock.json
```

References:

- Next.js installation and runtime requirements:
  <https://nextjs.org/docs/app/getting-started/installation>
- Next.js self-hosting:
  <https://nextjs.org/docs/app/guides/self-hosting>
- Node.js release schedule:
  <https://nodejs.org/en/about/previous-releases>

## 2026-08-16: first vertical slice

The first deployed workflow is:

```text
Visitor -> landing page -> register/login -> protected workspace
        -> create note -> edit title/body -> save -> reload persisted note
```

It includes the real hierarchy by automatically creating a personal
organization, `My Workspace`, and its required `Quick Capture` system book for a new user.
It does not include attachments, rich block editing, search, invitations,
password reset email, or AI behavior yet.

The initial editor is intentionally a reliable text editor stored as validated
canonical paragraph blocks. A richer block editor can replace the input later
without changing the note ownership or concurrency contract.

## 2026-08-16: application dependencies

- Official `mongodb` driver rather than an ODM.
- `argon2` for Argon2id password hashing.
- `zod` for request and environment validation.
- Opaque MongoDB-backed sessions in HTTP-only cookies.
- No Redux, component library, ORM, queue, cache, or separate API service.

## 2026-08-16: dev registration

The dev-test deployment may set:

```text
AUTH_REQUIRE_EMAIL_VERIFICATION=false
```

This makes a new dev account active immediately so the first workflow can be
tested before an email provider is selected. Production must require verified
email. The bypass is environment-controlled and must be shown as a development
condition, not silently inferred from the hostname.

## 2026-08-16: deployment

The application runs as the unprivileged `epignos` user under systemd, listens
only on `127.0.0.1:3000`, and reaches MongoDB on `127.0.0.1:27017`. A reverse
proxy is the only public web listener.

Deployment files live in the repository under `deploy/`; secrets live only in a
server environment file with mode `0600`. Database credentials, server IPs, and
private-key paths are never committed.

The first deployment is reached by the server IP. As of January 2026, Let's
Encrypt supports short-lived publicly trusted IP certificates. Certbot 5.7.0
successfully issued the certificate with an IP identifier and the `shortlived`
profile. nginx terminates HTTPS, HTTP redirects to HTTPS, and EpiNote uses its
production-form `Secure` session cookie on the dev-test host.

Certbot's renewal timer and nginx stop/start hooks were verified with a simulated
renewal. Exact deployed state and checks are recorded in
`docs/operations/EPINOTE_DEV_TEST.md`.

References:

- Let's Encrypt IP certificates:
  <https://letsencrypt.org/2025/07/01/issuing-our-first-ip-address-certificate/>
- Certbot IP identifier support:
  <https://eff-certbot.readthedocs.io/en/stable/using.html>

## Next decisions

- Email provider and verified sender domain.
- Public application domain.
- Rich-text editor library, only after the text workflow is reliable.
- Attachment ingestion and image storage UI.
- Narrow AI proposal workflow after canonical notes are proven.

## 2026-08-16: standalone static assets

Next.js standalone output does not automatically place `.next/static` or the
optional `public` directory beside the standalone server. The initial deployment
therefore rendered HTML while its CSS and browser JavaScript returned `404`.

`npm run build` now runs `scripts/prepare-standalone.mjs`, which copies those
assets into `.next/standalone` and fails if the required compiled static directory
does not exist. Deployment verification must request the exact stylesheet and a
JavaScript chunk referenced by the live HTML and require HTTP `200` with the
correct content type.

## 2026-08-16: person and organization names

A person's display name is never used as the visible organization name. Initial
registration asks separately for `Your name` and `Organization name`, then creates
the registrant as owner of that isolated organization.

Public registration does not silently add users to an existing organization.
Additional Epignos members will join through the invitation workflow when it is
implemented. This prevents an arbitrary public sign-up from gaining access to
Epignos notes.

## 2026-08-16: canonical development domain

The canonical application URL is `https://epinote.epignos.dev`. GoDaddy DNS has
an `A` record from `epinote` to the development server. nginx terminates a free
Let's Encrypt certificate for the domain, and both HTTP and direct-IP requests
redirect to the canonical hostname.

`APP_BASE_URL` uses the canonical domain so origin validation, authentication
links, and browser cookies agree on one origin. The application does not require
a paid GoDaddy certificate or hosting product.

## 2026-08-16: account avatar behavior

The top-right user avatar opens an account menu; it never logs the user out
directly. The menu shows the signed-in person's name and email plus the active
organization and workspace. `Sign out` is a separate labeled action so it cannot
be triggered accidentally by opening user information.

## 2026-08-16: workspace renaming

An active organization owner or admin may rename an active workspace by
double-clicking its visible top-bar name and editing it in place. Enter or moving
focus away saves; Escape cancels. Keyboard users can begin editing with Enter or
F2. This direct-edit interaction is the standard for other renameable labels as
they are implemented; no separate visible rename action is shown. Renaming
changes only the visible workspace `name`; its stable ID, internal slug, books,
notes, permissions, and URLs do not change. The server authorizes the request
through the active organization membership and scopes the update by organization
and workspace IDs.

## 2026-08-16: note row actions

Each note row has a quiet three-dot action button that appears on hover, focus,
or selection and remains visible on narrow touch layouts. Its first actions are
Rename and Delete. Double-clicking the note label also starts the same inline
rename interaction. Delete requires confirmation and archives the note instead
of physically removing its data, preserving the recoverable lifecycle defined
by the storage design. Both mutations remain scoped to the signed-in user's
organization and workspace and use the note revision to prevent stale changes.

## 2026-08-16: usable books and Quick Capture

`Quick Capture` is the workspace's permanent system book for notes captured
before the user chooses an organizational home. It is identified internally by
the stable `systemKey: "unsorted"`, not by its display position or visible name.
The sidebar section is labeled `Library`, while the underlying domain entity
remains a Book. No redundant badge is shown beside `Quick Capture`.

The sidebar uses quiet solid blue-gray surfaces and a cobalt selection rail; it
does not use gradients or saturated decorative color.

The Library plus control creates a named book inline. Selecting a book scopes the
sidebar note list and makes that book the destination for new notes. Workspace
search still searches all active notes and switches to a result's book when the
result is opened. Book and note creation validate that the selected book is
active and belongs to the signed-in user's organization and workspace.

## 2026-08-16: AI organization panel

`Organize` is EpiNote's first narrow AI workflow. It opens a panel inside the
note editor and sends only the currently saved title and plain text to OpenRouter
after an explicit user click. The model must return a strict JSON object with a
proposed title and complete plain-text body. The prompt forbids Markdown syntax,
adding facts, or dropping names, links, timestamps, claims, or source details.
Readable structure uses section labels, blank lines, and Unicode bullets.

The proposal is stored against the exact note revision and content hash. The
original remains canonical until the user selects `Apply organization`; the
server then revalidates tenant scope, revision, and hash before atomically
replacing the note content. A stale proposal returns `409`. Repeated requests for
the same revision and prompt version reuse the stored proposal rather than
spending another model request. The initial configurable model is
`openai/gpt-oss-20b` through OpenRouter structured outputs.

The first editor is plain-text-first. Its toolbar uses `Edit`, a Unicode bullet
list action, and `Read`; it does not expose Markdown bold/italic controls. Export
downloads `.txt` so a user never needs Markdown knowledge for ordinary notes.
The API also normalizes accidental Markdown headings, bullets, bold markers,
inline code, and code fences before showing or applying an AI proposal.

## 2026-08-16: summary-first organization and title ownership

Accepted organization proposals render a short `Summary` section at the top of
the note and store the summary separately in `approvedAi.summary`. The complete
source material follows the summary. On later organization requests, EpiNote
removes the exact previously approved summary from the model input so it does not
compound or duplicate generated text.

The AI may infer a title only when the current title is exactly `Untitled` or
`Untitled note`. Any user-written title is preserved by server-side logic even if
the model suggests a replacement. Prompt version `organize-v3-summary` prevents
reuse of older proposals without summaries.

The configured model is upgraded from `openai/gpt-oss-20b` to
`openai/gpt-oss-120b`. It preserves the same structured-output integration while
providing a stronger model for title inference, summarization, and organization.
Organization uses low reasoning effort because this is a constrained text
transformation, and excludes reasoning tokens from the response. Proposal caching
also includes the model identifier so a model change cannot reuse another model's
pending result.

## 2026-08-16: explicit autosave feedback

Notes autosave about 900 milliseconds after the user stops typing. A disabled
Save button incorrectly looked like the editor was blocked, so the saved state
is now rendered as `✓ Saved automatically`. While changes are pending, the same
footer position shows an active `Save now` button; a failed attempt shows
`Retry save`. The top-bar state uses the same explicit autosave wording.

## 2026-08-16: book sidebar interaction and hierarchy

Books render as consistent full-width horizontal rows with subtle borders, a
selected cobalt inset, and authoritative active-note counts. Counts come from a
MongoDB aggregation rather than the workspace's bounded note list and update in
the client after note creation or deletion.

The new-book control is a toggle. Its form has an explicit cancel button and
also closes on Escape, focus leaving the form, or selection of any book,
including the already-active book. Draft text and errors are cleared whenever
the form is dismissed.

User-created books can be renamed inline by double-clicking their row or using
F2 while it is focused. Quick Capture remains protected because its stable
system role must always be recognizable.

Multiple “libraries” map to the existing Workspace layer rather than a new
entity. A project is a Workspace; each project has its own Library of books and
notes. The next vertical slice is workspace creation and switching with all
book/note APIs scoped to the selected workspace.

## 2026-08-16: moving notes and deleting empty books

A note card can be dragged onto another book in the same Library to move it.
The note action menu also provides a `Move to` selector so the workflow remains
usable with a keyboard or touch device. A move changes only the note's `bookId`,
`updatedAt`, `updatedBy`, and revision; its title, canonical content, attachments,
AI metadata, and linked concepts remain intact. The API validates the expected
revision and scopes both the note and destination book to the signed-in user's
organization and workspace.

User-created books have a quiet three-dot menu for rename and delete. Delete is
available only when the book has no active notes, is confirmed by the user, and
archives rather than physically removes the book. The server performs its own
active-note check and returns a conflict if the book is not empty. Quick Capture
cannot be renamed or deleted because every workspace needs a permanent capture
destination.

## 2026-08-16: Library tree navigation

The sidebar renders the hierarchy as a real tree instead of separate book and
note lists. The selected book expands in place, its notes appear indented below
it with a quiet connecting rail, and a compact `New note` action sits at the end
of that branch. This makes the destination of a new note obvious without adding
a second creation control to the workspace top bar. Other books remain collapsed
with their authoritative note counts visible.

Workspace search temporarily replaces the expanded branch with a clearly
labeled cross-book result list. Selecting a result still opens its containing
book. Existing drag-and-drop movement and note action menus remain available in
both the normal tree and search results.

## 2026-08-16: contextual icons and dismissible action menus

Library navigation uses one restrained line-icon vocabulary to distinguish the
Library, Quick Capture, books, notes, and creation actions without adding color
noise. Book and note popovers identify their entity type and current name, then
pair Rename, Move, and Delete labels with matching icons; labels remain present
for clarity and accessibility.

Book and note action menus close when their trigger is pressed again, when
another action menu opens, on any click outside the trigger or popover, or when
Escape is pressed. This prevents a popover from remaining over the note tree.

## 2026-08-16: large-note AI model routing

Note storage and AI organization have separate limits. Canonical notes remain
saveable up to 1,000,000 characters. AI organization no longer rejects every
note above 30,000 characters.

The request size is measured as UTF-8 bytes after constructing the actual user
message, and the completion allowance grows with the input. Standard requests
try `openai/gpt-oss-120b`, requests from 30,000 through 130,000 bytes use the
configurable fast model (`google/gemini-3.6-flash`), and still larger supported
requests use `deepseek/deepseek-v4-pro`. Standard-model failures retry through
the fast model; fast-model failures retry through the large-output model. This
three-tier route reflects live behavior instead of assuming one model is best at
every note size.

AI requests have bounded timeouts, nginx allows the longer upstream response,
and a model response ending because of its token limit is rejected without
changing the note. The original note remains canonical until the user explicitly
applies a complete proposal.

## 2026-08-16: durable background organization and notifications

Organize no longer holds a browser request open while a model runs. Note and
book actions create durable `aiJobs` documents, return HTTP `202`, and use
Next.js `after()` to process jobs after the response. A workspace-level unique
lease allows only one organization job to process at a time. Queued and stale
jobs are recoverable through polling, so a closed or reloaded page does not lose
work. A top-right bell shows the latest job per note and links back to the note
for review.

Book organization queues every non-empty note but never applies proposals.
Canonical notes remain unchanged until the user explicitly approves one note's
proposal. Failed notes do not prevent the remaining book jobs from progressing.

## 2026-08-16: deterministic source-preservation gate

Real `Ideologies` data showed that valid structured JSON can still summarize
away most of a source note. Prompt version `organize-v4-source-preserving`
therefore adds a deterministic validation step: an organized body must retain
at least 60 percent of the source character volume and every detected source URL
and timestamp. A response that fails validation is discarded, optionally
retried through the next model tier, and never presented as an approvable
proposal. Existing version-3 proposals are reused only when they pass the same
gate.

## 2026-08-16: sourced book summary cards

Summary cards are a book-level study aid, not a replacement for canonical
notes. Organizing either one note or an entire book schedules a durable
`summarize-book-cards` job after pending note-organization jobs settle. A user
can also generate or refresh cards explicitly from the book menu or note
toolbar.

DeepSeek receives the current book snapshot, preferring valid organization
proposals while falling back to saved note text. It chooses two through eight
cards based on the material rather than filling a fixed template. Each card has
a short type, standalone summary, and at most four recall points. Every point
must cite note IDs supplied in that request; the server rejects unknown source
IDs, duplicate card titles, excessive cards, or excessive points before saving
the result.

Decks are immutable and keyed by a hash of the book name plus every active
source note's ID, revision, and content hash. Editing or renaming source material
makes the prior deck visibly stale instead of silently presenting it as current.
Cards link back to their source notes, carry an AI study-aid warning, and never
modify note content.

Summary Cards also render as the first, highlighted child of every expanded
book, above ordinary notes. The row is a persistent collection entry rather
than a hidden menu action and exposes ready, queued, processing, failed, and
empty-book states. The book menu and editor toolbar remain secondary shortcuts.

The editor toolbar is note-scoped, so it exposes `Summary` rather than book
Summary Cards. Clicking it opens a compact popover containing only the current
note's summary. The API returns an approved summary only for the exact applied
revision, or a current source-matched organization proposal; it never presents
an older summary after the note changes. Book decks remain exclusively in the
highlighted Library collection and book action menu.

Summary color is semantic rather than random. Book cards use a stable muted
palette by kind: overview blue, concept teal, person amber, timeline violet,
comparison rose, argument terracotta, and event green. The same accent carries
through the kind pill, memory number, summary block, bullet markers, and source
links. Approved note summaries use a calm green card while proposed summaries
use blue. All colors are flat, restrained, and gradient-free.

Note summaries can be enriched once with a cached wiki-style profile. A short
fast-model request extracts only grounded authors, named source works, people,
topics, places, and dates from the existing summary and a bounded source
excerpt. Source URLs are
never model-generated: the server extracts and validates them directly from the
saved note. Profiles are immutable and keyed to the note content hash and exact
summary, so an edited note cannot reuse stale labels. The UI highlights matching
terms inline and renders the context as compact, consistently colored chips.
Named source works and validated external links remain visibly distinct.
Every model-proposed label must also occur literally in the summary or saved note
before it can be stored or displayed. GPT-OSS 120B is the primary profile model,
with the configured fast and large-note models retained as bounded fallbacks.

## 2026-08-18: audio-intelligence batch checkpoint

The first video-understanding slice is a standalone server-side CLI under
`tools/audio-intelligence/`. It accepts exactly one HTTPS YouTube video URL,
downloads only its audio, requests a timestamped Whisper transcript, and asks a
single analysis model for strict structured output. The server then validates
every evidence segment ID and chapter time range before accepting the result.

The output remains a private filesystem job containing a manifest, download log,
normalized audio, source transcript, grounded analysis, and exact provider cost.
It does not write into notes or MongoDB and does not introduce a web endpoint,
queue, worker service, vector store, or visual-video processing yet. The next
vertical slice can wrap this proven batch contract with submission and job-status
UI without changing its evidence model.

YouTube cookies and OpenRouter credentials remain server-only secrets. Cookie
files must be owner-readable only and must never be committed or staged through
`/tmp`. Audio above the current 25 MB transcription boundary fails explicitly;
chunking will be added only when a real longer recording requires it.

## 2026-08-18: beta deployment identity

The current public deployment is explicitly labeled `EpiNote Beta`. Every
visible product wordmark carries the same small cobalt-outline `BETA` superscript
capsule, including landing, authentication, workspace, and illustrative preview
surfaces. Browser page titles also include `EpiNote Beta`. The marker is a quiet
release-state label within the existing flat Paper, Ink, and Cobalt theme; it is
not a logo, gradient, promotional banner, or replacement product name.

## 2026-08-18: read-only superadmin operations console

EpiNote has one dedicated platform account with `systemRole: superadmin`. The
role is deliberately separate from organization membership, cannot be requested
through public registration, and is protected by a unique partial MongoDB index
that permits only one holder. Provisioning refuses to promote an existing user
or replace a different superadmin implicitly.

The account follows the normal Argon2id and server-session authentication path,
but login goes directly to `/admin` and does not create tenant data. The console
is read-only for application and tenant records: it shows aggregate user,
session, organization, workspace, book, note, AI-job, and MongoDB footprint
metrics plus limited recent-account metadata. Feedback status is the only
mutable operational field. The console exposes no note bodies, password hashes,
session tokens, impersonation, role editing, tenant mutation, or destructive
controls. Unauthenticated requests redirect to login; authenticated users
without the exact platform role receive a not-found response.

## 2026-08-18: first-party feedback queue

Signed-in workspace users can submit either a bug or feature request through a
small modal in the main top bar. A report contains a short title, bounded
description, source path, and internal user, organization, and workspace
references. It does not copy the user's email, note contents, browser history,
user agent, screenshot, password, session data, or provider credentials. The UI
also warns users not to paste sensitive information into the description.

Submissions are stored in one `feedbackRequests` collection and limited to ten
per user per hour. The user receives a compact private reference number. No
email provider, external issue tracker, attachment service, queue, or background
worker is introduced for this slice.

The exact platform superadmin can view the latest reports in `/admin` and move
them through `open`, `in_progress`, `resolved`, or `closed`. Status changes store
the handling admin and timestamps. The admin API returns not-found to ordinary
users, accepts only the defined status values, and provides no report deletion,
impersonation, tenant mutation, or note access.

Help and change visibility remain equally direct. A separate Help button in the
workspace opens a short guide to capture, books, AI review, and feedback. It
links to a public, static `/release-notes` page maintained with the application
source. Release notes describe shipped user-visible behavior only; they do not
come from MongoDB, require an editor/admin subsystem, or expose internal
deployment details and secrets.

## 2026-08-19: simple-first rich note editor

The default Note remains a blank, distraction-free writing surface. Markdown
input rules are off by default and stored as a per-browser user preference; with
them off, leading `#`, `-`, numbers, brackets, and backticks remain ordinary
text. A user can enable `MD On` from the editor bar to activate Markdown typing
shortcuts and Markdown-aware plain-text paste.

The editor uses pinned Tiptap 3.30.2 packages rather than browser `execCommand`
or a custom `contenteditable` implementation. Its compact toolbar supports
paragraphs, three heading levels, a document reading font, bold, italic,
underline, five restrained highlight colors, bullets, ordered lists, persistent
checklists, links, code blocks, and editable tables. Tables use a six-by-six
size picker plus contextual row, column, and table deletion actions. Notes can
be exported as either plain text or Markdown.

MongoDB `contentSchemaVersion: 2` stores validated Tiptap-compatible JSON with
stable block IDs. The server permits only the explicitly supported nodes,
marks, attributes, link protocols, nesting, size, and depth. It derives
`plainText` itself from the accepted JSON; search, AI organization, summaries,
and Book cards continue to use that deterministic plain-text view. Existing
paragraph-only Notes are converted for display and migrate only when next
saved, so this release requires no destructive database migration and remains
compatible with rollback.

The browser keeps the complete rich JSON in its recoverable local draft. The
API still accepts the previous plain `body` request as a compatibility path for
an already-open older client. Revision checks remain unchanged. Applying an AI
organization intentionally replaces the Note body with organized plain text;
when a Note has formatting, checklist state, code, or tables, EpiNote now warns
and requires explicit confirmation before that replacement.

References:

- Tiptap React integration: <https://tiptap.dev/docs/editor/getting-started/install/react>
- Tiptap TableKit: <https://tiptap.dev/docs/editor/extensions/functionality/table-kit>
- Tiptap Markdown limitations: <https://tiptap.dev/docs/editor/markdown>

## 2026-08-20: explicit, simple code-block workflow

Code blocks are the one Markdown-style convention available even when general
Markdown shortcuts are off. Typing three backticks followed by Enter creates a
structured code block; an optional lowercase language after the opening fence
is retained. A complete fenced snippet pasted as plain text is parsed as code
without enabling the rest of Markdown.

While the caret is in code, the compact toolbar exposes only a language selector
and Done action. Done, Ctrl/Command+Enter, a closing three-backtick line, or the
editor's existing triple-Enter behavior returns to ordinary text. Language is
presentation metadata only: EpiNote stores and validates it but does not execute
code or load a syntax-highlighting runtime.

## 2026-08-20: consistent temporary-surface behavior

Temporary UI follows one interaction contract. Action menus, notifications,
summary popovers, account/table/export menus, and AI panels dismiss when the
user clicks or taps outside them or presses Escape. Native `details` menus use a
single workspace-level dismissal listener instead of separate one-off handlers.
Modal Help and Feedback surfaces dismiss from their backdrop using pointer
events, so mouse, pen, and touch behave consistently.

Library selection and tree expansion are separate state. Collapsing the current
Book hides only its children; it does not discard the selected Note, change the
editor, or interfere with autosave. Reopening another Book still saves pending
work before changing the active context. Short flat-color transitions provide
spatial continuity, and all new motion is disabled by the user's reduced-motion
preference.

## 2026-08-20: GCP is the selected off-host backup target

EpiNote will use a private Google Cloud Storage bucket as its primary off-host
backup destination. The server will create an authenticated MongoDB dump every
six hours, briefly quiescing only application writes, then package required
deployment configuration, encrypt the archive before upload, and use unique
timestamped object names.

A dedicated service account receives only `Storage Object Creator` on the backup
bucket. It cannot administer the bucket or delete prior archives. Public access
prevention, uniform bucket-level access, a tested retention policy, prefix-based
lifecycle rules, safe failure handling, and monthly restore exercises are part of
the recovery contract. The private recovery key remains off-server.

This is a recorded design decision, not a claim that backups are already active.
Implementation inputs and the full acceptance test are in
`docs/operations/EPINOTE_GCP_BACKUP_PLAN.md`.

## 2026-08-20: evidence-backed Book intelligence direction

The next intelligence slice is Book Concepts: an evidence-first index and a
bounded visual Map over concepts, entities, Notes, and explicit relationships.
Every generated item cites exact Note/block evidence, carries a source snapshot,
and becomes stale when source Notes change. Users can accept, reject, rename, and
merge proposals. Concepts remain ordinary MongoDB records; a graph database is
not introduced.

Book Index, grounded Ask, and a bounded user-directed Research Assistant follow
only after the concept workflow succeeds on a real large Book. Research results
remain separate, cited snapshots until the user explicitly saves selected
findings into a Note.

Production media intelligence will support user-owned uploads, pasted
transcripts, creator-authorized captions, and public YouTube URLs through an
official multimodal provider input. The existing cookie-based `yt-dlp` workflow
remains a private POC and will not be exposed as the production ingestion path.
EpiNote will not download or retain arbitrary third-party YouTube media. The
complete roadmap and delivery gates are in
`docs/EPINOTE_AI_FEATURES_ROADMAP.md`.

## 2026-08-20: first Book Concepts slice is an immutable grounded view

The first Book Concepts implementation is a Book-level derived snapshot, not a
canonical knowledge graph. It runs as the existing durable MongoDB-backed job
type `extract-book-concepts`, uses the configured large-note OpenRouter model,
and stores validated results in `bookConceptMaps` under the exact Book source
hash and prompt version.

The UI places a highlighted Concepts collection above ordinary Notes. It shows
compact colored concept cards, a short overview, explicit relationships, and
clickable supporting Notes. When any source Note revision changes, the last map
remains readable but is marked stale until the user refreshes it. AI/provider
failure is shown through the existing notification flow and never blocks
writing, autosave, search, or export.

This first slice does not silently merge concepts, modify Notes, create global
workspace identities, or introduce a canvas, graph database, vector database,
new worker service, or separate queue. Those capabilities must earn their place
through real usage of the simpler evidence-first view.
