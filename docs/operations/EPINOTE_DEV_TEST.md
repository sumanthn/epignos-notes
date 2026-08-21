# EpiNote Development/Test Deployment

Status: deployed and verified
Last updated: 2026-08-21

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
/opt/epinote/releases/20260821-private-notes-zdr-v2
/opt/epinote/current -> /opt/epinote/releases/20260821-private-notes-zdr-v2
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
mode, verification mode, HMAC secret, `OPENROUTER_API_KEY`,
`OPENROUTER_MODEL`, `OPENROUTER_FAST_MODEL`, and
`OPENROUTER_LARGE_NOTE_MODEL`. Never print or
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
- Twenty unit tests passed.
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

The standard-note model is `openai/gpt-oss-120b` with low reasoning effort. The
previous environment file is retained at
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

## 2026-08-16 Library tree navigation

The selected book now expands in the Library and renders its notes as indented
children. A compact `New note` control is the final child in that branch. Other
books remain collapsed with note counts visible, while workspace search uses a
separate cross-book result list.

Live verification created and saved a note in an isolated tenant, confirmed the
rendered order `Quick Capture -> Nested tree note -> New note`, and confirmed the
deployed stylesheet contained the tree rail and nested creation control. The
workspace and public health endpoint returned `200`. The temporary tenant and
all associated data were removed afterward.

## 2026-08-16 contextual icons and menu dismissal

The Library tree now distinguishes Quick Capture, regular books, and notes with
consistent line icons. Book and note popovers show the entity type and name and
use labeled icons for Rename, Move, and Delete. Menus close on an outside click,
Escape, trigger toggle, or opening another menu.

Live verification confirmed the authenticated workspace rendered the icon set,
the deployed client contained the outside-click dismissal handler and contextual
book menu, and the stylesheet contained the contextual action layout. Public
health and the workspace returned `200`. The isolated test tenant and all of its
data were removed afterward.

## 2026-08-16 large-note organization

Saving notes already supports up to 1,000,000 characters. The former AI route
rejected notes over 30,000 characters even though their content had saved
correctly. Organization now measures the complete UTF-8 request. Standard
requests try `openai/gpt-oss-120b`; requests from 30,000 through 130,000 bytes
use `google/gemini-2.5-flash`; still larger supported requests use
`deepseek/deepseek-v4-pro`. Failed standard and fast attempts move to the next
configured tier.

Standard and large requests have bounded 150-second and 300-second application
timeouts. nginx permits 330 seconds for the upstream response. An output-limit
or timeout response leaves the canonical note unchanged and surfaces a useful
error; successful output is still only a proposal until the user approves it.

Live verification used an isolated tenant and confirmed:

```text
saved source note                     37,800 characters, revision 2
organization proposal                 200
proposal model                        deepseek/deepseek-v4-pro
proposal status                       proposed
proposal source revision              2
proposal source hash                  matched saved note
original note before approval         unchanged
approved proposal on original         none
local and public health               200
```

The isolated user, session, organization, workspace, book, note, and proposal
were removed after verification. Existing Epignos tenant data was not modified.

## 2026-08-16 background book organization and notification bell

Note and book organization now create durable MongoDB jobs and return HTTP `202`
without keeping the editor request open. The top-right bell polls the latest job
per note and displays queued, processing, ready, applied, or failed status. Jobs
run one at a time per workspace, survive page closure, and are retried only by an
explicit user request or recovery poll. Book organization isolates failures and
continues with the remaining notes.

The real `Epignos / Ideologies` book was used for verification. Its five notes
contained 1,511; 7,071; 34,660; 41,465; and 64,007 characters. The first pass
exposed one malformed GPT-OSS response, one DeepSeek timeout, and three proposals
that summarized away too much source material. No proposal was applied.

Prompt version `organize-v4-source-preserving` now requires source-preserving
organization. The server rejects a proposal unless its body retains at least 60
percent of source character volume and every detected URL and timestamp. Three
unsafe proposals were marked rejected and retried; valid earlier proposals were
reused.

Final live verification:

```text
book enqueue                           202, 5 notes, 0 skipped
latest bell notifications              5 completed
FASCISM coverage                       0.98, Gemini 3.6 Flash
Marxism coverage                       1.01, Gemini 3.6 Flash
SOCIALISM coverage                      0.69, GPT-OSS 120B
Israel Creation coverage               1.00, DeepSeek V4 Pro fallback
Nationalism coverage                    1.02, GPT-OSS 120B
missing detected URLs/timestamps       0 / 0 across all five
source revisions and hashes            unchanged across all five
automatically applied proposals         0
rejected unsafe proposals               3
temporary verification sessions         removed
local and public health                 200, database reachable
```

## 2026-08-16 semantic summary colors

Summary presentation now uses a flat, muted, type-stable color system to aid
visual recall. The production stylesheet was checked for overview, concept,
person, timeline, comparison, argument, event, book overview, and note-summary
card styles. No AI results or canonical notes were regenerated for this visual
release.

```text
semantic card palettes                  7 present
book overview card                      present
approved/suggested note summary cards   present
gradients                               none
local and public health                 200, database reachable
```

## 2026-08-16 sourced book summary cards

Book-level summary cards now run as durable `summarize-book-cards` jobs. Note
organization and whole-book organization schedule the deck after pending note
jobs finish; users can also open or refresh cards directly. DeepSeek generates
two through eight cards with no more than four points per card. The server
requires every point to cite valid note IDs from the book and saves immutable
decks keyed to the complete source snapshot.

The real `Epignos / Ideologies` book was used for the first production deck.
No note content was printed during verification and no proposal was applied.

```text
card enqueue                            202, durable background job
model                                   deepseek/deepseek-v4-pro
generated cards                         8
maximum points on one card              4
source notes                            5
source notes cited                      5
invalid source citations                0
source revisions and hashes changed     0
latest card notification                completed
cached card retrieval                   200, stale=false
deployed client summary-card control    present
temporary verification sessions         removed
local and public health                 200, database reachable
quality gates                           typecheck, lint, build, 24 tests
```

## 2026-08-16 note summary popover

The note toolbar now uses a single `Summary` control. It opens a compact popover
with only that note's current approved or source-matched proposed summary; book
Summary Cards remain in the Library tree.

```text
Israel Creation summary endpoint       200
summary source                          approved
single summary                          493 characters
note revision and content hash changed  0
deployed note-summary client            present
temporary verification session          removed
local and public health                 200, database reachable
```

## 2026-08-16 grounded wiki-style note summaries

The note summary popover now adds stable, muted colors for authors, named source
works, people, topics, places, and dates. Actual external links are extracted
and validated deterministically from the saved note and shown separately. The
profile is immutable, cached against the exact note and summary revision, and
cannot change canonical note content.

The real `Israel Creation` note was profiled through the authenticated public
endpoint. Its saved source no longer contains an explicit author or URL, so the
grounded empty author/link groups were intentionally omitted.

```text
profile generation and cached retrieval 200 / 200
model                                   openai/gpt-oss-120b
named sources                           2
people / topics                         4 / 5
places / dates                          4 / 3
all displayed labels in saved evidence yes
external links outside saved note       0
note revision and content hash changed  0
temporary verification sessions         removed
deployed semantic CSS selectors         present
local and public health                 200, database reachable
quality gates                           typecheck, lint, build, 27 tests
```

## 2026-08-18 EpiNote Beta identity

The public dev-test deployment is now explicitly labeled `EpiNote Beta` across
landing, authentication, workspace, preview, and browser-title surfaces. The
wordmark uses a small flat cobalt-outline superscript marker within the existing
theme.

```text
commit                                  e8b8dbc
release                                 /opt/epinote/releases/20260818-beta-label-e8b8dbc
previous release                        /opt/epinote/releases/20260816-summary-wiki-grounded-v13
service                                 active
local and public health                 200, database reachable
landing beta markers                    2
landing title                           EpiNote Beta — Notes that become knowledge
login title                             Sign in · EpiNote Beta
compiled beta stylesheet                200, text/css
HTTP redirect                           308 to canonical HTTPS domain
quality gates                           40 tests, typecheck, lint, production build
```

The in-app visual browser was unavailable during verification. Rendered HTML,
compiled CSS, responsive source rules, and production assets were verified; a
captured desktop/mobile screenshot remains optional visual QA rather than a
deployment blocker for this small identity marker.

## 2026-08-19 simple-first rich editor

The Note textarea was replaced with a validated structured editor while keeping
plain writing and autosave as the default workflow. Markdown shortcuts remain
off until a user enables them. Formatting includes headings, a document font,
bold, italic, underline, restrained highlights, links, lists, checklists, code
blocks, and editable tables. Text and Markdown exports are both available.

An isolated public account exercised the real HTTPS API and was removed with its
session, organization, workspace, Book, and archived Note after verification.
No existing user content was changed.

```text
release candidate                        20260819-rich-editor-v2
new Note / rich save                     201 / 200
rich JSON persisted after reload         yes
heading, marks, checklist, code, table   present
unsupported javascript link              400
stale revision update                     409
test Note archive                         200
temporary tenant data removed             yes
local and public health                   200, database reachable
compiled CSS / JavaScript assets          200 / 200
HTTP redirect                             308 to canonical HTTPS domain
quality gates                             48 tests, typecheck, lint, production build
```

The in-app browser was unavailable during this release verification. The live
authenticated server-rendered workspace, persistence contract, compiled assets,
and responsive source rules were verified; interactive visual QA remains the one
explicit follow-up risk.

## 2026-08-20 intuitive code blocks

The rich editor now treats fenced code as an explicit code-entry affordance,
independent of the optional general Markdown preference. Opening and closing
fences, contextual language selection, a visible Done action, and the
Ctrl/Command+Enter exit shortcut are covered by the production build and
structured-content tests.

```text
release                                  /opt/epinote/releases/20260820-code-blocks-v1
previous release                         /opt/epinote/releases/20260819-rich-editor-v2
service / nginx / MongoDB                active / active / active
local and public health                  200, database reachable
HTTP redirect                            308 to canonical HTTPS domain
release notes and compiled controls      present
compiled JavaScript / CSS assets         200 / 200
known npm vulnerabilities                0
quality gates                            49 tests, typecheck, lint, production build
```

No data migration or package addition was required. The previous versioned
release remains available for immediate rollback.

## 2026-08-20 UI dismissal and Library collapse

Temporary workspace surfaces now share predictable outside-click/tap and Escape
dismissal behavior. Library expansion is independent from the active Note, so a
Book can be collapsed without changing the editor or autosave context.

```text
release                                  /opt/epinote/releases/20260820-ui-dismiss-v2
previous release                         /opt/epinote/releases/20260820-code-blocks-v1
service / nginx / MongoDB                active / active / active
local and public health                  200, database reachable
HTTP redirect                            308 to canonical HTTPS domain
release notes and dismissal bundle       present
compiled JavaScript / CSS assets         200 / 200
motion / reduced-motion rules            present / present
known npm vulnerabilities                0
quality gates                            49 tests, typecheck, lint, production build
```

The configured in-app browser was unavailable, so visual pointer-path testing
could not be automated in this session. Source interaction paths, the production
bundle, responsive styles, service logs, and public assets were verified. The
previous release remains available for immediate rollback.

## 2026-08-20 grounded Book Concepts

The first Book Concepts slice adds an evidence-first Concepts collection to each
Book. Generation runs through the existing durable background-job and
notification flow. The stored map is immutable and keyed to the exact source
Note revisions/content hashes; editing a source Note leaves the previous map
readable and marks it stale.

An isolated temporary public account exercised the real HTTPS workflow with one
Book and two saved Notes. The DeepSeek V4 Pro background job completed, every
returned concept and relationship citation was constrained to those two Notes,
and editing one Note changed the API's map state to stale. The temporary user,
sessions, tenant, Notes, job, map, and one map that completed during an earlier
aborted test cleanup were removed afterward. Existing user data was not changed.

```text
release                                  /opt/epinote/releases/20260820-book-concepts-v1
previous release                         /opt/epinote/releases/20260820-ui-dismiss-v2
service / nginx / MongoDB                active / active / active
local and public health                  200, database reachable
unauthenticated concepts request         401
background model                         deepseek/deepseek-v4-pro
generated concepts / relationships       9 / 13
source Notes / invalid citations         2 / 0
map after source Note edit               present, stale = true
temporary users / orphan maps / jobs     0 / 0 / 0
compiled JavaScript / CSS assets         200 / 200
known npm vulnerabilities                0
quality gates                            54 tests, typecheck, lint, production build
```

The in-app browser was unavailable, so the signed-in pointer-path and visual
layout could not be automated in this session. The production API workflow,
authorization boundary, model output validation, persistence, staleness,
compiled UI assets, services, and public release notes were verified. The prior
versioned release remains available for immediate rollback.

## 2026-08-21 signup safety and legal acceptance

Registration now places a concise sensitive-information warning immediately
before an unchecked Terms/Privacy acknowledgement. Public `/terms` and
`/privacy` pages provide the full plain-language documents. The API rejects
missing acceptance and stores its own current document versions plus server
timestamps on each newly created user.

An isolated temporary registration exercised the public HTTPS endpoint twice:
the first request omitted acceptance and created no account; the second supplied
explicit acceptance and succeeded. MongoDB contained both `2026-08-21` versions
and valid server timestamps. The temporary user, session, organization,
workspace, and system Book were then removed. Existing user data was unchanged.

```text
release                                  /opt/epinote/releases/20260821-signup-legal-v2
previous release                         /opt/epinote/releases/20260820-book-concepts-v1
service / nginx / MongoDB                active / active / active
local and public health                  200, database reachable
register / terms / privacy               200 / 200 / 200
landing and login legal links            present
missing acceptance                       400, no account created
explicit acceptance                      201
stored Terms / Privacy versions          2026-08-21 / 2026-08-21
stored acceptance timestamps             valid server dates
temporary users remaining                0
known npm vulnerabilities                0
quality gates                            54 tests, typecheck, lint, production build
```

No connected in-app browser was available after the documented connection
retry, so automated pointer/screenshot verification was not possible. Rendered
HTML, compiled styling, public links, server enforcement, persistence, cleanup,
services, and HTTPS behavior were verified. The previous release remains
available for immediate rollback.

## 2026-08-21 encrypted off-host backup checkpoint

The versioned backup job creates authenticated MongoDB archives, validates that
the application database is present, packages only approved recovery
configuration, encrypts everything before upload, and removes its plaintext
working directory. The matching private recovery key and passphrase remain on
the Mac; only the public key was installed on Contabo.

The first test archive exposed an incorrect admin-only MongoDB dump and was
deleted. After correcting the backup connection, the exact encrypted GCS object
was downloaded, checksum-verified, decrypted on the Mac, and restored into an
isolated server database. Every production collection count and all indexes
matched. The isolated database and plaintext restore material were removed.

```text
bucket / prefix                          gs://databay-personal/epinote/dev-test
verified object                         epinote-20260821T135146Z.tar.gz.gpg
encrypted size                          527251 bytes
encrypted sha256                        62ac8b8820fa8f56090a04b6887e21df1e477fc4cbeda4bce9be48b2e7d93c29
restore collections / documents         14 / 248
restore failures / count mismatches     0 / 0
Notes / users restored                  42 / 5
service / nginx / MongoDB               active / active / active
backup timer                            enabled and active, every six hours
server GCP uploader credential          root-only; application access denied
```

The supplied GCP key was not suitable for unattended use because it could read,
list, and delete objects and update the bucket. After the operator explicitly
accepted temporary use of that key, it was installed as `root:root` mode `0600`,
a second encrypted object was uploaded and metadata-verified, and the timer was
enabled. The EpiNote application user cannot read the credential. Replacing it
with a dedicated bucket-level `Storage Object Creator` identity remains a
hardening task. See `EPINOTE_BACKUP_RUNBOOK.md` for recovery steps and remaining
operational work.

## 2026-08-21 existing-user legal review and transactional email

Existing active accounts now review the current Terms and Privacy Notice inside
their existing authenticated session; no re-registration or Note migration is
required. A missing version/date redirects page navigation to `/legal-review`
and rejects ordinary APIs. An unchecked confirmation cannot be submitted.
Successful acceptance stores both server-selected versions and dates plus one
idempotent `legalAcceptances` audit record.

A temporary public account was registered, converted to the legacy missing-field
shape, and exercised through HTTPS. The protected AI-jobs API rejected the
pending account, false acceptance was rejected, explicit acceptance restored
API access, and repeating acceptance kept one audit record. The temporary user,
session, tenant hierarchy, and acceptance record were removed. Existing users
and their Notes were unchanged.

```text
release                                  /opt/epinote/releases/20260821-legal-consent-email-v1
previous release                         /opt/epinote/releases/20260821-signup-legal-v2
pre-deployment encrypted backup          epinote-20260821T142457Z.tar.gz.gpg
service / nginx / MongoDB                active / active / active
public health / compiled asset           200 / 200
Terms / Privacy / release notes          200 / 200 / 200
pending protected API                    401
false / explicit acceptance              400 / 200
protected API after acceptance           200
acceptance audit records                 1 after repeated submission
temporary test identities remaining      0
quality gates                            58 tests, typecheck, lint, production build
```

The send-only Resend key is stored only in the mode-`0600` application
environment. DKIM, SPF, and MX records for `notify.epignos.dev` are publicly
visible, but Resend still returned `403 domain not verified` during controlled
delivery tests. No legal notices were sent or marked as sent. Bulk delivery must
wait for the Resend dashboard to mark the domain verified; provider failure is
visible in the superadmin action and stops the batch.

Later on 2026-08-21, Resend reported `notify.epignos.dev` verified. A controlled
message was delivered first, followed by the idempotent legal-notice batch for
all five active users. Successful provider identifiers were recorded; no Note
content was included in any email.

## 2026-08-21 enforceable Note privacy promise and zero-retention AI

The landing page, signup notice, existing-user legal review, Terms, and Privacy
Notice now use the same bounded promise: people do not routinely read Notes;
limited access is reserved for user-authorized support, security response, or
legal obligation; content is not sold, used for advertising, or used by EpiNote
to train models. The notice also states that the live service is not end-to-end
encrypted and must not be treated as a secrets vault.

All four OpenRouter call paths share a provider policy requiring both
`data_collection: "deny"` and `zdr: true`. Live synthetic checks found compatible
zero-retention routes for `openai/gpt-oss-120b` (AkashML),
`deepseek/deepseek-v4-pro` (Ionstream), and `google/gemini-2.5-flash` (Google).
`google/gemini-3.6-flash` correctly failed with no compatible zero-retention
route and was removed from the fast-model configuration. AI failure leaves Note
content unchanged.

The legal documents use revision `2026-08-21.2`; all five active users are
pending explicit review of that exact text. A temporary public registration
stored both revised versions and server dates, then its session, hierarchy, and
user were removed with zero temporary records remaining.

```text
release                                  /opt/epinote/releases/20260821-private-notes-zdr-v2
previous release                         /opt/epinote/releases/20260821-private-notes-zdr-v1
pre-deployment encrypted backup          epinote-20260821T154102Z.tar.gz.gpg
encrypted backup size / sha256            527696 / 91f4f99ffd12cc3e6096a42e22a16b1fc56b4e6536b318361314998c21ae2e60
service / nginx / MongoDB                active / active / active
public health / database                 200 / reachable
Terms / Privacy / registration           200 / 200 / 200
release notes / compiled CSS             200 / 200
stored Terms / Privacy versions          2026-08-21.2 / 2026-08-21.2
active users pending revised review      5
temporary test identities remaining      0
quality gates                            59 tests, typecheck, lint, production build
```

No in-app browser was connected for screenshot automation. Static and dynamic
production builds, public rendered copy, compiled client assurance text,
versioned registration persistence, cleanup, HTTPS endpoints, and services were
verified. The previous releases remain available for rollback.
