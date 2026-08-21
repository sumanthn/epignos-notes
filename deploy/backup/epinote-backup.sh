#!/usr/bin/env bash
set -Eeuo pipefail

umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

CONFIG_FILE="${EPINOTE_BACKUP_CONFIG:-/root/.config/epinote-backup/backup.env}"
if [[ ! -r "$CONFIG_FILE" ]]; then
  echo "backup configuration is unavailable" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"

: "${GCS_BUCKET:?GCS_BUCKET is required}"
: "${GCS_BASE_PREFIX:?GCS_BASE_PREFIX is required}"
: "${GPG_RECIPIENT:?GPG_RECIPIENT is required}"
: "${MONGODUMP_CONFIG:?MONGODUMP_CONFIG is required}"

GCLOUD_CONFIG="${GCLOUD_CONFIG:-/root/.config/epinote-backup/gcloud}"
GPG_HOME="${GPG_HOME:-/root/.config/epinote-backup/gnupg}"
STATE_DIR="${STATE_DIR:-/var/lib/epinote-backup}"
MIN_FREE_KB="${MIN_FREE_KB:-1048576}"
APP_SERVICE="${APP_SERVICE:-epinote.service}"

for command_name in flock mongodump mongorestore gpg gcloud tar sha256sum jq systemctl curl; do
  command -v "$command_name" >/dev/null || {
    echo "required command is missing: $command_name" >&2
    exit 1
  }
done

[[ -r "$MONGODUMP_CONFIG" ]] || {
  echo "MongoDB backup configuration is unavailable" >&2
  exit 1
}
[[ -d "$GCLOUD_CONFIG" ]] || {
  echo "Google Cloud configuration is unavailable" >&2
  exit 1
}
gpg --homedir "$GPG_HOME" --batch --list-keys "$GPG_RECIPIENT" >/dev/null 2>&1 || {
  echo "backup recovery public key is unavailable" >&2
  exit 1
}

install -d -m 700 "$STATE_DIR"
exec 9>/run/lock/epinote-backup.lock
flock -n 9 || {
  echo "another EpiNote backup is already running" >&2
  exit 1
}

available_kb="$(df -Pk /var/tmp | awk 'NR == 2 { print $4 }')"
if [[ ! "$available_kb" =~ ^[0-9]+$ ]] || (( available_kb < MIN_FREE_KB )); then
  echo "insufficient free space for backup" >&2
  exit 1
fi

started_at_epoch="$(date -u +%s)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
year="$(date -u +%Y)"
month="$(date -u +%m)"
day="$(date -u +%d)"
week="$(date -u +%V)"
weekday="$(date -u +%u)"
work_dir="$(mktemp -d /var/tmp/epinote-backup.XXXXXX)"
payload_dir="$work_dir/payload"
archive_path="$work_dir/epinote-${timestamp}.tar.gz"
encrypted_path="${archive_path}.gpg"
app_stopped=0

cleanup() {
  exit_code=$?
  trap - EXIT INT TERM
  if (( app_stopped == 1 )); then
    systemctl start "$APP_SERVICE" || true
  fi
  rm -rf -- "$work_dir"
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

mkdir -p "$payload_dir/database" "$payload_dir/config"

if systemctl is-active --quiet "$APP_SERVICE"; then
  systemctl stop "$APP_SERVICE"
  app_stopped=1
fi

mongodump \
  --config="$MONGODUMP_CONFIG" \
  --archive="$payload_dir/database/mongodb.archive.gz" \
  --gzip

mongodump \
  --config="$MONGODUMP_CONFIG" \
  --db=admin \
  --archive="$payload_dir/database/mongodb-users-roles.archive.gz" \
  --gzip \
  --dumpDbUsersAndRoles

archive_inventory="$(mongorestore \
  --archive="$payload_dir/database/mongodb.archive.gz" \
  --gzip \
  --dryRun \
  --verbose \
  --nsInclude='epignos_dev.*' 2>&1)"
if ! grep -q 'epignos_dev.notes' <<<"$archive_inventory"; then
  echo "MongoDB dump does not contain the required EpiNote database" >&2
  exit 1
fi

if (( app_stopped == 1 )); then
  systemctl start "$APP_SERVICE"
  app_stopped=0
  for attempt in {1..20}; do
    if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null; then
      break
    fi
    if (( attempt == 20 )); then
      echo "EpiNote did not become healthy after the database dump" >&2
      exit 1
    fi
    sleep 1
  done
fi

approved_config_files=(
  /home/epignos/.config/epinote/app.env
  /home/epignos/.config/epignos/mongodb.env
  /root/.config/epignos/mongodb-admin.env
  /etc/systemd/system/epinote.service
  /etc/nginx/sites-available/epinote
  /etc/mongod.conf
  /usr/local/sbin/epinote-backup
  /etc/systemd/system/epinote-backup.service
  /etc/systemd/system/epinote-backup.timer
)
for source_file in "${approved_config_files[@]}"; do
  [[ -f "$source_file" ]] || continue
  destination="$payload_dir/config$source_file"
  mkdir -p "$(dirname "$destination")"
  cp --preserve=mode,timestamps "$source_file" "$destination"
done

active_release="$(readlink -f /opt/epinote/current 2>/dev/null || true)"
mongo_version="$(mongod --version | awk 'NR == 1 { print $3 }')"
mongo_tools_version="$(mongodump --version | awk 'NR == 1 { print $3 }')"
node_version="$(node --version)"
jq -n \
  --arg createdAt "$timestamp" \
  --arg hostname "$(hostname -f)" \
  --arg activeRelease "$active_release" \
  --arg mongoVersion "$mongo_version" \
  --arg mongoToolsVersion "$mongo_tools_version" \
  --arg nodeVersion "$node_version" \
  --arg backupFormat "epinote-encrypted-backup-v1" \
  '{createdAt:$createdAt,hostname:$hostname,activeRelease:$activeRelease,mongoVersion:$mongoVersion,mongoToolsVersion:$mongoToolsVersion,nodeVersion:$nodeVersion,backupFormat:$backupFormat}' \
  >"$payload_dir/MANIFEST.json"

(
  cd "$payload_dir"
  find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum >SHA256SUMS
)
tar -C "$payload_dir" -czf "$archive_path" .

gpg \
  --homedir "$GPG_HOME" \
  --batch \
  --yes \
  --trust-model always \
  --recipient "$GPG_RECIPIENT" \
  --output "$encrypted_path" \
  --encrypt "$archive_path"

encrypted_sha256="$(sha256sum "$encrypted_path" | awk '{ print $1 }')"
encrypted_size="$(stat -c %s "$encrypted_path")"
object_name="$(basename "$encrypted_path")"
frequent_object="gs://${GCS_BUCKET}/${GCS_BASE_PREFIX}/frequent/${year}/${month}/${day}/${object_name}"
uploaded_objects=("$frequent_object")

upload_object() {
  target_object="$1"
  env CLOUDSDK_CONFIG="$GCLOUD_CONFIG" gcloud storage cp \
    --quiet \
    --no-clobber \
    --content-type=application/octet-stream \
    --custom-metadata="sha256=${encrypted_sha256},backup-format=epinote-encrypted-backup-v1" \
    "$encrypted_path" \
    "$target_object" >/dev/null
}

upload_object "$frequent_object"

if [[ "$weekday" == "7" ]]; then
  weekly_object="gs://${GCS_BUCKET}/${GCS_BASE_PREFIX}/weekly/${year}/${week}/${object_name}"
  upload_object "$weekly_object"
  uploaded_objects+=("$weekly_object")
fi

if [[ "$day" == "01" ]]; then
  monthly_object="gs://${GCS_BUCKET}/${GCS_BASE_PREFIX}/monthly/${year}/${month}/${object_name}"
  upload_object "$monthly_object"
  uploaded_objects+=("$monthly_object")
fi

completed_at_epoch="$(date -u +%s)"
duration_seconds="$(( completed_at_epoch - started_at_epoch ))"
objects_json="$(printf '%s\n' "${uploaded_objects[@]}" | jq -R . | jq -s .)"
jq -n \
  --arg completedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg sha256 "$encrypted_sha256" \
  --argjson sizeBytes "$encrypted_size" \
  --argjson durationSeconds "$duration_seconds" \
  --argjson objects "$objects_json" \
  '{completedAt:$completedAt,sha256:$sha256,sizeBytes:$sizeBytes,durationSeconds:$durationSeconds,objects:$objects}' \
  >"$STATE_DIR/last-success.json"
chmod 600 "$STATE_DIR/last-success.json"

printf 'backup uploaded: %s bytes, sha256 %s, %s second(s)\n' \
  "$encrypted_size" "$encrypted_sha256" "$duration_seconds"
