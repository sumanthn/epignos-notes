# EpiNote backup and restore runbook

Status: first encrypted backup verified; scheduled uploads intentionally disabled
Last tested: 2026-08-21

This runbook is the operational companion to
`docs/operations/EPINOTE_GCP_BACKUP_PLAN.md`. It contains no credentials, private
keys, passwords, connection strings, or user content.

## 1. Current recovery assets

Mac-only recovery directory:

```text
/Users/sumanth/epignos-notes/backup-recovery/
  epinote-backup-public-key.asc
  epinote-backup-private-key.asc
  epinote-backup-recovery-passphrase.txt
  gnupg/
  verified/epinote-20260821T135146Z.tar.gz.gpg
```

All directories are mode `0700` and files are mode `0600`. The private key and
passphrase must never be copied to Contabo, Git, tickets, or chat. Put a second
encrypted copy in an offline location or password manager; the Mac directory is
currently a single recovery-key failure point.

Recovery fingerprint:

```text
91D07281610077462848BEF1161EA78A41D5F7FF
```

Server-side encryption holds only the matching public key under the root-only
backup configuration. The web application user cannot read the MongoDB backup
identity or backup configuration.

## 2. Run one manual backup

Prerequisites:

- `/root/.config/epinote-backup/gcloud` contains an active dedicated uploader;
- that identity has bucket-level `roles/storage.objectCreator` only;
- `/root/.config/epinote-backup/gcs-uploader.json` is root-owned mode `0600`;
- `epinote`, `nginx`, and `mongod` are healthy.

Run:

```bash
sudo systemctl start epinote-backup.service
sudo systemctl status epinote-backup.service --no-pager
sudo journalctl -u epinote-backup.service -n 100 --no-pager
sudo jq . /var/lib/epinote-backup/last-success.json
curl --fail --silent http://127.0.0.1:3000/api/health
```

The job refuses overlapping runs and low disk space. It stops only the EpiNote
application while MongoDB is dumped, restarts it before packaging/upload, and
uses an exit trap to restart it after failures. Before encryption it rejects a
dump whose dry-run inventory does not contain `epignos_dev.notes`.

## 3. Enable the recurring timer

Do this only after verifying the uploader cannot read, list, delete, overwrite,
or change the bucket.

```bash
sudo systemctl enable --now epinote-backup.timer
systemctl list-timers epinote-backup.timer --all
```

The timer runs every six hours at 00:17, 06:17, 12:17, and 18:17 UTC with up to
ten minutes of randomized delay. It is persistent across reboot. Sunday runs
also create a weekly object; first-of-month runs also create a monthly object.

## 4. Restore-test an encrypted object

Use a human/admin GCS identity to download one exact object. Verify its SHA-256
against object metadata and `/var/lib/epinote-backup/last-success.json` when that
state corresponds to the selected object.

On the Mac, decrypt into a new mode-`0700` temporary directory:

```bash
GNUPGHOME=/Users/sumanth/epignos-notes/backup-recovery/gnupg \
gpg --batch --pinentry-mode loopback \
  --passphrase-file /Users/sumanth/epignos-notes/backup-recovery/epinote-backup-recovery-passphrase.txt \
  --output /PRIVATE/TEMP/epinote-backup.tar.gz \
  --decrypt /PRIVATE/DOWNLOAD/epinote-TIMESTAMP.tar.gz.gpg

tar -xzf /PRIVATE/TEMP/epinote-backup.tar.gz -C /PRIVATE/TEMP/extracted
cd /PRIVATE/TEMP/extracted
shasum -a 256 -c SHA256SUMS
jq . MANIFEST.json
```

Copy only `database/mongodb.archive.gz` over SSH to a root-readable temporary
server path. Restore it into a unique isolated namespace, never directly over
`epignos_dev`:

```bash
sudo mongorestore \
  --uri="RESTORE_ADMIN_URI" \
  --archive=/PRIVATE/TEMP/mongodb.archive.gz \
  --gzip \
  --nsInclude='epignos_dev.*' \
  --nsFrom='epignos_dev.*' \
  --nsTo='epinote_restore_check_YYYYMMDD_HHMMSS.*'
```

Compare collection names, document counts, and indexes. After recording the
result, drop only the exact database whose name begins
`epinote_restore_check_`, then remove all plaintext temporary files. Restoring
`mongodb-users-roles.archive.gz` is reserved for a replacement/isolated MongoDB
instance because it contains production authentication state.

## 5. Full replacement-server recovery

1. Provision supported Ubuntu, MongoDB, Node, nginx, and Google Cloud CLI.
2. Clone the repository at the manifest's release commit when available.
3. Download and verify the encrypted backup with a human restore identity.
4. Decrypt off-server and validate every archive member checksum.
5. Restore MongoDB users/roles only into the clean replacement MongoDB instance.
6. Restore the application archive to `epignos_dev`.
7. Restore protected application/nginx/systemd/MongoDB configuration with the
   recorded ownership and mode, rotating credentials where practical.
8. Reissue Let's Encrypt certificates; private TLS keys are intentionally not in
   the backup.
9. Start MongoDB, EpiNote, and nginx; verify health, tenant isolation, users,
   Books, Notes, derived AI views, and exports.
10. Rotate any secret that existed on the failed server and record the recovery
    duration.

## 6. Known remaining work

- Create a dedicated bucket-level `Storage Object Creator` service account and
  replace/revoke the broad supplied key.
- Reinstall only that key on Contabo, verify effective permissions, run another
  manual backup/restore check, and then enable the timer.
- Add prefix-scoped lifecycle rules for 35-day frequent, 90-day weekly, and
  400-day monthly retention without affecting unrelated objects in the shared
  bucket.
- Decide whether US bucket residency is acceptable for user data or move future
  backups to an agreed EU bucket.
- Store a second encrypted offline copy of the recovery key and passphrase.
- Add an external alert when the last success is older than eight hours.
