# Private Paperclip on Railway

Personal pilot of [Paperclip](https://github.com/paperclipai/paperclip), using the official self-hosted v2026.916.0 image pinned by immutable digest.

## Login and access

Open **https://paperclip.serniaventures.com**. Cloudflare Access first sends an email PIN to the allowed owner address, `emilio@serniacapital.com`. Then sign into Paperclip with its separate email/password account. Access sessions last 12 hours. Public Paperclip signup remains disabled. The upstream UI still displays a Create one link, but the server rejects registration.

The Access application allows only that exact address and only the email-PIN identity provider. No domain-wide registration, bypass policy, service-token policy, or personal MCP credentials are enabled. Email PIN plus an independent app password adds protection but is not phishing-resistant MFA.

## Origin protection

Railway's public port 3100 runs `access/start.mjs`. Paperclip itself binds only to loopback port 3101. The gate validates Cloudflare's RS256 signature, issuer, app audience, required time/identity claims, expiry, app-token type, and exact owner email using `jose`. It protects HTTP and WebSocket upgrades, and replaces forwarding headers with the canonical HTTPS origin. Missing, invalid, expired, wrong-app, or wrong-identity tokens fail closed. The Railway-generated URL therefore cannot bypass Access.

The only anonymous origin route is `GET /_health`, returning only `ok` or `unavailable` after checking Paperclip readiness. It exposes no app data. Cloudflare still gates this route on the custom hostname.

The three public Access configuration values are `CF_ACCESS_ISSUER`, `CF_ACCESS_AUD`, and `CF_ACCESS_EMAIL`. No Cloudflare account credential is stored in the app. Keep the Access policy, exact-email check, and Paperclip account aligned when changing the owner. Remote agents will need an explicitly designed machine-authentication path; do not add an anonymous API bypass.

## Infrastructure and privacy

- Dedicated Railway Postgres via `${{Postgres.DATABASE_URL}}` on the private network.
- Persistent `/paperclip` volume for workspaces, local assets, and encryption keys.
- Daily Railway backups on both database and app volumes. Restore testing remains outstanding.
- Paperclip telemetry and update checks disabled, with `PAPERCLIP_TELEMETRY_DISABLED=1` and `DO_NOT_TRACK=1`. No Sentry destination. Cloudflare necessarily processes requests and keeps its security/access logs.
- Independent signing secrets transferred through stdin by `scripts/railway-secrets.py`; local recovery files live in ignored `.private/` with restrictive permissions. Never print or commit them.
- One app replica. Paperclip and Postgres run continuously and incur usage charges; model inference is separate.

## Deployment and verification

GitHub pushes changing Dockerfile, paperclip.json, .dockerignore, or access/** trigger Railway deployment. Review upstream changes before manually updating the image digest. Native infrastructure is recorded in `.railway/railway.ts`; remote variables use `preserve()`.

Run `cd access && npm ci --ignore-scripts`, then `node --test access/gate.test.mjs` from the repo root. Tests cover valid and invalid signatures, issuer/audience/identity/expiry restrictions, anonymous and forged-header denial, header normalization, HTTP forwarding, WebSocket forwarding, and data-free health behavior.

`python3 scripts/verify-private.py` checks live external denial and Access redirects. Run `scripts/verify-internal-auth.mjs` inside the container through authenticated Railway SSH to verify Paperclip's separate password layer; it never prints credentials or sessions. Complete one real email-PIN browser login to verify the full user path.

Private administrative SSH remains the recovery path. The owner bootstrap script runs only through that channel; it never exposes an HTTP account-creation endpoint. Preserve the volume master key and signing secrets for recovery: database-only backups cannot decrypt stored connection credentials.
