// Loads .env for standalone scripts (drizzle-kit, seed, e2e setup).
// Next.js loads .env on its own. Variables that are already set are never overridden.
export function loadEnv() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: rely on the variables already present in the environment.
  }
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill in the connection settings.");
  }
  return url;
}

// Settings of sign-in and email. Each one is read when it is needed, so a missing setting
// stops the feature that needs it with a clear message instead of failing at import time.
function requireSetting(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. ${hint}`);
  }
  return value;
}

// Secret that signs the session cookie.
export function getAuthSecret(): string {
  return requireSetting("BETTER_AUTH_SECRET", "Generate one with `openssl rand -base64 32` and add it to .env.");
}

// Public address of the app: sign-in links and cookies are built from it.
export function getAuthUrl(): string {
  return requireSetting("BETTER_AUTH_URL", "Add the app address to .env, e.g. http://localhost:3000.");
}

// Where sign-in emails go: Mailpit locally, the mail service on the server.
export function getSmtpUrl(): string {
  return requireSetting("SMTP_URL", "Add the SMTP address to .env, e.g. smtp://127.0.0.1:1025.");
}

// Sender address of sign-in emails.
export function getMailFrom(): string {
  return requireSetting("MAIL_FROM", "Add the sender address to .env, e.g. noreply@localhost.");
}

// Email of the user who owns the contacts that existed before sign-in and the demo data.
// Optional here: migrations of an empty database do not need it.
export function getOwnerEmail(): string | undefined {
  return process.env.OWNER_EMAIL?.trim() || undefined;
}

export function requireOwnerEmail(): string {
  return requireSetting("OWNER_EMAIL", "Add the owner's email to .env.");
}
