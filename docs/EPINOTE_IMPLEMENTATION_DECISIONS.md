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

## 2026-08-16: explicit autosave feedback

Notes autosave about 900 milliseconds after the user stops typing. A disabled
Save button incorrectly looked like the editor was blocked, so the saved state
is now rendered as `✓ Saved automatically`. While changes are pending, the same
footer position shows an active `Save now` button; a failed attempt shows
`Retry save`. The top-bar state uses the same explicit autosave wording.
