// Runs before each test file: stubs next/cache and next/headers (they only work inside a Next.js request)
// and empties every table of the Vitest database, so tests never see data left by another test.

import postgres from "postgres";
import { afterAll, beforeEach, vi } from "vitest";

import { getDatabaseUrl } from "@/db/env";

import { getTestRequestHeaders, signOutTestUser } from "./vitest.session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// The headers of the "request" are those of the user who signed in with signInAs (see vitest.session.ts).
// cookies() is write-only here: nothing in tests reads the cookies Better Auth would set in a browser.
vi.mock("next/headers", () => ({
  headers: async () => getTestRequestHeaders(),
  cookies: async () => ({ set: () => {}, get: () => undefined, getAll: () => [], delete: () => {} }),
}));

const client = postgres(getDatabaseUrl(), { max: 1, onnotice: () => {} });

beforeEach(async () => {
  // Every test starts without sign-in: the sessions are gone with the truncated tables.
  signOutTestUser();
  const tables = await client<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `;
  if (tables.length === 0) return;
  const names = tables.map((table) => `"${table.tablename}"`).join(", ");
  await client.unsafe(`truncate table ${names} restart identity cascade`);
});

afterAll(() => client.end());
