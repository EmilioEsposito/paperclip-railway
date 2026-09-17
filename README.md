# Private Paperclip on Railway

Personal pilot deployment of [Paperclip](https://github.com/paperclipai/paperclip).
Uses the official self-hosted v2026.916.0 image pinned by digest, not a community application wrapper.

## Architecture

- One Paperclip service with a persistent `/paperclip` volume.
- Dedicated Railway Postgres, connected using `${{Postgres.DATABASE_URL}}` over the private network.
- HTTPS public login page; authenticated application and API. Public account registration is disabled.
- Paperclip telemetry and update checks disabled in configuration; `PAPERCLIP_TELEMETRY_DISABLED=1` and `DO_NOT_TRACK=1` also enforce opt-out. No Sentry destination configured. Agent runtimes require their own privacy review when enabled.
- Signing keys are generated locally by `scripts/railway-secrets.py`, saved under ignored `.private/` with restrictive permissions, and sent to Railway on stdin. Never commit or print them.

`public` exposure is the upstream setting for an Internet-facing HTTPS server; it does not grant public access to company data. Do not change authentication to `local_trusted`.

## Deployment

Create separate application and Postgres services, attach the data volume, set `PAPERCLIP_PUBLIC_URL`, `PORT=3100`, `HOST=0.0.0.0`, `TRUST_PROXY=uniquelocal`, and the database reference. Generate independent `BETTER_AUTH_SECRET`, `PAPERCLIP_AGENT_JWT_SECRET`, and `PAPERCLIP_TOOL_ACTION_SIGNING_SECRET`. The included provisioning script is scoped to this pilot's resource IDs.

Deploy this Dockerfile with Railway CLI. `.railway/railway.ts` records the imported native Railway infrastructure configuration; secrets use `preserve()`. `/api/health` is the deployment health check. Provision the owner through a private administrative connection; do not temporarily enable Internet signup. Preserve `/paperclip/instances/default/secrets/master.key` and signing keys through redeploys.

## Operations

This is an always-running pilot: Paperclip's scheduler touches Postgres even without an open browser. Railway compute, database memory, and volumes incur usage charges; model inference is separate. Keep one application replica and bounded agent concurrency. Review measured usage before expanding.

Daily Railway volume backups are configured for both Postgres and the app volume: database-only recovery cannot decrypt stored credentials without the master key. Backups are not verified until a restore test passes. Upgrade deliberately by reviewing upstream changes and replacing the pinned digest, then verify login, denied anonymous access, signup rejection, and telemetry opt-out.

No credentials, personal MCP tokens, company data, or private monorepo code belong in this public repository.
