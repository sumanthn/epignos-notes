# EpiNote Authentication Design

Status: proposed authentication contract for implementation review
Storage: MongoDB Community 8.0
Last updated: 2026-08-16

## 1. Goal and scope

EpiNote needs a simple authentication system that real users understand and the
team can operate safely.

The first release supports registration, email verification, login, logout,
forgot/reset password, change password, logout from other devices, organization
invitation acceptance, and administrator account disable.

It does not begin with OAuth, social login, JWT access/refresh tokens, SSO, MFA,
passkeys, or an external authentication platform. Add those only for a real
customer or risk requirement.

### Authentication UI

All authentication pages use the approved EpiNote light theme:

- Plain text `EpiNote`; no logo mark.
- One narrow, centered form with a clear page title.
- White surface on the warm paper canvas.
- Email and password fields with persistent labels.
- One cobalt primary action.
- Short secondary links such as `Forgot password?` and `Create account`.
- Inline validation near the relevant field plus one safe form-level error.
- Visible keyboard focus, correct autocomplete attributes, and screen-reader
  labels.
- Password visibility toggle that does not alter the stored value.
- No gradient, dark hero, illustration, testimonial, social-login row, or side
  panel.

Pages:

```text
/register
/verify-email
/login
/forgot-password
/reset-password
/settings/security
```

The reset and verification pages never show whether another email/account exists.

## 2. Authentication versus authorization

Authentication identifies a user through `users` and `sessions`. Authorization
uses `memberships` and tenant-scoped resource queries to decide what that user can
do.

A valid session grants no organization access by itself. Every protected request
resolves an active membership and role on the server.

## 3. Architecture

```text
Browser
  └── opaque secure session cookie
        └── EpiNote server
              ├── hash token
              ├── load active MongoDB session
              ├── load active user
              └── resolve organization membership
```

Locked choices:

- Opaque random sessions, not JWTs.
- Raw session token only in an HTTP-only cookie.
- MongoDB stores only the SHA-256 token hash.
- Passwords use Argon2id.
- Reset, verification, and invitation tokens are random, one-use, and hash-only.
- Email links use configured `APP_BASE_URL`, never the request `Host` header.
- Authentication endpoints are same-origin.

## 4. User states

```text
pending_verification
active
disabled
```

- Pending users cannot create ordinary sessions.
- Active users may authenticate; memberships determine access.
- Disabled users cannot log in and existing sessions fail.
- Disabling preserves note attribution and audit history.
- User hard deletion is not part of the MVP.

## 5. Password policy and storage

```text
minimum: 12 Unicode characters
maximum: 128 Unicode characters
spaces/paste/password managers: allowed
composition rules: none
forced periodic rotation: none
```

Reject extremely common passwords and passwords equal to the normalized email or
display name. Encourage long passphrases instead of arbitrary uppercase, number,
and symbol rules.

Storage rules:

- Hash with Argon2id using a maintained, self-describing implementation.
- Benchmark the deployment work factor above the accepted security floor.
- Use the hash's built-in unique salt.
- Never encrypt or store reversible passwords.
- Rehash after successful login when old parameters are below policy.
- Passwords never enter logs, analytics, audit metadata, or errors.

## 6. Registration and email verification

Registration fields:

```text
display name
organization name
email
password
terms acceptance when required
```

Organization creation happens after verification during onboarding. This avoids
abandoned organizations/workspaces for unverified addresses.

Registration flow:

1. Validate/normalize email and apply throttling.
2. Validate password.
3. Create a `pending_verification` user if absent.
4. Reuse an existing pending identity and replace unused verification tokens.
5. For an active existing user, return the same external response.
6. Generate 32 random bytes, base64url encode, then SHA-256 hash.
7. Store only the hash in `authTokens`.
8. Queue/send email using the canonical URL.
9. Return `Check your email for the next step`.

Verification token:

```text
purpose: verify-email
expiry: 24 hours
single use: yes
maximum active per user: 1
```

Verification hashes the token, requires active/unexpired state, activates the
pending user, sets `emailVerifiedAt`, consumes the token, and revokes sibling
tokens. It does not automatically log in; ordinary login creates sessions.

Resend returns the same result for known/unknown emails, enforces cooldown/hourly
limits, and replaces the active token. Unverified users with no invitation/data
may be cleaned after an initial seven-day retention.

## 7. Login

Form: email and password. There is no `Remember me` initially; one policy keeps
behavior predictable.

Flow:

1. Validate same-origin request metadata.
2. Normalize email and apply email/network throttling.
3. Load user; for absent users verify a fixed dummy Argon2id hash to reduce timing
   differences.
4. Verify password.
5. Return the same message/status for unknown and wrong credentials.
6. If password is correct but email pending, require verification and offer
   resend.
7. Reject disabled users.
8. Rehash outdated hashes after successful verification.
9. Generate a random 32-byte session token and store its SHA-256 hash.
10. Set the cookie, update `lastLoginAt`, and redirect to the last authorized
    workspace or onboarding.

Generic error:

```text
Invalid email or password.
```

## 8. Session design

Production cookie:

```text
name: __Host-epinote_session
Secure: true
HttpOnly: true
SameSite: Lax
Path: /
Domain: omitted
```

Never put auth tokens in browser storage or URLs. HTTPS is required outside
localhost. Staging must not silently weaken `Secure`. Localhost uses a separate
development cookie name. Session-changing responses use `Cache-Control: no-store`.

Lifetime:

```text
idle expiry: 7 days
absolute expiry: 30 days
maximum active sessions: 10 per user
```

`expiresAt` is the earlier of idle and absolute expiry. Refresh idle expiry after
meaningful activity at most hourly. Absolute expiry never moves. Revoke the oldest
session if a successful login exceeds the limit.

Protected request validation:

1. Read/hash cookie token.
2. Require active/unexpired session and active user.
3. Require session/user `authVersion` match.
4. Resolve active organization membership and role.
5. Attach only user/session/organization IDs and role to request context.

Never attach password hash, token hash, or a full user document to ordinary
request context.

## 9. Logout and device sessions

Current logout:

1. Detect unsaved note drafts.
2. Require save/copy/explicit discard when drafts exist.
3. Revoke the server session.
4. Clear the cookie with identical name/path/security attributes.
5. Clear user-scoped cached data only after draft handling.

Do not blindly clear browser storage and destroy offline drafts.

Logout other devices revokes all other sessions while keeping current. Logout all
increments `users.authVersion`, immediately invalidating every session, then
clears the current cookie.

A security settings page shows approximate device/browser, created/last-active
time, current device, change password, and revoke controls. It does not display
precise historical IPs.

## 10. Forgot and reset password

Forgot flow:

1. Normalize email and apply throttling.
2. Return the same response for every account state.
3. If an active user exists, revoke older unused reset tokens.
4. Generate 32 random bytes, base64url encode, and hash.
5. Store only the hash with a 30-minute expiry.
6. Queue/send a link from `APP_BASE_URL`.
7. Record a safe audit event without the token.

Response:

```text
If an account exists for that email, we sent password reset instructions.
```

Reset page:

- Simple light EpiNote page.
- No third-party scripts or embeds.
- `Referrer-Policy: no-referrer`.
- No mutation on GET.
- POST contains token, new password, and confirmation.

Reset token:

```text
purpose: password-reset
expiry: 30 minutes
single use: yes
maximum active per user: 1
```

Reset flow:

1. Hash token and load active/unexpired record.
2. Load active user and validate new password.
3. Store new Argon2id hash and `passwordChangedAt`.
4. Increment `authVersion` atomically with password update.
5. Consume/reset sibling tokens and revoke stored sessions.
6. Send password-changed notification.
7. Redirect to login.

Do not auto-login after reset. Do not modify/lock an account merely because a
reset was requested. Invalid, used, and expired links use one safe error.

## 11. Change password

Form: current password, new password, confirmation.

Require a fresh session, verify current password, enforce policy, reject equality
with current password, update hash/time, revoke other sessions, keep current
session, and send a notification. Throttle current-password failures.

## 12. Organization invitations

### `organizationInvitations`

```text
_id
schemaVersion
organizationId
email
emailNormalized
role: admin | member
status: pending | accepted | revoked | expired
invitedBy
createdAt
expiresAt
acceptedAt
acceptedBy
```

Rules:

- Owner/admin can invite admin/member.
- One pending invitation per organization/email.
- Default expiry is seven days.
- Invitation token lives in `authTokens`.
- Revocation invalidates its token.

Existing user: open link, login, require email match, accept, and activate/create
membership.

New user: open valid link, set display name/password, treat mailbox possession as
verification, create active user/membership, consume token, then login normally.
Acceptance is idempotent under the unique membership index.

## 13. Authentication storage

`users` additions:

```text
status: pending_verification | active | disabled
emailVerifiedAt
passwordChangedAt
authVersion: integer starting at 1
```

`authVersion` invalidates all sessions after reset, logout-all, or disable without
waiting for session cleanup.

`sessions` additions:

```text
authVersion
absoluteExpiresAt
deviceLabel
```

### `authTokens`

```text
_id
schemaVersion
userId or null
invitationId or null
purpose: verify-email | password-reset | organization-invitation
tokenHash
status: active | consumed | revoked
createdAt
expiresAt
consumedAt
delivery.status: pending | sent | failed
delivery.attempts
delivery.nextAttemptAt
delivery.lastErrorCode
```

Indexes:

```text
unique { tokenHash: 1 }
TTL    { expiresAt: 1 } expireAfterSeconds: 0
       { userId: 1, purpose: 1, status: 1, createdAt: -1 }
       { delivery.status: 1, delivery.nextAttemptAt: 1 }
```

The application validates expiry; TTL is cleanup. A small MongoDB-backed worker
retries delivery, avoiding Redis or a separate queue.

### `authThrottle`

```text
_id: HMAC-derived key
action
subjectHash
count
windowStartedAt
blockedUntil
expiresAt
updatedAt
```

Use a server-secret HMAC over action plus normalized email/IP. Do not retain raw
passwords, tokens, or IPs.

Indexes:

```text
TTL { expiresAt: 1 } expireAfterSeconds: 0
    { action: 1, blockedUntil: 1 }
```

Atomic counter updates keep throttling consistent across app processes.

### `auditEvents`

Auth event types include registration, verification request/completion, login
success/failure, session revoke, reset request/completion, password change,
disable, and invitation acceptance.

Store safe actor/subject IDs, organization when relevant, outcome, HMAC-derived
network identifier, coarse user-agent class, bounded metadata, and time. Never
store passwords, raw tokens, cookies, database errors, or email bodies.

## 14. Throttling policy

Initial configurable limits:

```text
login:                 10 failures / 15 min per email+IP
login network ceiling: 50 failures / 15 min per IP
forgot password:        5 requests / hour per email
forgot network ceiling: 20 requests / hour per IP
verification resend:    5 requests / hour per email
registration:          10 requests / hour per IP
token verification:    20 failures / 15 min per IP
```

Do not permanently lock accounts; attackers could cause denial of service. Use
bounded exponential delay and generic `429`. CAPTCHA is added only after measured
abuse.

## 15. Email delivery

Required environment:

```text
APP_BASE_URL
EMAIL_FROM
provider API credential
```

- Build HTTPS links from configuration, never request headers.
- Templates are short and use text `EpiNote`, not a logo.
- Store provider message ID/safe status, not full payload.
- Provider failure does not reveal account existence.
- Retry a bounded number, then require a new request.

Templates: verify email, reset password, password changed, organization invite.
Provider choice remains open; reset is incomplete until real delivery is tested.

## 16. Browser and CSRF protection

- GET never changes server state.
- Unsafe requests require canonical same-origin `Origin`.
- Reject unexpected `Sec-Fetch-Site` where supported.
- Use framework CSRF protection or explicit token if origin/custom-header defense
  is unavailable.
- SameSite is defense in depth, not the only control.
- Do not broadly enable CORS.
- Reset/invitation pages load no third-party scripts.
- Auth pages/responses use `Cache-Control: no-store`.

## 17. Endpoints and safe errors

```text
POST   /api/auth/register
POST   /api/auth/verify-email
POST   /api/auth/resend-verification
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/logout-others
POST   /api/auth/logout-all
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/change-password
GET    /api/auth/session
GET    /api/auth/sessions
DELETE /api/auth/sessions/:sessionId
POST   /api/organization-invitations/:token/accept
```

Validate content type/body/fields. Never echo secrets or return hashes, throttle
keys, or provider errors. Invitation actions also verify role and email.

Safe public messages:

```text
Invalid email or password.
Check your email for the next step.
This link is invalid or has expired.
Your session has expired. Please sign in again.
Too many attempts. Please try again later.
```

## 18. Administrator boundaries

Organization admins may invite/revoke invitations, disable memberships, and view
membership status. They may not view/set passwords, view tokens, impersonate
users, or bypass email recovery.

Global account disable is an explicit operator procedure. Emergency first-owner
recovery is a documented one-time CLI action with an audit event, never a hidden
web backdoor.

## 19. Security transitions

| Event | Session result | Notification | Audit |
|---|---|---|---|
| Login | add one | no | yes |
| Logout | revoke current | no | yes |
| Logout others | revoke others | optional | yes |
| Password change | revoke others | yes | yes |
| Password reset | invalidate all | yes | yes |
| User disabled | invalidate all | policy | yes |
| Email verified | none | optional | yes |
| Invitation accepted | none until login | yes | yes |

## 20. Failure handling

MongoDB unavailable:

- Login/reset cannot proceed safely.
- Return temporary unavailable.
- Never create a client-only pseudo-session.
- Do not claim email was sent when token storage failed.

Email provider unavailable:

- Token remains pending for bounded retry.
- Public response remains generic.
- Alert after retry exhaustion.

Partial reset:

- Password and `authVersion` update atomically in the user document.
- Token/session cleanup reconciles afterward.
- Auth-version mismatch already invalidates old sessions.

Partial invitation:

- Unique membership plus idempotent acceptance avoids duplicates.
- Retry finds/repairs the intended state.

## 21. Logging and metrics

Log safe event type, outcome, request ID, duration, known user ID, HMAC-derived
email/IP key, and delivery state.

Never log password, confirmation, raw session/action token, cookie header, full
authorization header, database URI, provider key, or full reset URL.

Metrics:

```text
login success/failure/throttle
reset request/completion
verification delivery/completion
email latency/failure
active/revoked sessions
Argon2 verify latency
```

Alert on spikes, exhausted delivery retries, and session-storage failures.

## 22. Required tests

Registration/verification:

- New email creates pending user and hash-only token.
- Existing email returns equivalent external behavior.
- Expired/used token fails; verification activates exactly once.
- Resend invalidates the prior token and obeys cooldown.

Login/session:

- Valid credentials create secure cookie and hash-only Mongo session.
- Wrong/unknown users return equivalent behavior.
- Pending/disabled users cannot create sessions.
- Expired/revoked/auth-version-mismatched sessions fail.
- Cookie attributes are correct under HTTPS.
- Session limit, logout, and logout-all work.

Password recovery/change:

- Forgot does not enumerate accounts.
- Reset token is random, hash-only, one-use, and expiring.
- Invalid token never modifies user.
- Reset changes password and invalidates all sessions.
- Reset does not auto-login.
- Change requires current password and revokes other sessions.

Authorization/invitations:

- Valid session without membership cannot access organization data.
- Member cannot create admin invitations.
- Accepting email must match invitation.
- Acceptance is one-use, expiring, and idempotent.

Abuse/browser:

- Throttles update atomically.
- Cross-origin unsafe requests fail.
- GET never mutates.
- Auth responses are not cacheable.
- Auth tokens never enter browser storage.
- Logout handles unsaved drafts before clearing user data.

## 23. Implementation slices

1. **Password/session primitives:** hash/verify, token/hash, collections/indexes,
   cookie, login/session/logout.
2. **Registration/verification:** pending user, email token, provider delivery,
   verify/resend.
3. **Recovery/change:** forgot/reset, auth-version invalidation, notifications,
   logged-in password change.
4. **Security controls:** session list/revoke, Mongo throttles, audit/metrics.
5. **Invitations:** invitation storage, existing/new user acceptance, membership.

Each slice finishes with realistic browser and integration tests.

## 24. Locked decisions

- Email/password is first.
- Sessions are opaque and MongoDB-backed.
- Passwords use Argon2id.
- Raw tokens are never stored server-side.
- Production sessions use secure HTTP-only same-site cookies.
- Public flows avoid account enumeration.
- Reset tokens expire in 30 minutes; verification in 24 hours.
- Reset/disable/logout-all invalidate sessions through `authVersion`.
- Authentication and organization authorization stay separate.
- No OAuth, MFA, SSO, passkeys, or CAPTCHA initially.

## 25. Remaining implementation choices

1. Email provider and verified sender domain.
2. Production `APP_BASE_URL`.
3. Argon2id library and benchmarked work factor above the security floor.
4. Common-password checking strategy.
5. Unverified-user and audit-event retention periods.

These choices do not require changing the architecture.

## 26. References

- OWASP Password Storage:
  <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- OWASP Authentication:
  <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>
- OWASP Forgot Password:
  <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>
- OWASP Session Management:
  <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
- OWASP CSRF Prevention:
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>
