import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "us-east4-eqdc4a" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 50000 });
  const paperclipData = volume("paperclip-data", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 50000 });
  const paperclip = service("paperclip", {
    source: github("EmilioEsposito/paperclip-railway", { checkSuites: false }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/api/health",
    healthcheckTimeout: 300,
    replicas: { "us-east4-eqdc4a": 1 },
    deploy: { restartPolicyMaxRetries: 5 },
    volumeMounts: { "/paperclip": paperclipData },
    env: { BETTER_AUTH_SECRET: preserve(), DATABASE_URL: preserve(), DO_NOT_TRACK: preserve(), HOST: preserve(), PAPERCLIP_AGENT_JWT_SECRET: preserve(), PAPERCLIP_AUTH_DISABLE_SIGN_UP: preserve(), PAPERCLIP_PUBLIC_URL: preserve(), PAPERCLIP_TELEMETRY_DISABLED: preserve(), PAPERCLIP_TOOL_ACTION_SIGNING_SECRET: preserve(), PORT: preserve(), SENTRY_DSN: preserve(), SENTRY_DSN_BACKEND: preserve(), SENTRY_DSN_FRONTEND: preserve(), TRUST_PROXY: preserve() },
  });

  return project("paperclip", {
    resources: [paperclip, Postgres, postgresVolume, paperclipData],
  });
});
