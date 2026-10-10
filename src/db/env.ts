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
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in the connection settings.",
    );
  }
  return url;
}
