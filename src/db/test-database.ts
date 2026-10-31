// Shared helper for building the URL of a test database that sits next to the main one
// (e.g. "crm" -> "crm_e2e" or "crm" -> "crm_test"), and for safely splitting it back apart.
// Used by both the Playwright e2e setup (suffix "_e2e") and the Vitest setup (suffix "_test").

import { getDatabaseUrl, loadEnv } from "./env";

export function buildTestDatabaseUrl(suffix: string): string {
  loadEnv();
  const url = new URL(getDatabaseUrl());
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name.endsWith(suffix)) {
    url.pathname = `/${encodeURIComponent(name + suffix)}`;
  }
  return url.toString();
}

// Name of the test database and a URL of the server's maintenance database used to create/drop it.
// Refuses to touch anything whose name doesn't end with `suffix`, so a misconfigured DATABASE_URL
// never lets a setup script drop a real database.
export function splitTestDatabaseUrl(testUrl: string, suffix: string) {
  const url = new URL(testUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name.endsWith(suffix)) {
    throw new Error(`Refusing to use "${name}" as a test database: its name must end with "${suffix}".`);
  }
  url.pathname = "/postgres";
  return { name, maintenanceUrl: url.toString() };
}
