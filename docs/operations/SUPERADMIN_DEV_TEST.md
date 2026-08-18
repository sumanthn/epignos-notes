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
