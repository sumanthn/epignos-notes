# EpiNote Product and Delivery Plan

Status: agreed product direction, ready for implementation planning
Last updated: 2026-08-16

Detailed MongoDB storage contract:

- `docs/EPINOTE_STORAGE_DESIGN.md`

Detailed plans added after the initial product slice:

- `docs/EPINOTE_AI_FEATURES_ROADMAP.md`
- `docs/operations/EPINOTE_GCP_BACKUP_PLAN.md`

Detailed authentication contract:

- `docs/EPINOTE_AUTH_DESIGN.md`

Agreed future sharing and collaboration plan:

- `docs/EPINOTE_SHARING_PLAN.md`

Active implementation decisions:

- `docs/EPINOTE_IMPLEMENTATION_DECISIONS.md`

Development/test deployment record:

- `docs/operations/EPINOTE_DEV_TEST.md`

## 1. Product decision

EpiNote is an AI-first shared knowledge workspace for capturing, storing,
organizing, retrieving, and reusing notes. It is not a diary, activity feed, or
analytics dashboard.

The public product name is **EpiNote**. Its character is intelligent, simple,
calm, and useful. Existing internal infrastructure identifiers such as
`epignos_dev`, `epignos_app`, and `epignos-dev-test` remain unchanged for
operational continuity and are never presented as the public product name.

The core loop is:

`Capture -> Store safely -> Organize -> Understand -> Connect -> Retrieve -> Reuse`

The note is always the source of truth. AI may propose changes or derived
information, but it must not silently replace the user's original content.

## 2. Locked product hierarchy

```text
Organization
└── Workspace
    └── Book
        └── Note
            ├── Content blocks
            ├── Images and attachments
            ├── AI metadata
            └── Linked concepts
```

Definitions:

- Organization owns users, workspaces, and billing/administrative settings.
- Workspace is the working boundary for a team, project, or body of knowledge.
- Book is the human-controlled grouping of notes.
- Note is the primary unit users create, edit, search, export, and ask AI about.
- Content blocks are the canonical note body.
- Images and attachments retain the source material associated with a note.
- AI metadata contains suggestions and derived information, not canonical text.
- Linked concepts connect notes through evidence-backed relationships.

Every note belongs to a book. Each new workspace receives a `Quick Capture`
system book so capturing never forces the user to organize first. Its stable
internal key remains `unsorted`, while `Quick Capture` is displayed as a normal
book in the approved navigation hierarchy.

## 3. First real user and job

Initial user assumption:

- An individual knowledge worker operating inside an organization.
- They collect project ideas, research, meeting information, written notes, and
  images of handwritten material.
- They need to capture material quickly, retain the source, find it again, and
  turn it into useful work.

Initial job to be done:

> When I encounter useful information, let me save it immediately, preserve it
> reliably, and help me understand and retrieve it later without manually
> maintaining a complicated filing system.

## 4. Locked UI direction

The supplied handwritten mockup is the authoritative application structure.
The implementation may refine spacing, responsiveness, focus states, and visual
polish, but must not replace the structure with a dashboard.

### Landing page

- Plain text product name `EpiNote`; no logo mark or brand symbol.
- Minimal navigation: Product, Features, Sign in, and primary CTA.
- Primary message: `Turn scattered notes into connected knowledge`.
- Product preview shows the real notes workspace.
- No statistics, activity cards, diary widgets, or decorative product theatre.
- Use a clean, welcoming light theme with ample whitespace and clear typography.
- Keep the page visually simple; the product preview provides the main visual
  interest.
- Do not introduce a dark hero, gradient background, glow, or decorative artwork.

### Authenticated workspace

- Top bar:
  - Organization/workspace selector on the left.
  - Search in the center.
  - User/profile control on the right.
- Left panel:
  - Books.
  - Notes nested below their book.
  - Create, rename, reorder, and archive actions through contextual controls.
- Main panel:
  - Active note title and note editor.
  - Format and Preview controls.
  - Text, headings, lists, links, highlights, Markdown-friendly input, and
    inline images.
  - Contextual `Ask AI` action in the editor toolbar.
- Bottom controls:
  - Review.
  - Export.
  - Save/sync status.
- No permanent AI sidebar in the first release.

Approved visual reference:

- `docs/design/epignos-paper-ink-cobalt-theme-v1.png`
- The reference controls layout and theme only; its displayed product-name text
  must be changed from `Epignos` to `EpiNote` in the implementation.

## 5. Theme system

Theme name: Paper, Ink, and Cobalt. EpiNote launches with the light theme only.

```text
Canvas             #F7F7F2
Surface            #FFFFFF
Primary text       #172033
Muted text         #697386
Border             #E2E5EA
Primary accent     #315CF5
Selected state     #EEF3FF
Success            #20845A
Highlight          #FFF0A6
```

Theme rules:

- Flat solid colors only; no gradients.
- Light surfaces are the default across the landing page and application shell.
- No glassmorphism, neon, glows, or decorative logo marks.
- Use a neutral sans-serif typeface such as Geist or Inter.
- Use compact controls, 1px borders, small corner radii, and restrained shadows.
- Use whitespace and typography to create hierarchy.
- Cobalt is for primary actions, selection, focus, and active states.
- Yellow is reserved for user-created text highlighting.
- Green is reserved for successful save/sync state.
- All interactive states must meet accessible contrast and keyboard-focus needs.

## 6. MVP workflow

The first vertical slice must complete this workflow end to end:

1. A user signs in.
2. The user enters an organization workspace.
3. The user opens a book or uses the workspace's `Quick Capture` book.
4. The user creates a note.
5. The user types or pastes real content and optionally adds an image.
6. The note autosaves and visibly reports saved, saving, offline, or failed.
7. AI proposes a title, summary, book, and concepts after the original is saved.
8. The user accepts, edits, or rejects each proposal.
9. The user closes the note.
10. The user retrieves it through the book tree or search.
11. The user reviews or exports the note.

The workflow is not complete if content can be lost, errors are hidden, or AI
output cannot be traced to its source note.

## 7. Functional scope

### 7.1 Authentication and organizations

MVP:

- Email and password sign-in.
- Passwords hashed with Argon2id using current safe library defaults.
- Secure, HTTP-only, same-site session cookies.
- Server-side session storage with expiry and revocation.
- Organization owner, administrator, and member roles.
- Owner can invite, deactivate, and change member roles.
- Organization members can access organization workspaces in the first release.
- Authorization is checked on every server request, not inferred from the UI.
- Rate limits for sign-in and password-reset attempts.

Later, when an email provider is selected:

- Email verification.
- Password reset.
- Invitation emails.
- Optional magic-link or SSO sign-in.

### 7.2 Workspaces and books

- Create, rename, switch, and archive workspaces.
- Automatically create `Quick Capture` for each workspace.
- Create, rename, reorder, and archive books.
- Show books and nested notes in the left tree.
- Archive instead of hard-delete by default.
- Restore archived books and notes.
- Do not allow a book to be accessed outside its organization/workspace scope.

### 7.3 Notes

- Create, open, edit, archive, restore, and export notes.
- Canonical block-based content with stable block identifiers.
- Headings, paragraphs, bold, italic, underline, lists, quotes, code, links,
  highlights, and images.
- Paste plain text, Markdown, and sanitized rich HTML.
- Derive plain text and HTML from canonical content; do not maintain multiple
  competing editable formats.
- Track creator, last editor, created time, updated time, and revision number.
- Optimistic concurrency prevents one tab from silently overwriting another.
- Store recoverable note revisions at meaningful intervals rather than on every
  keystroke.

Autosave states:

- `Saved`: server acknowledged the current revision.
- `Saving`: a write is in progress.
- `Unsaved`: local changes exist.
- `Offline`: browser cannot currently reach the server.
- `Failed`: the last save failed and can be retried.
- `Conflict`: the server has a newer revision and the user must reconcile it.

### 7.4 Ingestion

Phase-one inputs:

- Direct typing.
- Plain-text paste.
- Markdown paste/import (`.md`).
- Text import (`.txt`).
- Sanitized formatted paste from a webpage or document.
- Image paste/upload (`.png`, `.jpg`, `.jpeg`, `.webp`).

Initial limits, subject to real usage:

- Text or Markdown import: 5 MiB.
- Image: 10 MiB.
- Other attachment: 20 MiB.
- Reject unsupported content with a useful error before storage.

Ingestion rules:

1. Validate type and size.
2. Store the original source or attachment.
3. Create/update the note and return success.
4. Start AI/OCR enrichment only after storage succeeds.
5. Show processing state without blocking note editing.
6. Preserve the original when extraction or AI processing fails.
7. Use a content hash to detect accidental duplicate submissions.

PDF and office-document ingestion, email forwarding, browser clipping, and
third-party integrations are later phases unless real users make one essential.

### 7.5 Search and retrieval

MVP search:

- Search note title and derived plain text.
- Filter by organization, workspace, book, creator, and updated date.
- Results show the matching note, book, and a short matching excerpt.
- Every query is constrained by server-side authorization.
- MongoDB text and compound indexes provide the first implementation.

Semantic retrieval is not required for the first storage slice. When introduced,
it must supplement keyword retrieval and preserve source citations. A separate
vector database will not be introduced until measured retrieval quality shows it
is necessary.

### 7.6 Review and export

- Review mode renders a clean, non-editing reading view.
- Export Markdown in the MVP.
- Copy plain text or formatted HTML.
- Exports include the note title and content but exclude unapproved AI proposals.
- PDF export is deferred until it is a confirmed workflow requirement.

## 8. AI contract

AI is a constrained component inside the product, not an autonomous actor.

### 8.1 Initial AI capabilities

- Suggest a note title.
- Produce a short summary.
- Suggest the best existing book.
- Suggest concepts and related notes.
- Extract action items or questions on request.
- Transform selected text on request: explain, summarize, rewrite, or outline.
- Answer workspace questions using retrieved notes and source citations.
- Extract text from images when image ingestion is enabled.

### 8.2 Required behavior

- Save original input before any AI request.
- Send only the minimum required authorized workspace content.
- Use structured model output validated against a server-side schema.
- Store model/provider, prompt version, source note revision, status, and time.
- Treat suggestions as `proposed`, `accepted`, `rejected`, `failed`, or `stale`.
- Never apply a proposal if the source revision changed after it was generated.
- Let users edit proposals before accepting them.
- Cite note and block identifiers for grounded answers.
- Surface partial failure without preventing ordinary note use.
- Do not claim confidence that the system cannot support.

### 8.3 Job execution

AI work may take longer than a request/response cycle. Use a small MongoDB-backed
job collection processed by the application worker. Do not add Redis or a
separate queue service for the MVP.

Job lifecycle:

`queued -> running -> succeeded | failed | cancelled | stale`

Jobs must support retry with a capped attempt count and record a safe error code.
Raw secrets and full provider responses must not be written to logs.

## 9. Data model

MongoDB database: `epignos_dev` in development/test.

All tenant-owned records include `organizationId`; workspace records also include
`workspaceId`. Repository functions must require tenant context rather than allow
unscoped collection access.

### `users`

```text
_id
email
emailNormalized
passwordHash
displayName
status: active | disabled
createdAt
updatedAt
lastLoginAt
```

Indexes:

- Unique `emailNormalized`.

### `sessions`

```text
_id
userId
tokenHash
createdAt
expiresAt
lastSeenAt
revokedAt
ipHash
userAgent
```

Indexes:

- Unique `tokenHash`.
- TTL on `expiresAt`.
- `userId, revokedAt`.

### `organizations`

```text
_id
name
slug
status
createdBy
createdAt
updatedAt
```

Indexes:

- Unique `slug`.

### `memberships`

```text
_id
organizationId
userId
role: owner | admin | member
status: invited | active | disabled
createdAt
updatedAt
```

Indexes:

- Unique `organizationId, userId`.
- `userId, status`.

### `workspaces`

```text
_id
organizationId
name
slug
status: active | archived
createdBy
createdAt
updatedAt
```

Indexes:

- Unique `organizationId, slug`.
- `organizationId, status, updatedAt`.

### `books`

```text
_id
organizationId
workspaceId
name
description
position
isSystem
status: active | archived
createdBy
createdAt
updatedAt
archivedAt
```

Indexes:

- `organizationId, workspaceId, status, position`.
- Unique partial index for the active system book (`systemKey: unsorted`) per workspace.

### `notes`

```text
_id
organizationId
workspaceId
bookId
title
content
plainText
revision
source
attachmentIds
aiMetadata
status: active | archived
createdBy
updatedBy
createdAt
updatedAt
archivedAt
```

Important fields:

- `content` is canonical block JSON with stable block IDs.
- `plainText` is derived for search and is never edited directly.
- `revision` increments on accepted writes.
- `source` records direct, paste, Markdown, text, image, or later import source.
- `aiMetadata` stores current approved values and pending proposal references.

Indexes:

- `organizationId, workspaceId, bookId, status, updatedAt`.
- `organizationId, workspaceId, updatedAt`.
- Text index on `title` and `plainText` with a higher title weight.

### `noteRevisions`

```text
_id
organizationId
workspaceId
noteId
revision
title
content
createdBy
createdAt
reason
```

Indexes:

- Unique `noteId, revision`.
- `organizationId, workspaceId, noteId, createdAt`.

### `attachments` and GridFS

File bytes are stored in MongoDB GridFS for the first single-server release.
Metadata remains tenant-scoped and authorization is checked before download.

```text
_id
organizationId
workspaceId
noteId
gridFsFileId
originalName
safeName
contentType
size
sha256
status
createdBy
createdAt
```

Indexes:

- `organizationId, workspaceId, noteId`.
- `organizationId, workspaceId, sha256`.

If file volume or delivery requirements outgrow GridFS, move bytes to an
S3-compatible store while keeping the same attachment metadata contract.

### `concepts`

```text
_id
organizationId
workspaceId
name
normalizedName
description
origin: user | ai
status: proposed | accepted | archived
createdAt
updatedAt
```

Indexes:

- Unique `organizationId, workspaceId, normalizedName` for accepted concepts.

### `noteConceptLinks`

```text
_id
organizationId
workspaceId
noteId
conceptId
relationship
evidenceBlockIds
origin: user | ai
confidence
status: proposed | accepted | rejected
sourceRevision
createdAt
updatedAt
```

This collection is the initial concept graph. No graph database is required.

### `aiJobs`

```text
_id
organizationId
workspaceId
noteId
type
sourceRevision
sourceHash
status
attempts
nextAttemptAt
lockedAt
lockedBy
provider
model
promptVersion
result
safeErrorCode
createdAt
updatedAt
```

Indexes:

- `status, nextAttemptAt, createdAt` for workers.
- `organizationId, workspaceId, noteId, createdAt`.
- A deduplication key for equivalent active jobs.

### `auditEvents`

Record consequential organization actions such as membership changes,
workspace archival, and exports. Do not store note body content or secrets in
audit events.

## 10. Application architecture

Use one deployable web application with clear internal layers:

```text
Browser UI
    -> Server routes/actions
        -> Authorization and validation
            -> Domain services
                -> MongoDB and GridFS
                -> AI provider for explicit AI operations
```

Recommended starting stack:

- Next.js with TypeScript for the web UI and server endpoints.
- A block editor such as Tiptap, selected only after a short editor spike proves
  paste, Markdown, highlighting, image, and serialization behavior.
- Official MongoDB Node.js driver.
- Zod or an equivalent runtime schema validator at every external boundary.
- CSS variables for the approved theme, optionally consumed through utility CSS.
- Vitest or the framework's standard unit runner for domain tests.
- Playwright for realistic browser workflows.
- A single application worker process for persisted AI jobs.

Do not begin with microservices, Redis, Kafka, a graph database, or a vector
database. Add infrastructure only when a measured product requirement cannot be
met by the single application and MongoDB.

## 11. Server API surface

Exact route conventions may follow the selected framework, but the capability
boundary should remain explicit.

```text
POST   /api/auth/sign-in
POST   /api/auth/sign-out
GET    /api/session

GET    /api/organizations
POST   /api/organizations/:organizationId/members
PATCH  /api/organizations/:organizationId/members/:membershipId

GET    /api/workspaces
POST   /api/workspaces
PATCH  /api/workspaces/:workspaceId

GET    /api/workspaces/:workspaceId/books
POST   /api/workspaces/:workspaceId/books
PATCH  /api/books/:bookId

GET    /api/books/:bookId/notes
POST   /api/books/:bookId/notes
GET    /api/notes/:noteId
PATCH  /api/notes/:noteId
POST   /api/notes/:noteId/archive
POST   /api/notes/:noteId/restore

POST   /api/notes/:noteId/attachments
GET    /api/attachments/:attachmentId

GET    /api/search
POST   /api/notes/:noteId/ai/suggestions
POST   /api/ai/proposals/:proposalId/accept
POST   /api/ai/proposals/:proposalId/reject
POST   /api/workspaces/:workspaceId/ask

GET    /api/notes/:noteId/export/markdown
```

API rules:

- Validate IDs and request bodies.
- Resolve current membership before loading tenant records.
- Return stable, useful error codes.
- Use idempotency keys for uploads and ingestion requests.
- Require `expectedRevision` for note updates.
- Never accept `organizationId` from the client as proof of access.
- Avoid sending password hashes, internal AI prompts, or provider credentials.

## 12. Save and concurrency behavior

The editor keeps local changes immediately and debounces network autosave.

Save request:

```text
noteId
expectedRevision
title
content
clientMutationId
```

On success, the server returns the new revision and saved time. If the stored
revision differs from `expectedRevision`, return a conflict instead of silently
overwriting data. The UI retains the local draft and offers reload or recovery.

The client should keep an unsent draft in browser storage until a server save is
acknowledged. Browser storage is recovery support, not the authoritative database.

## 13. Security requirements

- MongoDB stays bound to `127.0.0.1`; never expose port 27017 publicly.
- MongoDB authentication remains enabled.
- Application uses a database-scoped `readWrite` account, never the root user.
- Secrets are stored outside Git with restrictive permissions.
- Production requests use HTTPS only.
- Cookies use Secure, HTTP-only, and SameSite attributes.
- Password and sign-in endpoints are rate-limited.
- Pasted HTML is sanitized server-side and client-side as appropriate.
- Uploaded content is validated by detected type, not only file extension.
- Attachment downloads require authorization and safe content-disposition.
- All database access is tenant-scoped.
- AI requests exclude content outside the current authorized workspace.
- Logs redact credentials, session tokens, note bodies, and raw model responses.
- Hard deletion requires explicit confirmation and a retention policy.

## 14. Development/test infrastructure

Current database host is reached through the local SSH alias
`epignos-dev-test`. Raw server IP addresses and SSH identity paths must stay in
the developer's local SSH configuration and must not be committed.

Current installed database state:

- Ubuntu 24.04 LTS, amd64.
- MongoDB Community 8.0.29 from the official MongoDB APT repository.
- Service `mongod` enabled and active under systemd.
- Database `epignos_dev`.
- Application user `epignos_app` with `readWrite` on `epignos_dev` only.
- Administrative user stored separately for maintenance.
- Authentication enabled.
- Listener restricted to `127.0.0.1:27017`.
- Application credential file on the server:
  `/home/epignos/.config/epignos/mongodb.env` with mode `0600`.
- Root-only administrative credential file:
  `/root/.config/epignos/mongodb-admin.env` with mode `0600`.

Do not copy either credential file into the repository. The application service
should load the application environment file on the database/app host. Remote
development access, when truly needed, should use an SSH tunnel rather than a
public MongoDB listener.

## 15. Deployment shape

Initial development deployment:

- One Contabo development/test host.
- MongoDB installed as a systemd service.
- Web application installed as a separate non-root systemd service.
- Reverse proxy terminates HTTPS and forwards only the application port.
- Application port listens on loopback.
- MongoDB remains on loopback.
- Git checkout and build artifacts are owned by a dedicated application user.
- Deployments run database-compatible migrations/index setup before switching
  traffic.

Do not run production user data on the development/test database.

## 16. Backup and recovery

The Contabo disk is storage, not a backup. Before real user data is accepted:

- Run authenticated `mongodump` backups every six hours.
- Encrypt backup archives.
- Copy backups to a private Google Cloud Storage bucket outside the Contabo
  account and server.
- Use a dedicated bucket-scoped upload-only service account.
- Retain frequent backups for 35 days, weekly checkpoints for 90 days, and
  monthly checkpoints for 400 days initially.
- Back up MongoDB data, GridFS, and required deployment configuration.
- Test `mongorestore` into a separate database at least monthly.
- Record restore time and failures.
- Target a six-hour recovery point and two-hour recovery time.

The exact credential handling, encryption, retention, failure behavior, and
restore exercise are defined in `docs/operations/EPINOTE_GCP_BACKUP_PLAN.md`.
The design is approved but not yet deployed.

Never claim backups work until a restore has been tested.

## 17. Observability

Application:

- Structured request logs with request ID, route, status, duration, and safe
  tenant identifiers.
- Save failures, ingestion failures, AI failures, and authorization denials are
  observable.
- Health endpoint checks application process and a low-cost authenticated
  database ping.
- Readiness fails when required dependencies are unavailable.
- Error tracking groups stack traces without storing note bodies or secrets.

MongoDB:

- Monitor service state, disk usage, memory, connection count, and backup age.
- Alert before disk usage reaches a critical threshold.
- Review MongoDB startup warnings during environment hardening.
- Keep package upgrades deliberate and test patch upgrades in development first.

## 18. Testing strategy

### Domain tests

- Organization and workspace scoping.
- Role permissions.
- Book and note lifecycle.
- Note revision conflict behavior.
- Input validation and HTML sanitization.
- AI proposal validation and stale-proposal rejection.
- Duplicate ingestion handling.

### Integration tests

- Create and retrieve a real note in MongoDB.
- Attachment upload, authorized download, and denied cross-tenant download.
- Text search and tenant filtering.
- Session creation, expiry, and revocation.
- AI provider timeout and malformed structured output.
- Persisted AI job retry and capped failure.

### Browser tests

- Sign in -> workspace -> book -> create note -> autosave -> reopen.
- Paste rich content and verify safe rendering.
- Upload an image and verify it survives reload.
- Disconnect during editing and recover the draft.
- Open the same note in two tabs and verify conflict handling.
- Accept and reject AI proposals.
- Search for saved content and open the correct note.
- Review and export Markdown.
- Keyboard-only navigation and visible focus.

### Security tests

- A member cannot read another organization's note by guessing an ID.
- A disabled user cannot reuse an existing session.
- A non-admin cannot change membership roles.
- Anonymous attachment URLs do not reveal content.
- Malicious pasted HTML does not execute.
- MongoDB is unreachable on the server's public interface.

## 19. Delivery phases and exit criteria

### Phase 0: project foundation

Deliver:

- Scaffold the single web application.
- Environment validation.
- MongoDB connection lifecycle.
- Base theme tokens and approved shell.
- Test runner, browser test harness, linting, formatting, and CI.

Exit criteria:

- A clean checkout installs, tests, builds, and starts with documented commands.
- Missing environment variables fail with a useful message.
- Health/readiness behavior is verified.

### Phase 1: secure notes vertical slice

Deliver:

- Authentication and sessions.
- Organization, workspace, `Quick Capture` system book, and membership bootstrap.
- Book/note tree.
- Basic editor.
- Autosave with revision conflict handling.
- Reopen and keyword search.

Exit criteria:

- The complete non-AI MVP workflow works with real notes.
- Cross-organization access tests pass.
- Failed saves are visible and recoverable.

### Phase 2: rich content and ingestion

Deliver:

- Full agreed editor formatting.
- Markdown and text import.
- Sanitized formatted paste.
- Image upload and GridFS storage.
- Ingestion state, retry, and duplicate detection.
- Review and Markdown export.

Exit criteria:

- Real messy input survives save/reload without corruption.
- Unsupported and failed imports produce useful errors.
- Source content is preserved when processing fails.

### Phase 3: constrained AI assistance

Deliver:

- Persisted AI job worker.
- Title, summary, book, and concept proposals.
- Selection-based editor actions.
- Approve/reject/stale proposal behavior.
- Provider failure handling and cost/latency telemetry.

Exit criteria:

- AI outage does not block note creation or retrieval.
- Every applied proposal is validated and attributable.
- Stale proposals cannot overwrite newer content.

### Phase 4: grounded workspace questions

Deliver:

- Authorized retrieval across workspace notes.
- Answers with note/block citations.
- Related-note and accepted-concept navigation.
- Evaluation set made from real workspace questions.

Exit criteria:

- Answers consistently cite accessible sources.
- Unsupported answers say evidence is insufficient.
- Retrieval quality is measured before adding vector infrastructure.

### Phase 5: organization operations

Deliver:

- Invitations and member administration.
- Audit events for consequential actions.
- Backup automation and restore exercise.
- Deployment hardening and monitoring.

Exit criteria:

- An organization administrator can operate membership safely.
- A backup has been restored successfully in a separate environment.
- Production launch checklist has no unresolved critical risks.

## 20. Explicitly deferred

- Diary or calendar dashboard.
- Analytics dashboard.
- Unbounded free-form graph canvas; the planned Book Concept Map is a bounded,
  evidence-backed view over ordinary MongoDB records.
- Autonomous agents.
- Separate microservices.
- Redis or external job queue.
- Dedicated graph database.
- Dedicated vector database without measured need.
- Real-time multiplayer editing.
- Native mobile applications.
- Public publishing.
- Office-document import and broad integrations.
- Complex per-note ACLs.

## 21. Decisions still required

These do not block the secure notes foundation, but must be settled before their
phase begins:

1. AI provider, data-retention terms, model budget, and acceptable latency.
2. Email delivery provider and sender domain.
3. Public application domain and HTTPS termination choice.
4. Whether every organization member can access every workspace long term.
5. Required PDF/office-document ingestion and export priority.
6. Final GCS bucket name and European data-residency location.
7. Production hosting topology after development validation.

Default position: choose the smallest operational option when the decision is
needed and keep the interface replaceable only at the external boundary.

## 22. Immediate next action

The next implementation step is Phase 0 only:

1. Agree on the web stack and package manager.
2. Scaffold the smallest working application.
3. Connect it to `epignos_dev` using the restricted application credential.
4. Implement environment validation and a health/readiness check.
5. Apply the approved theme tokens and exact application shell.
6. Add one integration test proving an authenticated database write survives
   process restart/reconnect.

No AI code should be added until the ordinary create-save-reopen workflow is
reliable.
