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
/opt/epinote/releases/20260816-visible-workspace-rename
/opt/epinote/current -> /opt/epinote/releases/20260816-visible-workspace-rename
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
mode, verification mode, and HMAC secret. Never print or copy its values into
Git, tickets, or chat.

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
- `Review` is intentionally disabled until a narrow, evidence-preserving AI
  workflow exists.
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

Organization owners/admins can rename the active workspace by selecting its
visible name in the top bar or using the account menu. Both controls open the
same focused dialog. Deployment verification registered a temporary user,
confirmed that the top-bar rename control and dialog code were delivered,
renamed the workspace, reloaded the page, and found the persisted name in the
top bar. Earlier API verification also confirmed an unchanged slug, rejected an
unrelated workspace ID with `404`, and rejected an invalid name with `400`. The
temporary account and tenant were removed afterward.
