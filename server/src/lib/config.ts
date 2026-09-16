// Centralized env/config access (portable: no Bun-only APIs).
// Lazy getters — never throw at import time, except requireAuthSecret()
// which fail-fasts when called in production without a real secret.

const PLACEHOLDER_SECRETS = new Set(["__placeholder__", "change-me-generate-32-bytes-minimum", ""]);

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? undefined : v;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getPort(defaultPort = 3001): number {
  const raw = Number(readEnv("PORT") ?? defaultPort);
  return Number.isNaN(raw) ? defaultPort : raw;
}

export function getDatabaseUrl(): string {
  // Integration tests must use the isolated DB. In test runs (vitest / NODE_ENV=test)
  // prefer TEST_DATABASE_URL; in dev/prod use DATABASE_URL.
  const isTest = readEnv("VITEST") === "true" || readEnv("NODE_ENV") === "test" || Boolean(process.env.VITEST);
  if (isTest) {
    const testUrl = readEnv("TEST_DATABASE_URL");
    if (testUrl) return testUrl;
  }
  const url = readEnv("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL environment variable is required (or TEST_DATABASE_URL for tests)");
  return url;
}

export function getDatabaseUrlForEnv(): string {
  const url = readEnv("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL environment variable is required");
  return url;
}

export function getAuthSecret(): string {
  return readEnv("AUTH_SECRET") ?? "__placeholder__";
}

/** Fail fast in production when AUTH_SECRET is missing or still a placeholder. */
export function requireAuthSecret(): string {
  const secret = getAuthSecret();
  if (isProduction() && (PLACEHOLDER_SECRETS.has(secret) || secret.length < 32)) {
    throw new Error("AUTH_SECRET must be set to a real value (min 32 chars) in production");
  }
  return secret;
}

export function getAppUrl(): string {
  return (readEnv("APP_URL") ?? "http://localhost:5173").replace(/\/$/, "");
}

export interface SmtpConfig {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export function getSmtpConfig(): SmtpConfig {
  const port = Number(readEnv("SMTP_PORT") ?? 587);
  return {
    host: readEnv("SMTP_HOST"),
    port: Number.isNaN(port) ? 587 : port,
    secure: readEnv("SMTP_SECURE") === "true" || port === 465,
    user: readEnv("SMTP_USER"),
    pass: readEnv("SMTP_PASS"),
    from: readEnv("SMTP_FROM") ?? "no-reply@localhost",
  };
}

export function isSmtpConfigured(): boolean {
  return Boolean(readEnv("SMTP_HOST"));
}
