# EpiNote Storage Design

Status: proposed storage contract for implementation review
Database engine: MongoDB Community 8.0
Development database: `epignos_dev`
Last updated: 2026-08-16

## 1. Purpose

This document defines how EpiNote stores identity, organizations, workspaces,
books, notes, editor content, attachments, revisions, search data, AI-derived
information, concepts, and operational state.

The design serves the first real workflow:

`sign in -> workspace -> book -> create note -> autosave -> close -> find -> reopen`

AI enrichment builds on this contract but is not required for ordinary note
storage or retrieval.

## 2. Storage principles

1. The current note is one atomic MongoDB document.
2. Every tenant-owned record carries its organization/workspace boundary.
3. Editor JSON is canonical; plain text, HTML, and Markdown are derived.
4. Original user input is stored before OCR or AI processing begins.
5. AI proposals are separate from user-approved note data.
6. File bytes are stored outside note documents in GridFS.
7. Soft deletion is the default; hard deletion is deliberate and audited.
8. Indexes support measured queries, not hypothetical future features.
9. The current standalone MongoDB server does not require transactions, change
   streams, a graph database, a vector database, Redis, or an external queue.
10. Recovery includes browser drafts, revisions, checksums, logical backups, and
    tested restoration.

## 3. Locked hierarchy and invariants

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

Invariants:

- A workspace belongs to exactly one organization.
- A book belongs to exactly one workspace and organization.
- A note belongs to exactly one book, workspace, and organization.
- Each workspace has exactly one system book with `systemKey: "unsorted"`.
- The system book is displayed as `Quick Capture` without changing the hierarchy
  or its stable `systemKey: "unsorted"` identity.
- Moving a note may change `bookId` only within its current workspace.
- Cross-workspace copying creates a new note with source provenance.
- An ObjectId presented by a client is never proof of authorization.

## 4. Collections

Core storage slice:

```text
users
sessions
authTokens
authThrottle
organizations
memberships
organizationInvitations
workspaces
books
notes
noteRevisions
attachments
noteFiles.files       GridFS-managed
noteFiles.chunks      GridFS-managed
auditEvents
schemaMigrations
```

Created only when their feature phase starts:

```text
aiProposals
aiJobs
concepts
noteConceptLinks
```

Do not create empty future-facing collections merely for architectural symmetry.

Relationship map:

```text
users ──< memberships >── organizations ──< workspaces ──< books ──< notes
  │                                                           │
  ├──< sessions                                               ├──< noteRevisions
  ├──< authTokens                                             ├──< attachments ──> GridFS
  └──< auditEvents                                            ├──< aiProposals
                                                              ├──< aiJobs
                                                              └──< noteConceptLinks >── concepts
```

Detailed registration, session, password reset, throttling, invitation, and auth
audit behavior is defined in `docs/EPINOTE_AUTH_DESIGN.md`.

## 5. Common field rules

- Use MongoDB `ObjectId` for primary and foreign identifiers.
- Represent ObjectIds as validated 24-character hexadecimal strings at API
  boundaries.
- Store all authoritative timestamps as server-created UTC `Date` values.
- Every tenant query includes authorized `organizationId`; workspace records also
  include authorized `workspaceId`.
- Use explicit status fields rather than contradictory boolean combinations.
- Documents whose shape evolves include `schemaVersion`.
- Editor content has a separate `contentSchemaVersion`.
- Preserve display values and store normalized comparison fields separately.
- Never store database URIs, session tokens, AI provider keys, or other secrets in
  application collections.

## 6. Identity and tenancy

### `users`

```text
_id
schemaVersion
email
emailNormalized
passwordHash
displayName
status: pending_verification | active | disabled
emailVerifiedAt
passwordChangedAt
authVersion
createdAt
updatedAt
lastLoginAt
disabledAt
```

Rules:

- Email normalization is trim plus lowercase.
- Password hashes use Argon2id and are excluded from normal projections.
- Disabling a user revokes sessions but preserves note attribution.

Indexes:

```text
unique { emailNormalized: 1 }
       { status: 1, updatedAt: -1 }
```

### `sessions`

```text
_id
schemaVersion
userId
tokenHash
status: active | revoked
authVersion
createdAt
expiresAt
absoluteExpiresAt
lastSeenAt
revokedAt
userAgent
deviceLabel
ipHash
```

Rules:

- The browser receives an opaque cookie token; MongoDB stores only its SHA-256
  hash.
- Session validity checks status and expiry even before TTL cleanup runs.
- Session `authVersion` must match the current user's `authVersion`.
- `lastSeenAt` updates are throttled instead of written on every request.

Indexes:

```text
unique { tokenHash: 1 }
TTL    { expiresAt: 1 } expireAfterSeconds: 0
       { userId: 1, status: 1, expiresAt: 1 }
```

### `organizations`

```text
_id
schemaVersion
name
slug
status: active | archived
createdBy
createdAt
updatedAt
archivedAt
```

Indexes:

```text
unique { slug: 1 }
```

Ownership is represented by membership rather than a second owner field that can
disagree with membership state.

### `memberships`

```text
_id
schemaVersion
organizationId
userId
role: owner | admin | member
status: invited | active | disabled
createdAt
updatedAt
disabledAt
```

Rules:

- One membership per user per organization.
- The last active owner cannot be disabled or demoted.
- The first release gives active organization members access to all active
  organization workspaces.
- Private workspace memberships are deferred until required by a real workflow.

Indexes:

```text
unique { organizationId: 1, userId: 1 }
       { userId: 1, status: 1, updatedAt: -1 }
       { organizationId: 1, role: 1, status: 1 }
```

## 7. Workspace and book storage

### `workspaces`

```text
_id
schemaVersion
organizationId
name
slug
status: active | archived
createdBy
createdAt
updatedAt
archivedAt
```

Indexes:

```text
unique { organizationId: 1, slug: 1 }
       { organizationId: 1, status: 1, updatedAt: -1 }
```

Workspace creation is idempotent:

1. Create the workspace.
2. Create its `Quick Capture` system book under a unique index.
3. Retry step two safely if it fails.

Workspace renaming changes only `name` and `updatedAt`. The stable workspace ID,
slug, books, notes, and permissions do not change. An active organization owner
or admin must authorize the update.

### `books`

```text
_id
schemaVersion
organizationId
workspaceId
name
normalizedName
description
position
systemKey: unsorted | null
status: active | archived
createdBy
createdAt
updatedAt
archivedAt
```

Rules:

- The `Quick Capture` system book cannot be renamed or archived.
- User-created books may share display names in the MVP.
- Use simple integer positions and bounded sibling updates for reorder.
- Archiving a book hides it and its notes from ordinary navigation without
  rewriting every child note.
- Restoring the book restores access to its notes.

Indexes:

```text
{ organizationId: 1, workspaceId: 1, status: 1, position: 1 }
unique partial { organizationId: 1, workspaceId: 1, systemKey: 1 }
  where systemKey exists and is not null
```

## 8. Note storage

The note document is the atomic save boundary.

### `notes`

```json
{
  "_id": "ObjectId",
  "schemaVersion": 1,
  "contentSchemaVersion": 1,
  "organizationId": "ObjectId",
  "workspaceId": "ObjectId",
  "bookId": "ObjectId",
  "title": "Capture workflow",
  "titleSource": "user",
  "content": { "type": "doc", "content": [] },
  "plainText": "Derived searchable text",
  "contentHash": "SHA-256",
  "revision": 12,
  "source": {
    "type": "direct",
    "originalAttachmentId": null,
    "importedAt": null
  },
  "approvedAi": {
    "summary": null,
    "conceptIds": [],
    "updatedAt": null,
    "sourceRevision": null,
    "proposalId": null
  },
  "status": "active",
  "createdBy": "ObjectId",
  "updatedBy": "ObjectId",
  "createdAt": "Date",
  "updatedAt": "Date",
  "archivedAt": null
}
```

Canonical content rules:

- `content` is validated block-editor JSON.
- Meaningful editor nodes receive stable block IDs.
- Block IDs allow AI answers and concept links to cite exact evidence.
- The editor schema rejects unknown executable nodes and unsafe attributes.
- `plainText` is derived on the server from validated content.
- HTML is generated for preview/export and is not canonical.
- Markdown is imported/exported and is not a competing editable representation.
- `contentHash` is generated on the server from normalized canonical content.
- Note image nodes store `attachmentId`, never paths or public URLs.

Title source:

```text
user | ai-approved | import
```

Once a user edits a title, AI may propose another but cannot replace it silently.

Practical application limits:

```text
title                         200 Unicode characters
canonical content JSON       2 MiB serialized
derived plain text            1 MiB
approved AI summary           2,000 Unicode characters
approved concept IDs          100 per note
```

The limits keep notes well below MongoDB's 16 MiB BSON document limit and leave
room for schema evolution.

Lifecycle:

```text
active | archived
```

The MVP does not automatically purge notes. Hard deletion is added only with a
retention policy, tested backup, explicit authority, and attachment cleanup.

Indexes:

```text
{ organizationId: 1, workspaceId: 1, bookId: 1, status: 1, updatedAt: -1 }
{ organizationId: 1, workspaceId: 1, status: 1, updatedAt: -1 }
{ organizationId: 1, workspaceId: 1, contentHash: 1 }
text { organizationId: 1, title: "text", plainText: "text" }
  weights: title 10, plainText 1
  name: notes_org_text
```

Every text query supplies equality on `organizationId`. Workspace/book/status
filters remain authorization-aware.

## 9. Autosave and concurrency

Save input:

```text
noteId
expectedRevision
clientMutationId
title
content
```

Server save sequence:

1. Validate session and membership.
2. Validate IDs, title, and editor JSON.
3. Derive plain text and content hash on the server.
4. Load the current note through tenant-scoped identifiers.
5. Decide whether a periodic revision snapshot is due.
6. Update the note using this filter:

```text
_id
organizationId
workspaceId
status: active
revision: expectedRevision
```

7. Set current values and increment `revision` in one atomic update.
8. Return new revision, hash, and server save time.

If no document matches, the server internally distinguishes not found,
unauthorized, archived, and revision conflict without revealing another tenant's
data.

Client behavior:

- Keep immediate draft changes in memory.
- Keep an unsent recovery draft in browser storage.
- Debounce network autosave.
- Never show `Saved` until the current mutation is acknowledged.
- Keep the local draft after timeout, network failure, or conflict.
- Do not silently use last-write-wins.

Critical note, membership, and authentication writes use acknowledged journaled
writes. A successful response means MongoDB acknowledged the write.

## 10. Revision storage

### `noteRevisions`

```text
_id
schemaVersion
organizationId
workspaceId
noteId
revision
title
contentSchemaVersion
content
contentHash
createdBy
createdAt
reason
```

Reasons:

```text
periodic | before-import | before-ai-apply | manual | before-archive
```

Rules:

- The current note remains authoritative.
- Create at most one periodic snapshot per five-minute editing interval, plus
  explicit milestones.
- Keep the most recent 100 snapshots per note initially.
- Do not time-purge revisions until real storage usage is measured.
- Never delete the only snapshot preceding an archive or AI apply.
- Snapshot failures are observable; the UI must not imply a recovery point exists
  when it does not.

Indexes:

```text
unique { noteId: 1, revision: 1 }
       { organizationId: 1, workspaceId: 1, noteId: 1, createdAt: -1 }
```

Decision still to confirm: whether a due snapshot failure blocks the associated
note save or remains a visible, retryable history failure. Recommended MVP
default: current note save succeeds, history failure is logged and retried, and
the browser retains its draft.

## 11. Attachments and GridFS

Use GridFS bucket `noteFiles`:

```text
noteFiles.files
noteFiles.chunks
```

### `attachments`

```text
_id
schemaVersion
organizationId
workspaceId
noteId
gridFsFileId
originalName
safeName
contentType
size
sha256
kind: image | document | original-import
source: upload | paste | import
status: pending | uploading | ready | failed | deleted
errorCode
createdBy
createdAt
updatedAt
```

Upload workflow:

1. Authorize the note and validate declared size/type.
2. Create a `pending` attachment record.
3. Stream bytes to GridFS while hashing and detecting actual type.
4. Reject mismatched type or excessive size and remove partial bytes.
5. Set `gridFsFileId` and `ready` only after the stream completes.
6. Add the attachment reference to note content through a revisioned note save.
7. Cleanup removes old pending uploads and orphaned GridFS files.

Download workflow:

1. Query attachment using authorized organization/workspace.
2. Require `ready`.
3. Stream bytes through the application with safe response headers.
4. Never provide a public unauthenticated GridFS URL.

GridFS operations are multi-document and not atomic. The attachment status makes
partial uploads invisible and retryable.

Rules:

- Initial image limit: 10 MiB.
- Initial other attachment limit: 20 MiB.
- Identical hashes may produce a warning but do not silently share ownership or
  deletion state.
- Deletion removes the note reference, marks metadata deleted, then removes bytes
  through retryable cleanup.

Indexes:

```text
{ organizationId: 1, workspaceId: 1, noteId: 1, status: 1, createdAt: 1 }
{ organizationId: 1, workspaceId: 1, sha256: 1, status: 1 }
{ status: 1, updatedAt: 1 }
```

## 12. Note and book lifecycle operations

Create note:

- Resolve authorized active workspace.
- Resolve the requested active book or `Quick Capture`.
- Store empty canonical content with `revision: 1`.

Move note:

- Require destination book in the same tenant/workspace.
- Update `bookId`, editor attribution, timestamp, and revision atomically.

Archive note:

- Create a `before-archive` snapshot.
- Set archived status/time.
- Preserve attachments and concept links.
- Restore to the original active book or `Quick Capture` if unavailable.

Archive book:

- `Quick Capture` cannot be archived.
- Hide the book and its notes without rewriting all child note records.
- Enforce book lifecycle on direct note reads so stale UI cannot bypass it.

## 13. AI storage

AI collections are added after ordinary note storage is reliable.

Only compact accepted values live in `notes.approvedAi`. Pending/history values
live in `aiProposals`.

### `aiProposals`

```text
_id
schemaVersion
organizationId
workspaceId
noteId
type: title | summary | book | concepts | transform | organize
value
status: proposed | accepted | rejected | stale | failed
sourceRevision
sourceHash
provider
model
promptVersion
createdAt
decidedAt
decidedBy
```

Accept rules:

1. Authorize proposal and note.
2. Require proposal status `proposed`.
3. Require note revision/hash to match the proposal source.
4. Create `before-ai-apply` history when note content changes.
5. Apply only schema-validated fields.
6. Record the accepted proposal ID in approved metadata.

Indexes:

```text
{ organizationId: 1, workspaceId: 1, noteId: 1, status: 1, createdAt: -1 }
{ noteId: 1, sourceRevision: 1, type: 1, status: 1 }
```

### `aiJobs`

```text
_id
schemaVersion
organizationId
workspaceId
noteId
type
status: queued | running | succeeded | failed | cancelled | stale
sourceRevision
sourceHash
attempts
maxAttempts
nextAttemptAt
lockedAt
lockedBy
safeErrorCode
createdAt
updatedAt
```

Workers claim jobs atomically with `findOneAndUpdate`. Stale locks become
retryable after a bounded timeout. Store safe error codes, never secrets, note
bodies, or unbounded provider responses.

Indexes:

```text
{ status: 1, nextAttemptAt: 1, createdAt: 1 }
{ organizationId: 1, workspaceId: 1, noteId: 1, createdAt: -1 }
partial unique deduplication key for queued/running equivalent jobs
```

## 14. Concepts without a graph database

### `concepts`

```text
_id
schemaVersion
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

### `noteConceptLinks`

```text
_id
schemaVersion
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

Rules:

- Accepted concepts are unique by normalized name within a workspace.
- AI relationships remain proposed until accepted or visibly labeled.
- Evidence block IDs must exist in the cited revision.
- Deleting a concept link never changes note content.

Indexes:

```text
concepts:
  unique partial { organizationId: 1, workspaceId: 1, normalizedName: 1 }
    where status is accepted

noteConceptLinks:
  { organizationId: 1, workspaceId: 1, noteId: 1, status: 1 }
  { organizationId: 1, workspaceId: 1, conceptId: 1, status: 1 }
  unique { noteId: 1, conceptId: 1, relationship: 1, sourceRevision: 1 }
```

## 15. Search

MVP search:

- Use the self-managed MongoDB text index on title and plain text.
- Always constrain by authorized organization.
- Optionally filter workspace, book, status, creator, and time.
- Return bounded result fields and excerpts, not full note bodies.
- Exclude archived notes unless explicitly requested.
- Escape excerpts before rendering.
- Measure explain plans against realistic data.

Semantic retrieval is deferred. Before adding embeddings/vector storage:

1. Build real user questions.
2. Measure keyword and AI-metadata retrieval.
3. Identify failures semantic retrieval must solve.
4. Select infrastructure based on measured needs.

## 16. Validation and migrations

Application schemas are the detailed validation authority. MongoDB provides:

- unique constraints,
- TTL cleanup,
- compound/text indexes,
- minimal validators for required types and statuses.

Create collections explicitly in storage migrations. Begin validators at
`moderate` during development, migrate existing data, then use `strict` before
production.

### `schemaMigrations`

```text
_id: ordered migration identifier
name
checksum
appliedAt
appliedBy
```

Migration rules:

- Migrations are ordered, idempotent, and tracked in Git.
- Never edit an applied migration; add a new migration.
- Name every index explicitly.
- Destructive migrations require a verified backup and manual confirmation.
- Large backfills are resumable.
- Application readiness checks the required schema version.

## 17. Backup and recovery contract

Back up:

- all application collections,
- both GridFS collections,
- database users and roles,
- MongoDB configuration/version inventory,
- application secrets through a separate encrypted secret backup.

For the current standalone server:

- use authenticated `mongodump`,
- quiesce application writes for a consistent live-data archive,
- generate SHA-256 checksums,
- copy archives off-host,
- prove recovery with `mongorestore`.

Current local recovery bundle:

```text
/Users/sumanth/epignos-notes/mongodb-deployment-backup
```

Before production, define recovery targets, automate encrypted off-host backups,
and regularly restore into a clean target. A backup is not working merely because
an archive file exists.

## 18. Failure handling

MongoDB unavailable:

- Retain browser recovery draft.
- Show Offline/Failed, never Saved.
- Retry using the last acknowledged revision.

Revision conflict:

- Reject the update.
- Preserve the local draft.
- Let the user reload, compare, or copy their draft.

Interrupted attachment:

- Keep non-ready and invisible.
- Remove partial bytes through cleanup.
- Allow retry without changing note content.

AI failure:

- Mark job/proposal failed with a safe code.
- Keep note and original attachments unchanged.
- Ordinary edit/search/retrieval continues.

## 19. Implementation slices

### Slice 1: connection and migration runner

- Validate `MONGODB_URI` without logging it.
- Share one driver client per process.
- Implement health/readiness ping.
- Create core collections and indexes idempotently.

Acceptance: bad configuration fails clearly, reconnect works after MongoDB restart,
and migrations are safe to rerun.

### Slice 2: identity and tenant bootstrap

- Users, sessions, organizations, memberships, workspaces, books.
- Create the first workspace and `Quick Capture` system book idempotently.
- Tenant-aware repository boundaries.

Acceptance: two organizations cannot access each other's records; last-owner and
session revocation rules work.

### Slice 3: create, save, reopen

- Notes and revisions.
- Canonical editor validation.
- Derived plain text/hash.
- Revision-based autosave.
- Book tree reads.

Acceptance: real content survives close/reopen and server restart; concurrent
saves conflict visibly; failed saves never display Saved.

### Slice 4: search and archive

- Text index and authorized filters.
- Note/book archive and restore.

Acceptance: realistic content is retrievable and explain plans use expected
indexes.

### Slice 5: attachments

- GridFS lifecycle.
- Paste/upload/download.
- Orphan cleanup.

Acceptance: images survive reload and backup/restore; interrupted uploads remain
invisible; cross-tenant downloads fail.

### Slice 6: AI and concepts

- Add AI/concept collections only when implementing their workflows.
- Validate revision/hash approval behavior.

Acceptance: AI outage cannot block or lose notes; stale proposals cannot apply.

## 20. Required storage tests

1. Create/retrieve a note with headings, links, highlight, and image reference.
2. Reject malformed or oversized editor content without losing local draft.
3. Save revision 2 from expected revision 1.
4. Reject a second concurrent save still expecting revision 1.
5. Prevent organization A from reading organization B's note by ID.
6. Move a note only to a book in its workspace.
7. Archive and restore notes/books.
8. Search title/body within authorized organization.
9. Upload, authorize, download, and clean an attachment.
10. Restart MongoDB and retrieve saved note/attachment.
11. Dump and restore a representative note plus GridFS file.
12. Reject expired/revoked sessions.
13. Fail AI processing and prove note remains unchanged.

## 21. Locked decisions

- MongoDB is the MVP operational database.
- Current note state is one atomic note document.
- Canonical editor JSON is stored; other representations are derived.
- Autosave uses expected revisions, not last-write-wins.
- Files use GridFS plus tenant-scoped attachment metadata.
- Quick capture uses the system book displayed as `Quick Capture`.
- AI proposals/jobs are separate from approved note data.
- Concepts use ordinary collections, not a graph database.
- Keyword search precedes vector infrastructure.
- The standalone deployment does not depend on multi-document transactions.

## 22. Decisions to confirm before Slice 3

1. Editor library and exact canonical JSON schema.
2. Whether due revision-snapshot failure blocks a save or remains retryable.
3. Autosave debounce and browser-draft retention after a usability test.
4. Whether 2 MiB notes and 10/20 MiB upload limits fit the first real inputs.

Recommended defaults: validate a Tiptap-style editor spike, keep periodic history
failure observable but non-blocking, use a short autosave debounce with local
recovery, and start with the documented size limits.

## 23. References

- MongoDB CRUD and single-document atomicity:
  <https://www.mongodb.com/docs/v8.0/crud/>
- MongoDB expected-value update filters:
  <https://www.mongodb.com/docs/manual/core/write-operations-atomicity/>
- MongoDB GridFS behavior and limitations:
  <https://www.mongodb.com/docs/manual/core/gridfs/>
- MongoDB compound-index design:
  <https://www.mongodb.com/docs/v8.0/data-modeling/schema-design-process/create-indexes/>
- MongoDB equality-sort-range guidance:
  <https://www.mongodb.com/docs/v8.0/tutorial/equality-sort-range-guideline/>
