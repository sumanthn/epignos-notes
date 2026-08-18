# EpiNote superadmin operations

Status: implementation and dev-test runbook

## Purpose

The dedicated superadmin account provides read-only operational visibility at
`/admin`. It is not a customer organization administrator and does not receive
access to note contents.

The console reports:

- user totals, statuses, recent registrations, and active sessions;
- active organizations, workspaces, books, notes, and archived notes;
- recent note and AI-job activity;
- AI-job status totals;
- MongoDB data, allocated storage, index, and total footprint when the database
  role permits `dbStats`.

## Provisioning

Run this only on the application server with the deployed application
environment loaded. Set exactly one password source:

```bash
npm run admin:provision
```

Required environment variables:

```text
MONGODB_URI
MONGODB_DB
SUPERADMIN_EMAIL
SUPERADMIN_DISPLAY_NAME
SUPERADMIN_PASSWORD
```

Instead of `SUPERADMIN_PASSWORD`, set
`SUPERADMIN_GENERATE_PASSWORD_FILE` to an absolute, previously unused path. The
command generates a strong password and creates that file with mode `0600`; it
never prints the password. Provisioning is idempotent only for the same existing
superadmin email and refuses to promote a regular account.

Do not place credentials in Git, shell history, application logs, or this
document. After securely saving the generated password, delete the one-time
credential file.

## Access controls to verify

1. An unauthenticated request to `/admin` redirects to `/login`.
2. A regular authenticated user receives a not-found response from `/admin`.
3. The dedicated account signs in normally and is redirected to `/admin`.
4. Visiting `/workspace` as the dedicated account redirects back to `/admin` and
   does not create an organization, workspace, book, or note.
5. The page exposes aggregates and recent account metadata only; it never
   exposes note content, password hashes, session tokens, or management actions.
6. Database footprint failures are visible as unavailable and do not hide the
   remaining metrics.

## 2026-08-18 dev-test verification

Commit `1e5dfaa` was deployed as
`/opt/epinote/releases/20260818-superadmin-1e5dfaa`. Local verification passed
43 tests, ESLint, TypeScript, and the production build. Both the internal and
public HTTPS health endpoints reported a reachable database.

The dedicated `superadmin@epignos.dev` account was created with a generated
password stored outside the release tree at
`/home/epignos/.config/epinote/superadmin-login.txt`. The directory is mode
`0700` and the credential file is mode `0600`. The password was not printed or
committed.

Authenticated verification against `https://epinote.epignos.dev` confirmed:

```text
login                           200, redirectTo=/admin
admin dashboard                 200, expected dashboard sections present
workspace as superadmin         307 -> /admin
logout                          200
admin after logout              307 -> /login
```

MongoDB integrity checks found exactly one superadmin, zero memberships and
zero organizations created by that account, and the unique partial
`users_single_superadmin` index. Running the provisioning command again returned
`exists` without rotating the password or creating another account. The live
application database role successfully returned `dbStats`, so the deployed
storage panel reports actual database size values.

## 2026-08-18 feedback, Help, and release notes

The combined support release is deployed from commit `d0b7655` at
`/opt/epinote/releases/20260818-support-d0b7655`. It adds the workspace Help and
Feedback buttons, public `/release-notes`, tenant-scoped feedback submission,
and superadmin feedback status management.

Local verification passed 46 tests, ESLint, TypeScript, and the production
build. Live HTTPS verification used a temporary isolated account and confirmed:

```text
registration                         201
workspace with Help + Feedback       200
invalid feedback                     400
valid bug submission                 201
ordinary-user admin status update    404
superadmin dashboard and report      200
superadmin status update             200 -> in_progress
release notes                        200
```

The stored test report contained no copied email, email-normalized value, note
ID, or note content. It did contain the expected tenant/user references and the
handling superadmin after the update. MongoDB exposed the intended status,
user-rate-limit, and workspace navigation indexes. The temporary report, user,
session, membership, organization, workspace, and book were removed after the
assertions; no `feedback-test-*` accounts remain.
