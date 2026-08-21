# EpiNote

EpiNote is a simple, AI-assisted knowledge workspace for capturing notes,
organizing them into books, and turning a growing collection into useful
summaries and connections.

Public beta: [epinote.epignos.dev](https://epinote.epignos.dev)

EpiNote is built around one stable hierarchy:

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

The note remains the source of truth. AI output is reviewable derived material;
it does not silently replace the user's writing.

## Current capabilities

- Email-and-password accounts with Argon2id password hashing and server-side
  sessions.
- Organization and workspace isolation enforced by server-side authorization.
- Quick Capture plus user-created books with rename, delete, and drag-and-drop
  note organization.
- Simple text editing with automatic saving and explicit save state.
- AI organization proposals that must be reviewed before they are applied.
- Source-linked book Summary Cards and compact note summaries.
- Workspace Help, public release notes, and a private bug/feature-request flow.
- A dedicated superadmin operations page for aggregate usage, MongoDB footprint,
  AI jobs, and feedback status management.
- A standalone, server-side audio-intelligence proof of concept for one YouTube
  video at a time.

## Technology

- Next.js 16 and React 19
- TypeScript
- MongoDB
- Argon2id authentication
- OpenRouter for bounded AI workflows
- Vitest and ESLint

The deployed runtime follows a small architecture:

```text
Browser → Next.js UI/API → domain logic → MongoDB
                              └────────→ OpenRouter when requested
```

## Local development

Requirements:

- Node.js 24
- MongoDB 8 or another compatible MongoDB deployment
- npm

Install and configure:

```bash
npm ci
cp .env.example .env
```

Fill in the local MongoDB URI and generate a private HMAC secret. AI features
also require an OpenRouter key; ordinary note storage and editing do not.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

The committed [`.env.example`](.env.example) documents the supported runtime
variables:

| Variable | Purpose |
| --- | --- |
| `APP_BASE_URL` | Canonical origin used for request validation and generated links |
| `MONGODB_URI` | Authenticated MongoDB connection string |
| `MONGODB_DB` | Application database name |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | Blocks registration when verification is required but delivery is unavailable |
| `COOKIE_SECURE` | Enables the secure `__Host-` session cookie outside localhost |
| `AUTH_HMAC_SECRET` | Private HMAC key for privacy-preserving request identifiers |
| `OPENROUTER_API_KEY` | Optional server-only AI provider credential |
| `OPENROUTER_MODEL` | Primary organization model |
| `OPENROUTER_FAST_MODEL` | Fast supporting model |
| `OPENROUTER_LARGE_NOTE_MODEL` | Fallback for large-note work |

Never commit real environment files, database URIs, session tokens, API keys,
video cookies, generated passwords, or backup credentials.

## Verification

Run the complete local verification set before committing:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Repository guide

- [`src/app`](src/app) — pages and HTTP routes
- [`src/components`](src/components) — interactive application UI
- [`src/lib`](src/lib) — domain, database, authentication, and AI logic
- [`docs/EPINOTE_PRODUCT_AND_DELIVERY_PLAN.md`](docs/EPINOTE_PRODUCT_AND_DELIVERY_PLAN.md) — product scope and workflow
- [`docs/EPINOTE_STORAGE_DESIGN.md`](docs/EPINOTE_STORAGE_DESIGN.md) — MongoDB storage contract
- [`docs/EPINOTE_AUTH_DESIGN.md`](docs/EPINOTE_AUTH_DESIGN.md) — authentication contract
- [`docs/EPINOTE_IMPLEMENTATION_DECISIONS.md`](docs/EPINOTE_IMPLEMENTATION_DECISIONS.md) — shipped design decisions
- [`docs/operations`](docs/operations) — deployment and verification records
- [`docs/operations/EPINOTE_BACKUP_RUNBOOK.md`](docs/operations/EPINOTE_BACKUP_RUNBOOK.md) — encrypted backup and restore procedure
- [`deploy/README.md`](deploy/README.md) — versioned-release deployment procedure
- [`tools/audio-intelligence/README.md`](tools/audio-intelligence/README.md) — audio batch proof of concept

## Development status

EpiNote is a beta. One encrypted off-server backup has passed a full restore
test, but recurring backups remain disabled until an upload-only GCP identity is
installed. Email verification, password-reset delivery, attachments, and the
complete richer block editor are not finished. Review the operational
documentation before using this deployment for production or sensitive data.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
