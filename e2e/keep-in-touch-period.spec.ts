// Calendar arithmetic of "Пора связаться": the SQL expressions the app uses, run in the e2e
// database on fixed moments. No browser is needed.

import { expect, test } from "@playwright/test";
import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { ContactFrequency } from "../src/db/schema";
import { keepInTouchSql } from "../src/db/keep-in-touch-sql";
import { getTestDatabaseUrl } from "./test-database";

type Moments = {
  frequency?: ContactFrequency;
  lastNoteAt?: string;
  lastContactedAt?: string;
  frequencySetAt?: string;
};

let client: postgres.Sql;
let db: ReturnType<typeof drizzle>;

test.beforeAll(() => {
  client = postgres(getTestDatabaseUrl(), { max: 1, onnotice: () => {} });
  db = drizzle(client);
});

test.afterAll(async () => {
  await client.end();
});

const moment = (iso: string | undefined) => (iso ? sql`${iso}::timestamptz` : sql`null::timestamptz`);

// ISO 8601 in UTC, or null.
const isoUtc = (expression: SQL) => sql`to_char(${expression} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

async function evaluate(moments: Moments) {
  const { lastContactAt, periodStart, dueAt } = keepInTouchSql({
    frequency: moments.frequency ? sql`${moments.frequency}::contact_frequency` : sql`null::contact_frequency`,
    lastNoteAt: moment(moments.lastNoteAt),
    lastContactedAt: moment(moments.lastContactedAt),
    frequencySetAt: moment(moments.frequencySetAt),
  });
  const [row] = await db.execute<{ lastContactAt: string | null; periodStart: string | null; dueAt: string | null }>(
    sql`select ${isoUtc(lastContactAt)} as "lastContactAt", ${isoUtc(periodStart)} as "periodStart", ${isoUtc(dueAt)} as "dueAt"`,
  );
  return row;
}

test("the period ends after a week, a calendar month, quarter or year", async () => {
  const cases: [ContactFrequency, string, string][] = [
    ["week", "2026-03-03T10:00:00Z", "2026-03-10T10:00:00Z"],
    ["month", "2026-03-03T10:00:00Z", "2026-04-03T10:00:00Z"],
    // No February 31: the period ends on the last day of February, at the same time of day.
    ["month", "2026-01-31T10:00:00Z", "2026-02-28T10:00:00Z"],
    ["month", "2028-01-31T10:00:00Z", "2028-02-29T10:00:00Z"],
    ["quarter", "2026-03-03T10:00:00Z", "2026-06-03T10:00:00Z"],
    ["quarter", "2026-11-30T10:00:00Z", "2027-02-28T10:00:00Z"],
    ["year", "2026-03-03T10:00:00Z", "2027-03-03T10:00:00Z"],
    ["year", "2028-02-29T10:00:00Z", "2029-02-28T10:00:00Z"],
  ];
  for (const [frequency, lastNoteAt, expectedDueAt] of cases) {
    const { dueAt } = await evaluate({ frequency, lastNoteAt });
    expect(dueAt, `${frequency} from ${lastNoteAt}`).toBe(expectedDueAt);
  }
});

test("the period starts at the latest of the note, 'Связались' and choosing the frequency", async () => {
  const note = "2026-01-10T09:00:00Z";
  const contacted = "2026-02-01T18:30:00Z";
  const frequencySet = "2026-01-20T12:00:00Z";

  // "Связались" is the latest.
  expect(
    await evaluate({ frequency: "week", lastNoteAt: note, lastContactedAt: contacted, frequencySetAt: frequencySet }),
  ).toEqual({ lastContactAt: contacted, periodStart: contacted, dueAt: "2026-02-08T18:30:00Z" });

  // An old note does not count from before the frequency was chosen.
  expect(await evaluate({ frequency: "month", lastNoteAt: note, frequencySetAt: frequencySet })).toEqual({
    lastContactAt: note,
    periodStart: frequencySet,
    dueAt: "2026-02-20T12:00:00Z",
  });

  // A note after "Связались" wins.
  expect(
    await evaluate({
      frequency: "week",
      lastNoteAt: "2026-02-03T08:00:00Z",
      lastContactedAt: contacted,
      frequencySetAt: frequencySet,
    }),
  ).toEqual({
    lastContactAt: "2026-02-03T08:00:00Z",
    periodStart: "2026-02-03T08:00:00Z",
    dueAt: "2026-02-10T08:00:00Z",
  });

  // No contact yet: counted from choosing the frequency.
  expect(await evaluate({ frequency: "week", frequencySetAt: frequencySet })).toEqual({
    lastContactAt: null,
    periodStart: frequencySet,
    dueAt: "2026-01-27T12:00:00Z",
  });

  // Frequency not set: there is no period at all.
  expect(await evaluate({ lastNoteAt: note })).toEqual({ lastContactAt: note, periodStart: note, dueAt: null });
});
