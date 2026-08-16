# MongoDB Development/Test Operations

This document records how the EpiNote development database is operated without
committing host addresses, SSH keys, or credentials.

The public application name is `EpiNote`. Existing `epignos` server, user,
database, and path identifiers are intentionally retained as internal operational
names.

## Host access

Use the developer-local SSH alias:

```sh
ssh epignos-dev-test
```

The alias definition, raw host address, user, and identity file remain in the
developer's local SSH configuration.

## Installed state

- MongoDB Community 8.0.29.
- Official MongoDB 8.0 APT repository for Ubuntu 24.04 Noble.
- systemd service: `mongod`.
- Service enabled at boot and active.
- Configuration: `/etc/mongod.conf`.
- Data: `/var/lib/mongodb`.
- Logs: `/var/log/mongodb/mongod.log`.
- Listener: `127.0.0.1:27017` only.
- Authorization: enabled.
- Development database: `epignos_dev`.
- Application user: `epignos_app`, scoped to `readWrite` on `epignos_dev`.

## Credential locations

Application credential, owned by `epignos` with mode `0600`:

```text
/home/epignos/.config/epignos/mongodb.env
```

Root administrative credential, owned by `root` with mode `0600`:

```text
/root/.config/epignos/mongodb-admin.env
```

Never print these values into logs, copy them into chat, or commit them to Git.
The application service should load the application environment file directly on
the host.

## Routine checks

```sh
ssh epignos-dev-test 'systemctl is-active mongod'
ssh epignos-dev-test 'systemctl is-enabled mongod'
ssh epignos-dev-test 'ss -lnt | grep 27017'
ssh epignos-dev-test 'sudo tail -n 100 /var/log/mongodb/mongod.log'
```

Expected listener:

```text
127.0.0.1:27017
```

No `0.0.0.0:27017` or public interface listener is acceptable.

## Authenticated application check

Run on the host without printing the URI:

```sh
ssh epignos-dev-test '. /home/epignos/.config/epignos/mongodb.env && mongosh "$MONGODB_URI" --quiet --eval "db.adminCommand({ping:1})"'
```

## Service operations

```sh
ssh epignos-dev-test 'sudo systemctl restart mongod'
ssh epignos-dev-test 'sudo systemctl stop mongod'
ssh epignos-dev-test 'sudo systemctl start mongod'
```

After a restart, allow the service to reach `Waiting for connections` before an
application readiness check is expected to pass.

## Remote development connection

Do not expose MongoDB publicly. If a developer must connect from their machine,
use an SSH tunnel:

```sh
ssh -N -L 27018:127.0.0.1:27017 epignos-dev-test
```

Then connect the local client to `127.0.0.1:27018` using an authorized database
credential. Avoid placing the password in shell history.

## Package updates

Check available versions:

```sh
ssh epignos-dev-test 'apt-cache policy mongodb-org'
```

Patch updates must be deliberate:

1. Confirm the target patch in MongoDB release notes.
2. Confirm a recent restorable backup.
3. Update development/test first.
4. Restart and verify authenticated read/write behavior.
5. Review `/var/log/mongodb/mongod.log` for new startup warnings.

Do not perform an unattended major-version upgrade.

## Backup requirement before real data

The current server disk is not an independent backup. Before accepting real user
data, add authenticated `mongodump`, encrypt the result, copy it off-host, and
prove recovery with `mongorestore` into a separate database.

## Installation verification performed

On 2026-08-16 the following checks passed:

- Service active and enabled.
- Authentication rejects unauthenticated reads.
- Application user can write to `epignos_dev`.
- A verification document survived a `mongod` restart.
- Verification collection was removed after the test.
- Listener remained restricted to `127.0.0.1:27017`.

## Known development-host observations

- Host firewall is currently inactive. Loopback binding prevents MongoDB from
  listening publicly, but host firewall hardening remains a deployment task.
- The host currently has no swap. Available memory is sufficient for current
  development use, but memory and OOM behavior must be monitored before running
  more services.
- MongoDB emitted transparent-huge-page tuning suggestions. Evaluate and apply
  official MongoDB host tuning before production; do not make unverified kernel
  changes solely to silence warnings.
