# EpiNote dev-test deployment

The application is deployed as a versioned release under `/opt/epinote/releases`
with `/opt/epinote/current` pointing to the active release.

Runtime shape:

```text
Internet -> nginx :443 -> Next.js 127.0.0.1:3000 -> MongoDB 127.0.0.1:27017
```

Server-only configuration:

```text
/home/epignos/.config/epinote/app.env       mode 0600
/etc/systemd/system/epinote.service
/etc/nginx/sites-available/epinote
```

The app environment combines the existing MongoDB application URI with:

```text
APP_BASE_URL
MONGODB_DB=epignos_dev
AUTH_REQUIRE_EMAIL_VERIFICATION=false
COOKIE_SECURE=true
AUTH_HMAC_SECRET
```

`AUTH_REQUIRE_EMAIL_VERIFICATION=false` is allowed only on this development
instance until email delivery exists.

## Release procedure

1. Create a new explicit directory under `/opt/epinote/releases`.
2. Copy repository files without `.git`, `.env`, build output, or dependencies.
3. Run `npm ci` and `npm run build` as `epignos` inside that release.
4. Point `/opt/epinote/current` to the new release.
5. Restart `epinote` and require a successful local health check.
6. Keep the previous release for rollback.

Rollback changes the `current` symlink to a known prior release and restarts the
service. Database schema changes must remain backward compatible with the prior
release.

## Verification

```bash
systemctl is-active epinote nginx mongod
curl --fail --silent http://127.0.0.1:3000/api/health
curl --fail --silent https://PUBLIC_IP/api/health
ss -ltnp
```

Only nginx ports 80/443 and SSH should be public. Next.js and MongoDB must remain
bound to loopback.

## TLS

The raw-IP deployment uses a Let's Encrypt short-lived IP certificate. Certbot
must support `--ip-address` and the `shortlived` ACME profile. Renewal is handled
by Certbot's systemd timer. The committed pre/post hooks stop nginx for the
standalone HTTP challenge and always start it again afterward; nginx reads the
renewed certificate on startup.

A normal domain certificate should replace this as soon as an EpiNote domain is
available.
