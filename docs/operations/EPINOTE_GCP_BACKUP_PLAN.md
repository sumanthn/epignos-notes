# EpiNote GCP backup and recovery plan

Status: first encrypted backup restored successfully; recurring timer awaits a least-privilege uploader
Last updated: 2026-08-21

This document records the agreed backup design for the current EpiNote deployment.
The backup job and timer are installed, and the first real encrypted backup has
been uploaded and restored successfully. The timer is intentionally disabled
because the supplied GCP identity has broad inherited bucket permissions. Its
credential was removed from Contabo after the verified one-time upload.

## 0. Verified implementation checkpoint (2026-08-21)

Destination selected by the operator:

```text
bucket:                   gs://databay-personal
prefix:                   epinote/dev-test
location:                 US
uniform bucket access:    enabled
public access prevention: enforced
soft delete:              7 days
bucket retention policy:  not configured
lifecycle rules:          not configured for this prefix
```

The bucket's US location differs from the earlier preferred EU direction. Every
EpiNote object is nevertheless encrypted before upload with a recovery public
key; the private key never reached Contabo.

First verified object:

```text
gs://databay-personal/epinote/dev-test/frequent/2026/08/21/epinote-20260821T135146Z.tar.gz.gpg
size:       527251 bytes
sha256:     62ac8b8820fa8f56090a04b6887e21df1e477fc4cbeda4bce9be48b2e7d93c29
format:     epinote-encrypted-backup-v1
fingerprint: 91D07281610077462848BEF1161EA78A41D5F7FF
```

The downloaded object matched the server checksum, decrypted on the Mac, and
passed every member checksum. Its application database restored into an
isolated MongoDB namespace with 14 collections, 248 documents, all indexes, and
zero restore failures. Every collection count matched production, including 42
Notes and 5 users. The temporary database and all plaintext restore material
were removed. One earlier admin-only test object was identified by the restore
exercise and deleted before it was treated as a valid backup.

Installed server components:

```text
/usr/local/sbin/epinote-backup
/etc/systemd/system/epinote-backup.service
/etc/systemd/system/epinote-backup.timer
/root/.config/epinote-backup/backup.env
/root/.config/epinote-backup/mongodump.yml
/root/.config/epinote-backup/gnupg/       public recovery key only
/var/lib/epinote-backup/last-success.json
MongoDB user epinote_backup               built-in backup role
```

The timer is disabled. Do not enable it until a new dedicated service-account
key passes the permission test below with only `storage.objects.create`:

```text
storage.objects.create   required
storage.objects.get      must be absent
storage.objects.list     must be absent
storage.objects.delete   must be absent
storage.buckets.update   must be absent
```

The supplied key had all five permissions, so its file and cached Cloud SDK
credentials were removed from Contabo after the one-time verified upload. The
key remains on the Mac with mode `0600`; it should be replaced or revoked after
a dedicated uploader is created.

## 1. Recovery objective

EpiNote currently runs on one Contabo server with MongoDB Community. The server
disk is the live storage location and is not a backup.

Initial targets:

- Recovery point objective (RPO): no more than six hours of accepted user data.
- Recovery time objective (RTO): restore service within two hours once a clean
  replacement server is available.
- Restore confidence: one automated backup is not considered successful until a
  representative archive has been restored into an isolated MongoDB database.

## 2. Selected destination

Use a dedicated private Google Cloud Storage bucket as the primary off-host
backup destination.

Planned bucket properties:

- A dedicated GCP project or a clearly isolated bucket in an existing project.
- A globally unique bucket name such as `epinote-production-backups-<suffix>`.
- `EU` or an agreed European region if EpiNote data is to remain in Europe.
- Standard Storage initially. The database is currently only a few megabytes, so
  simplicity matters more than cold-storage optimization.
- Uniform bucket-level access.
- Public access prevention enforced.
- Google-managed encryption at rest in addition to EpiNote's client-side
  encryption.
- A 30-day bucket retention policy.
- Do not permanently lock the retention policy until the complete backup and
  restore workflow has passed its first recovery exercise. Locking is
  irreversible.

Google references:

- [Cloud Storage IAM](https://docs.cloud.google.com/storage/docs/access-control/iam)
- [Uniform bucket-level access](https://docs.cloud.google.com/storage/docs/uniform-bucket-level-access)
- [Public access prevention](https://docs.cloud.google.com/storage/docs/using-public-access-prevention)
- [Bucket retention and lock](https://docs.cloud.google.com/storage/docs/bucket-lock)
- [Object Lifecycle Management](https://docs.cloud.google.com/storage/docs/lifecycle)
- [Cloud Storage pricing](https://cloud.google.com/storage/pricing)

## 3. Backup identity and credentials

Create one dedicated service account for the Contabo backup uploader. Grant it
`roles/storage.objectCreator` on the backup bucket only, not on the project.

The uploader must be able to create uniquely named objects. It must not be able
to read, replace, or delete previous backups, edit bucket policy, or create other
credentials. A separate human administrator identity performs restore and
retention administration.

The Contabo host does not currently expose a suitable external identity provider,
so a narrowly scoped service-account JSON key is the practical first
implementation. Google recommends keyless Workload Identity Federation where an
external identity provider is available, so this decision should be revisited if
the hosting identity changes.

Credential handling:

- Never paste the JSON key into chat.
- Never commit it to this repository or add it to the EpiNote application
  environment.
- Suggested Mac location:
  `/Users/sumanth/epignos-keys/gcp/epinote-backup-uploader.json` with mode `0600`.
- Planned server location:
  `/root/.config/epinote-backup/gcs-uploader.json` with owner `root:root` and mode
  `0600`.
- The backup service runs as root because it must read protected application and
  MongoDB configuration. The EpiNote web process must not be able to read the
  GCP key.
- Rotate the key deliberately and immediately revoke it if it is ever copied to
  an unsafe location.

MongoDB authentication is also separate from the application. Create a dedicated
MongoDB user in the `admin` database with the built-in `backup` role, which is
specifically sufficient for a complete `mongodump`. Store its connection material
in the same root-only backup configuration, not in command-line arguments or the
application environment. Restoration uses a separate, temporary administrator or
MongoDB `restore` identity and never reuses the uploader job's database access.

Google references:

- [Service-account security practices](https://docs.cloud.google.com/iam/docs/best-practices-service-accounts)
- [Managing service-account keys](https://docs.cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)
- [MongoDB backup and restore roles](https://www.mongodb.com/docs/manual/reference/built-in-roles/#backup-and-restoration-roles)
- [`mongodump` behavior](https://www.mongodb.com/docs/database-tools/mongodump/)

## 4. What each backup contains

Required data:

- A complete authenticated `mongodump` of the MongoDB instance, including
  EpiNote collections, GridFS collections, database users, and roles.
- `/home/epignos/.config/epinote/app.env`.
- EpiNote systemd unit configuration.
- nginx virtual-host configuration.
- MongoDB configuration relevant to recovery.
- A small deployment manifest containing the Git commit, active release,
  MongoDB version, Node version, database-tools version, creation time, and
  hostname.
- SHA-256 checksums and file sizes for every member of the archive.

Do not back up:

- `node_modules` or historical release directories; application source is
  already versioned in Git.
- application logs, caches, temporary audio, or temporary video.
- Let's Encrypt private keys; certificates can be reissued for the domain.
- YouTube browser cookies. They are sensitive, short-lived access material and
  should be regenerated if ever needed.
- operating-system caches or package downloads.

## 5. Consistent backup sequence

The first implementation should be one explicit shell program invoked by a
systemd service and timer:

1. Acquire a local lock so two runs cannot overlap.
2. Create a private temporary directory with `mktemp -d`.
3. Stop only the EpiNote application service to quiesce application writes.
4. Run a complete authenticated `mongodump` while MongoDB remains running.
5. Restart EpiNote immediately. A shell trap must restart it even if dumping
   fails or the process is interrupted.
6. Collect the approved configuration files and deployment manifest.
7. Generate checksums.
8. Create one compressed archive.
9. Encrypt the archive before it leaves the server using a GPG public recovery
   key.
10. Upload using a new timestamped object name; never overwrite an object.
11. Record the object path, local checksum, size, duration, and command result.
12. Remove the temporary plaintext and encrypted local files.

The private GPG recovery key must remain off the Contabo server. Store it in a
password manager and keep a second encrypted offline copy. Losing that key makes
the backups unusable.

## 6. Schedule and retention

Use UTC timestamps and these prefixes:

```text
gs://<bucket>/epinote/frequent/YYYY/MM/DD/<timestamp>.tar.gz.gpg
gs://<bucket>/epinote/weekly/YYYY/WW/<timestamp>.tar.gz.gpg
gs://<bucket>/epinote/monthly/YYYY/MM/<timestamp>.tar.gz.gpg
```

Schedule:

- `frequent`: every six hours, retain for 35 days.
- `weekly`: once per week, retain for 90 days.
- `monthly`: once per month, retain for 400 days.

The same encrypted archive can be uploaded to more than one prefix when a run is
also the weekly or monthly checkpoint. Lifecycle rules remove objects only after
their prefix-specific age and never before the bucket's minimum retention period.
Lifecycle rules must first be tested against a development prefix.

## 7. Verification and restore exercises

Every run:

- Require successful `mongodump`, archive, encryption, and upload exit codes.
- Record local archive checksum and byte size.
- Record the newest successful backup time locally without storing credentials or
  note content in logs.
- Alert when no successful backup has completed in eight hours.

Weekly:

- Use a separate monitoring or administrator identity to confirm recent objects
  exist in GCS and have plausible sizes.

Monthly:

1. Download one archive using a human restore identity.
2. Verify its checksum.
3. Decrypt outside the production server.
4. Restore into a temporary MongoDB database or isolated MongoDB instance.
5. Compare collection names and document counts, including GridFS.
6. Open representative users, books, notes, and attachments through a temporary
   application instance where practical.
7. Record duration, result, and any manual recovery steps.
8. Remove the temporary restored data after validation.

Quarterly:

- Restore onto a clean replacement server using only the repository, encrypted
  backup, recovery key, and written runbook.

## 8. Failure behavior

- A failed backup must never leave EpiNote stopped.
- An upload failure retains the encrypted archive only long enough for bounded
  retries, then raises an observable failure. It must not leave plaintext.
- A partial `mongodump` is never uploaded as a valid backup.
- Low disk space aborts before stopping the application.
- Missing tools, credentials, or encryption keys fail before application
  downtime.
- Backup logs must contain safe filenames, sizes, durations, and error codes, not
  secret values or note contents.

## 9. Inputs needed when implementation resumes

- GCP project ID.
- Approved GCS bucket name.
- Confirmed bucket location/data residency.
- Local path to the dedicated uploader service-account JSON.
- A GPG public recovery key and a confirmed safe location for its private key.
- A billing budget alert threshold.

## 10. Definition of done

The backup project is complete only when:

- the bucket and least-privilege identity are configured;
- the server job succeeds automatically every six hours;
- a failed run is visible;
- the service account cannot list, read, overwrite, or delete backups;
- the bucket cannot be public;
- plaintext secrets never leave the server;
- a real encrypted archive has been restored into an isolated MongoDB target;
- the measured RPO and RTO meet the targets above; and
- the recovery steps work without relying on undocumented knowledge.

Current result: encrypted upload and isolated restore are proven. Least-privilege
recurring upload, lifecycle/retention policy, and a second offline copy of the
recovery private key remain open. The executable recovery procedure is in
`docs/operations/EPINOTE_BACKUP_RUNBOOK.md`.
