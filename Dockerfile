# Official self-hosted Paperclip v2026.916.0; immutable multi-platform digest.
FROM ghcr.io/paperclipai/paperclip@sha256:3621579c4bd86ac3bba74f00d77287a3e8c95a95d9b87d838745d225c03fd6e5
COPY paperclip.json /app/pilot-config.json
ENV PAPERCLIP_CONFIG=/app/pilot-config.json \
    PAPERCLIP_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 \
    DISABLE_TELEMETRY=1 CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    PAPERCLIP_AUTH_DISABLE_SIGN_UP=true \
    PAPERCLIP_DEPLOYMENT_MODE=authenticated PAPERCLIP_DEPLOYMENT_EXPOSURE=public
