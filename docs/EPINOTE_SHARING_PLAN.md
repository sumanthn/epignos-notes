# EpiNote Sharing Plan

Status: agreed future product direction; no implementation started
Last updated: 2026-08-19

This document records how EpiNote should share Books, Notes, and Summary Cards
between users. It is deliberately a product and security plan, not an
implementation commitment.

## 1. Objective

Allow a user to share useful knowledge with another EpiNote user while keeping
the permission boundary understandable and preventing unrelated organization,
workspace, book, or note content from being exposed.

The first release should optimize for authenticated collaboration, explicit
permissions, immediate revocation, and a small number of predictable rules. It
should not begin with anonymous public links or a general-purpose permission
engine.

## 2. Two different kinds of access

EpiNote must distinguish these actions clearly.

### Invite to Organization

- Intended for trusted teammates.
- Uses the organization membership and role model.
- Under the current first-release contract, active organization members can
  access all active organization workspaces.
- The UI must describe this as broad team access, not as sharing one item.

### Share a specific Book or Note

- Intended for narrow collaboration with another authenticated EpiNote user.
- Does not make the recipient an organization member.
- Grants access only to the selected resource and the explicitly inherited
  children described below.
- The source organization continues to own the shared data.

An organization invitation must never be used as a shortcut for sharing a
single Book or Note.

## 3. Permission inheritance

```text
Share a Book
└── All current and future Notes in that Book
    ├── Note attachments
    ├── Book index and derived Book views
    └── Book Summary Cards

Share a Note
└── That Note only
    ├── Its attachments
    └── Its approved Note summary

Not included in a Note share
├── Parent Book contents
├── Sibling Notes
├── Book index
└── Book Summary Cards
```

A Book share is live. New Notes and regenerated Summary Cards become visible to
the recipient. The Share dialog must say this before access is granted. A user
who does not want that behavior should share an individual Note instead.

Direct Note access remains bound to the Note if its owner moves it to another
Book. Inherited Book access changes with the Book. The owner should receive a
clear warning before a move changes inherited access.

## 4. Initial permission roles

Keep the first implementation to `Viewer` and `Editor`. The creator remains the
owner, and an organization owner or administrator may perform an audited
administrative revocation for organization-owned content.

| Action | Owner | Editor | Viewer |
| --- | ---: | ---: | ---: |
| Read shared content | Yes | Yes | Yes |
| Add Notes to a shared Book | Yes | Yes | No |
| Edit Note titles and content | Yes | Yes | No |
| Use Note-level AI actions | Yes | Yes | No |
| Regenerate Book index or Summary Cards | Yes | No | No |
| Share or revoke access | Yes | No | No |
| Rename, move, archive, or delete the Book | Yes | No | No |

Editors cannot reshare content in the first release. Book-wide AI operations
remain owner-only because they consume resources and alter derived views across
the complete Book.

Viewer export is a product choice, not an effective confidentiality control: a
viewer can copy visible text manually. EpiNote must not imply that disabling an
export button prevents copying.

## 5. Summary Cards

Summary Cards are derived Book content and do not receive independent live
permissions in the first release.

- A user who can read the Book can read its Summary Cards.
- A Note-only recipient cannot read Book Summary Cards because they may combine
  information from several Notes.
- A source link in a card opens only when the recipient can access that source.
- Restricted sources reveal no title, excerpt, author, or other metadata.
- Regenerating cards updates the live shared view.

A possible later feature is `Share card snapshot`. It would create an immutable,
owner-reviewed copy that does not grant access to the Book. Unauthorized source
links and metadata would be omitted. This should be added only after a real user
workflow requires it.

## 6. User experience

Books and Notes receive a `Share` action in their existing contextual menus.
The Share dialog shows:

- people with access;
- whether access is direct or inherited;
- `Viewer` or `Editor` permission;
- who granted access;
- remove access; and
- a copied deep link that still requires login and authorization.

For a Book, the dialog states:

> Includes all current and future Notes, attachments, Book index, and Summary
> Cards in this Book.

For a Note, the dialog states:

> Shares only this Note and its attachments. Other Notes and Book Summary Cards
> remain private.

Recipients receive an in-app notification and find accepted resources in a
`Shared with me` Library section. Each row shows the owner or organization and a
quiet permission badge. A recipient may leave a shared resource.

## 7. Minimal data contract

Use one explicit resource-grant concept supporting exactly `book` and `note`:

```text
resourceGrants
├── sourceOrganizationId
├── sourceWorkspaceId
├── resourceType: book | note
├── resourceId
├── recipientUserId
├── role: viewer | editor
├── status: active | revoked
├── grantedByUserId
├── createdAt
├── updatedAt
└── revokedAt
```

There is at most one active grant per resource and recipient. Grants reference a
user ID, not a copied email address. Summary Cards do not get grant records.

Pending email invitations, when introduced, use a separate invitation record
with an intended recipient, role, expiry, status, and a one-use random token.
Only the token hash is stored.

This is not a generic ACL framework. Adding more resource types or roles requires
a real use case and an explicit design decision.

## 8. Authorization and security rules

- Deny access by default.
- Authenticate first, then authorize the requested action against the exact
  resource on every server request.
- Scope database reads by source organization, workspace, and permitted
  resource; possession of an ID or URL is never proof of access.
- Apply the same checks to reads, edits, search results, exports, attachments,
  notifications, Summary Cards, source links, and administrative actions.
- Return `404` for inaccessible resources when revealing existence would leak
  information.
- Recheck authorization when an asynchronous AI job begins, when it writes a
  result, and when a user applies that result. Permission at enqueue time alone
  is insufficient.
- Revoke server-side access immediately for subsequent requests. Do not serve
  shared content from a public cache.
- Validate note revisions and return a conflict instead of overwriting another
  editor's newer work. Preserve the local draft and offer reload/compare.
- Protect share, permission-change, and revoke requests against CSRF in addition
  to using secure, HTTP-only, SameSite session cookies.
- Rate-limit and audit recipient lookup, invitation creation, acceptance, role
  changes, and revocation.
- Audit identifiers and actions, not Note content, invitation tokens, or full
  recipient emails.
- Superadmin analytics do not imply permission to read shared content. Any future
  emergency content access must be separate, exceptional, and fully audited.

Revocation prevents future EpiNote access. It cannot retract text, files,
screenshots, or exports already copied by a recipient, and the UI must not claim
otherwise.

Security references:

- OWASP Authorization Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>
- OWASP Insecure Direct Object Reference Prevention Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html>
- OWASP Cross-Site Request Forgery Prevention Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>

## 9. Recipient discovery and invitations

The first release shares only with an existing authenticated EpiNote account.
The owner enters an exact account email; EpiNote does not expose a global user
directory or email autocomplete. Lookup is authenticated, rate-limited, and
audited. After resolution, the grant stores only the recipient user ID.

Email invitations come later, after email delivery and at-rest email privacy are
ready. Their minimum rules are:

- exact intended recipient;
- account and verified-email match required for acceptance;
- random, one-use invitation token;
- token hash stored instead of the token;
- seven-day expiry by default;
- revocable before acceptance; and
- no Note title, content, Summary Card, or attachment included in email.

Anonymous public links are explicitly out of scope for the initial release. If
real demand later justifies them, they require a separate threat model, short
expiry, revocation, high-entropy capability tokens stored as hashes, read-only
access, rate limits, and protection from indexing and third-party content leaks.

## 10. Important lifecycle behavior

- Archiving a shared Book or Note makes it inaccessible. Restoring it restores
  existing active grants unless the owner revoked them.
- Deleting or disabling a recipient account removes access without deleting the
  source organization's content or historical attribution.
- Leaving a share removes the recipient's grant only.
- Moving a Note out of a shared Book removes Book-inherited access to that Note.
- A direct Note grant continues until it is explicitly revoked.
- Linked concepts never expose restricted source metadata.
- Background notifications contain only the minimum information the recipient is
  authorized to see.

## 11. Delivery slices

Build and verify one vertical slice at a time:

1. Book sharing with an existing EpiNote user as `Viewer`.
2. Revocation, audit events, notifications, and `Shared with me`.
3. Book `Editor` access with realistic revision-conflict handling.
4. Direct Note sharing as `Viewer` and `Editor`.
5. Secure email invitations after email privacy and delivery are ready.
6. Owner-reviewed Summary Card snapshots only if users need them.
7. Anonymous links only after demonstrated demand and a separate security review.

## 12. Required tests

- An authenticated user without a grant cannot read a shared Book, Note, card,
  attachment, search result, export, or AI result by changing an ID.
- A Viewer cannot mutate content or run AI actions.
- An Editor cannot reshare, revoke, archive, move, or delete the Book.
- Revocation blocks the next request and queued/background work rechecks access.
- A direct Note recipient cannot infer sibling Notes, Book counts, index content,
  or Summary Cards.
- Card source links do not leak restricted metadata.
- Cross-organization identifiers return the safe not-found response.
- Moving and archiving resources produce the defined inheritance behavior.
- Concurrent edits preserve the newer revision and surface a useful conflict.
- Invitation tokens expire, cannot be reused, and require the intended verified
  email account.

## 13. Decisions to preserve when work resumes

- Organization invitations grant broad team access; direct shares grant narrow
  resource access.
- A Book share is live and includes future Notes and Summary Cards.
- A Note share remains isolated from its parent Book and sibling Notes.
- Editors cannot reshare in the first release.
- Summary Cards inherit Book access and are not independently shared live.
- Anonymous links are not part of the initial release.
