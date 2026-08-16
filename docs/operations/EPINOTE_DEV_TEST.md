# EpiNote Development/Test Deployment

Status: deployed and verified
Last updated: 2026-08-16

## Access

- Application: <https://epinote.epignos.dev>
- Direct-IP requests redirect to the canonical domain.
- SSH: use the local alias `epignos-dev-test`.
- Do not commit the alias's resolved key path or database credentials.

## Deployed software

```text
Ubuntu 24.04 LTS amd64
Node.js 24.19.0 LTS
Next.js 16.3.1
React 19.2.8
nginx 1.24.0
MongoDB Community 8.0.29
Certbot 5.7.0
```

Active release:

```text
/opt/epinote/releases/20260816-note-drag-book-delete
/opt/epinote/current -> /opt/epinote/releases/20260816-note-drag-book-delete
```

## Service layout

```text
HTTPS :443 -> nginx -> 127.0.0.1:3000 -> EpiNote
                                     -> MongoDB 127.0.0.1:27017
```

Public listeners are SSH, HTTP redirect, and HTTPS. Next.js and MongoDB listen
only on loopback.

Services:

```text
epinote.service   enabled, active
nginx.service     enabled, active
mongod.service    enabled, active
```

Application configuration:

```text
/home/epignos/.config/epinote/app.env
owner: epignos:epignos
mode: 0600
```

The file contains the MongoDB application URI, base URL, database name, cookie
mode, verification mode, HMAC secret, `OPENROUTER_API_KEY`, and
`OPENROUTER_MODEL`. Never print or
copy its values into Git, tickets, or chat. The OpenRouter key is loaded into the
service environment and is used only after a user explicitly requests note
organization.

The local source key remains outside the repository at
`/Users/sumanth/epignos-notes/openrouter-epignos-test.txt` with mode `0600`.
The server environment file also has mode `0600`.

## TLS

- Certificate name: `epinote-ip`.
- Identifier: the public IPv4 address.
- Issuer: Let's Encrypt.
- Key: ECDSA.
- Current certificate expiry: 2026-08-23 UTC.
- IP certificates are intentionally short-lived and must renew automatically.
- Timer: `snap.certbot.renew.timer`.
- Pre-hook stops nginx for the standalone HTTP challenge.
- Post-hook always starts nginx again.
- A simulated renewal succeeded on 2026-08-16.

Canonical domain certificate:

```text
name: epinote.epignos.dev
issuer: Let's Encrypt
key: ECDSA
current expiry: 2026-11-14 UTC
renewal: snap.certbot.renew.timer with the same tested hooks
simulated renewal: passed 2026-08-16
```

Certificate files remain root-protected under:

```text
/etc/letsencrypt/live/epinote-ip/
```

## Verification performed

Local code checks:

- TypeScript strict check passed.
- ESLint passed.
- Production Next.js build passed locally and on the amd64 server.
- Six unit tests passed.
- Argon2 hash/verify round-trip passed.
- npm reported zero known vulnerabilities.

Public HTTPS workflow:

```text
landing page                         200
unauthenticated workspace            307 -> login
registration                         201
authenticated workspace              200
note creation                        201
note save                            200, revision 1 -> 2
workspace reload                     200 with persisted note
stale revision save                  409
cross-origin note creation           403
logout                               200
workspace after logout               307 -> login
```

The test note was also read directly from MongoDB to verify its revision and
canonical content blocks. Both temporary test accounts and all their associated
test documents were removed afterward.

Session cookie verification:

```text
__Host- prefix
Secure
HttpOnly
SameSite=Lax
Path=/
```

## Operational checks

```bash
ssh epignos-dev-test 'systemctl is-active epinote nginx mongod'
ssh epignos-dev-test 'curl --fail --silent http://127.0.0.1:3000/api/health'
curl --fail --silent https://epinote.epignos.dev/api/health
ssh epignos-dev-test 'journalctl -u epinote -n 100 --no-pager'
ssh epignos-dev-test 'sudo certbot certificates'
```

## Rollback

The `20260816-static-assets-fix` and `20260816-vertical-slice-1` releases are
retained as rollback points. Rollback selects a known earlier release, restarts
`epinote`, and verifies the local health and compiled stylesheet endpoints.

## Known development limitations

- Email verification is explicitly disabled on this dev-test instance.
- Registration is public; do not treat this as a production user environment.
- Forgot/reset password email is designed but not implemented yet.
- Login throttling, auth audit events, device-session management, and invitation
  acceptance remain to be implemented.
- The first editor is text-based canonical paragraph blocks; attachments and a
  richer block editor are not present yet.
- The first AI workflow is limited to a user-requested organization proposal;
  broader summaries, concepts, automatic processing, and autonomous actions are
  intentionally not implemented.
- Production readiness still requires the remaining authentication controls and
  a separate production environment; the canonical domain and HTTPS are active.

## 2026-08-16 static-asset correction

The first standalone start omitted `.next/static`, causing the live page to show
unstyled HTML and return `404` for its CSS and browser JavaScript. The live
release was corrected immediately and the build was changed to package these
assets automatically.

Post-fix verification required:

```text
compiled stylesheet                  200 text/css
compiled browser JavaScript          200 application/javascript
theme token #315cf5                  present in compiled CSS
```

## 2026-08-16 initial organization correction

The first registered user `Sumanth` is the owner of the `Epignos` organization.
The original generated display name `Sumanth's organization` was corrected in
MongoDB. Registration now collects person and organization names separately;
future public registrations remain isolated from the existing Epignos tenant.

## 2026-08-16 account-menu correction

The top-right avatar opens a user-information menu rather than logging out. The
deployed menu was verified with an authenticated temporary account to contain the
user name, email, organization, workspace, and a separate `Sign out` action. The
temporary account and tenant documents were removed after verification.

## 2026-08-16 workspace rename

Organization owners/admins can rename the active workspace by double-clicking
its visible name in the top bar and editing it in place. Enter or moving focus
away saves; Escape cancels. Enter and F2 provide the keyboard equivalent. No
separate visible rename action is shown. Deployment verification registered a
temporary user, confirmed that the inline-edit control was delivered, renamed
the workspace, reloaded the page, and found the persisted name in the top bar.
Earlier API verification also confirmed an unchanged slug, rejected an unrelated
workspace ID with `404`, and rejected an invalid name with `400`. The temporary
account and tenant were removed afterward.

## 2026-08-16 note row actions

Note rows expose a three-dot menu for Rename and Delete, and also support
double-click inline rename. Delete archives the note so its stored content is
recoverable while removing it from the active workspace. Live verification
registered an isolated temporary user, created a note, renamed it at revision 1,
deleted it at revision 2, confirmed it disappeared after workspace reload, and
confirmed MongoDB retained it with `status: archived` and the renamed title. The
temporary account and tenant were removed afterward.

## 2026-08-16 book creation

`Quick Capture` is the workspace's permanent default book. The Library plus
control creates a named book inline; selecting it filters the note list, and new notes
are stored in that selected book. Live verification created a `Research` book,
created and renamed a note inside it, reloaded the workspace, and confirmed the
book-note relationship directly in MongoDB. A user from a separate temporary
organization received `404` when attempting to create a note in that book. Both
temporary tenants were removed afterward.

## 2026-08-16 autosave feedback

The editor still autosaves after roughly 900 milliseconds, but no longer
represents the saved state as a disabled Save button. The footer and top bar show
`Saved automatically` after persistence, `Save now` while changes are pending,
and `Retry save` after a failed attempt. The existing Sumanth note was verified
in MongoDB at revision 6 with a recent timestamp and non-empty stored content;
the content itself was not printed during the check.

## 2026-08-16 sidebar refinement

The Books heading is now `Library`, and the system book is displayed as
`Quick Capture` without a secondary badge. Its internal `systemKey: "unsorted"`
remains stable. The left navigation uses solid, restrained blue-gray surfaces,
a cobalt selection rail, and quiet hover states. It intentionally contains no
gradients or high-saturation fills.

## 2026-08-16 Library and Quick Capture naming

The sidebar section is `Library` and the permanent system book is displayed as
`Quick Capture`. The database migration matched one existing system book by
`systemKey: "unsorted"`, updated its visible name and normalized name, and left
all three linked note relationships unchanged. The stable system key, book ID,
positions, and note content were not changed.

## 2026-08-16 AI organize panel

The note footer exposes `Organize` when the current note has saved text. It opens
an in-editor panel that shows a strict structured-output proposal and keeps the
original unchanged until `Apply organization` is selected. The initial model was
`openai/gpt-oss-20b`; a direct server probe returned valid schema-constrained JSON
without printing generated content.

Live workflow verification used a temporary isolated tenant and confirmed:

```text
saved source revision                 2
organization proposal                 200
URL, name, timestamps preserved       yes
same-revision proposal reused         yes
original unchanged before apply       yes
cross-organization request            404
apply organization                    200, revision 3
proposal status after apply           accepted
before-ai-apply revision snapshot      present
accepted proposal linked on note       yes
```

All temporary users, tenant data, proposals, and revision snapshots were removed
after verification.

## 2026-08-16 plain-text-first notes

Ordinary note editing no longer asks users to understand Markdown. The toolbar
is `Edit`, `• List`, and `Read`; the list action inserts a normal Unicode bullet.
Export downloads `.txt`. AI organization prompt version
`organize-v2-plain-text` produces section labels, spacing, and Unicode bullets
while explicitly forbidding Markdown markers. Prompt version participates in
proposal caching so an older Markdown-oriented proposal is never reused. The API
also normalizes common Markdown markers if a model returns them anyway.

Live verification used an isolated temporary tenant and confirmed:

```text
plain-text note saved                 revision 2
AI proposal                           no Markdown markers
name, URL, and all timestamps         preserved
applied organized layout              revision 3
proposal status                       accepted
prompt version                         organize-v2-plain-text
before-ai-apply revision snapshot      present
accepted proposal linked on note       yes
public HTTPS health check              database reachable
```

The temporary user, session, organization, workspace, book, note, proposal, and
revision snapshot were removed after verification.

## 2026-08-16 summary-first organization and GPT-OSS 120B

The active model is `openai/gpt-oss-120b` with low reasoning effort and a
60-second bounded request timeout. The previous environment file is retained at
`/home/epignos/.config/epinote/app.env.before-gpt-oss-120b-20260816`; both files
have mode `0600`.

Prompt version `organize-v3-summary` returns a title, summary, and complete body.
The server changes a title only when it is `Untitled` or `Untitled note`, prepends
one `Summary` section to the accepted note, and stores the summary in
`approvedAi.summary`. User-written titles are preserved regardless of model
output. The exact approved summary is removed from subsequent model input to
avoid compounding generated text.

Live verification used two notes in an isolated temporary tenant and confirmed:

```text
untitled title inferred                yes
user-written title preserved           yes
summary first and present once         yes
names, URL, and timestamps preserved   yes
both accepted notes                    revision 3
accepted proposals                     2
proposal model                          openai/gpt-oss-120b
prompt version                          organize-v3-summary
approved summaries stored              2
before-ai-apply snapshots               2
accepted proposals linked               2
public HTTPS health                     database reachable
```

The temporary tenant and all associated data were removed after verification.

## 2026-08-16 book sidebar polish

Every book is a bordered horizontal row with selected-state emphasis and an
authoritative active-note count. The new-book form can be dismissed through its
visible cancel button, the Library toggle, Escape, focus leaving the form, or a
book selection.

Live verification created a book and note in an isolated tenant, confirmed the
new-book API returned count zero, confirmed the rendered workspace showed count
one after note creation, and confirmed the deployed client and stylesheet
contained the cancel interaction and row styles. The public HTTPS health check
reported the database reachable. The temporary tenant was removed afterward.

## 2026-08-16 book rename

User-created books can be renamed inline by double-clicking or pressing F2 while
the row is focused. The server scopes book lookup to the signed-in organization,
validates names, and protects the Quick Capture system book.

Live verification confirmed a rename persisted in the rendered workspace,
invalid input returned `400`, another organization received `404`, and Quick
Capture returned `403`. The deployed client contained the inline rename control,
the public HTTPS health check reported the database reachable, and both isolated
test tenants were removed afterward.

## 2026-08-16 note movement and empty-book deletion

Notes can be moved between books by dragging a note card onto a book or by using
the note menu's `Move to` selector. User-created books expose Rename and Delete
actions; deletion is permitted only when the book has no active notes. Quick
Capture remains permanent.

Live verification used two isolated tenants and confirmed:

```text
note save                              200, revision 1 -> 2
move to another book                   200, revision 2 -> 3
stale-revision move                    409
other-tenant destination               404
other-tenant note                      404
delete non-empty book                  409
delete empty user-created books        200
delete Quick Capture                   403
second move                            200, revision 3 -> 4
workspace and compiled UI assets       200
```

MongoDB inspection confirmed the moved note retained its exact title and plain
text, remained active, kept its AI metadata, and referenced the destination
book at revision 4. All temporary users, sessions, organizations, workspaces,
books, and notes were removed afterward; the Epignos tenant was not modified.
