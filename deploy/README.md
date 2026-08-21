# EpiNote dev-test deployment

The application is deployed as a versioned release under `/opt/epinote/releases`
with `/opt/epinote/current` pointing to the active release.

Canonical development URL: `https://epinote.epignos.dev`.

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
RESEND_API_KEY
EMAIL_FROM="EpiNote <no-reply@notify.epignos.dev>"
OPENROUTER_API_KEY
OPENROUTER_MODEL=openai/gpt-oss-120b
OPENROUTER_FAST_MODEL=google/gemini-2.5-flash
OPENROUTER_LARGE_NOTE_MODEL=deepseek/deepseek-v4-pro
```

`RESEND_API_KEY` is a send-only credential and must remain in the protected
server environment, never MongoDB, Git, or browser code. Transactional email is
available for legal notices; account email verification remains disabled until
its token workflow is implemented and tested.

## Release procedure

1. Create a new explicit directory under `/opt/epinote/releases`.
2. Copy repository files without `.git`, `.env`, build output, or dependencies.
3. Run `npm ci` and `npm run build` as `epignos` inside that release. The build
   copies `.next/static` and `public` into the standalone package; do not start a
   release whose `/_next/static/` asset check returns anything other than `200`.
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
curl --fail --silent https://PUBLIC_IP/_next/static/COMPILED_ASSET
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

The canonical domain uses a standard free Let's Encrypt certificate. The IP
certificate remains only so direct-IP HTTPS can redirect safely to the domain.
