// Runs before each test file: stubs next/cache (it only works inside a Next.js request) and
// empties every table of the Vitest database, so tests never see data left by another test.

import postgres from "postgres";
import { afterAll, beforeEach, vi } from "vitest";

import { getDatabaseUrl } from "@/db/env";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const client = postgres(getDatabaseUrl(), { max: 1, onnotice: () => {} });

beforeEach(async () => {
  const tables = await client<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `;
  if (tables.length === 0) return;
  const names = tables.map((table) => `"${table.tablename}"`).join(", ");
  await client.unsafe(`truncate table ${names} restart identity cascade`);
});

afterAll(() => client.end());
