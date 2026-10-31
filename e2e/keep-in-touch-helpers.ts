// Helpers for the "Пора связаться" tests: they move a contact's moments into the past straight in the
// e2e database, so the tests imitate passing time without waiting.

import { expect, type Page } from "@playwright/test";
import postgres from "postgres";

import type { ContactFrequency } from "../src/db/schema";
import { getTestDatabaseUrl, splitTestDatabaseUrl } from "./test-database";

let client: postgres.Sql | undefined;

function db(): postgres.Sql {
  if (!client) {
    const url = getTestDatabaseUrl();
    splitTestDatabaseUrl(url); // Throws unless this is the "*_e2e" database.
    client = postgres(url, { max: 1, onnotice: () => {} });
  }
  return client;
}

export async function closeDatabase() {
  await client?.end();
  client = undefined;
}

// Unique per test run; every contact the tests add carries it, so they can be removed afterwards.
export const RUN_TAG = `Связьтест${Date.now().toString().slice(-6)}`;

let counter = 0;
// The counter is padded, so that one name is never a part of another ("-001" vs "-010").
export function uniqueName(firstName: string): string {
  counter += 1;
  return `${firstName} ${RUN_TAG}-${String(counter).padStart(3, "0")}`;
}

// Removes every contact added by this run: main-scenario.spec.ts expects the seeded 1000 contacts.
export async function deleteTestContacts() {
  await db()`delete from contacts where name like ${`%${RUN_TAG}%`}`;
}

// Adds a contact straight to the database, for tests where creating it is not the point.
// The moments are counted back from now: { lastNoteAt: "8 days" }.
export async function insertContact(
  name: string,
  { frequency, notes, ...moments }: { frequency?: ContactFrequency; notes?: string } & Partial<Record<Moment, string>>,
) {
  await db()`
    insert into contacts (name, notes, contact_frequency, frequency_set_at)
    values (${name}, ${notes ?? null}, ${frequency ?? null}, ${frequency ? db()`now()` : null})
  `;
  await setMomentsAgo(name, moments);
}

const MOMENT_COLUMNS = {
  lastNoteAt: "last_note_at",
  lastContactedAt: "last_contacted_at",
  frequencySetAt: "frequency_set_at",
} as const;

type Moment = keyof typeof MOMENT_COLUMNS;

// Sets moments of the contact with this name, counted back from now: { lastNoteAt: "8 days" }.
// null clears the moment.
export async function setMomentsAgo(name: string, moments: Partial<Record<Moment, string | null>>) {
  for (const [key, ago] of Object.entries(moments)) {
    const column = MOMENT_COLUMNS[key as Moment];
    const result = await db()`
      update contacts
      set ${db()(column)} = case when ${ago}::interval is null then null else now() - ${ago}::interval end
      where name = ${name}
    `;
    expect(result.count, `contact "${name}"`).toBe(1);
  }
}

export async function getStoredContact(name: string) {
  const [row] = await db()<
    { notes: string | null; lastNoteAt: Date | null; lastContactedAt: Date | null; updatedAt: Date }[]
  >`
    select notes, last_note_at as "lastNoteAt", last_contacted_at as "lastContactedAt", updated_at as "updatedAt"
    from contacts where name = ${name}
  `;
  expect(row, `contact "${name}"`).toBeDefined();
  return row;
}

// Leaves the frequency only on the given contacts, so that they are the whole "Пора связаться" block.
export async function clearFrequencyExcept(names: string[]) {
  await db()`
    update contacts set contact_frequency = null, frequency_set_at = null
    where contact_frequency is not null and name <> all(${names})
  `;
}

// Adds a contact through the form; returns its id.
export async function addContact(
  page: Page,
  { name, frequency, notes }: { name: string; frequency?: string; notes?: string },
) {
  await page.goto("/contacts/new");
  await page.getByLabel("Имя").fill(name);
  if (notes) await page.getByLabel("Заметки").fill(notes);
  if (frequency) await chooseFrequency(page, frequency);
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  return Number(new URL(page.url()).searchParams.get("added"));
}

export function frequencySelect(page: Page) {
  return page.getByRole("combobox", { name: "Как часто общаться" });
}

export async function chooseFrequency(page: Page, label: string) {
  await frequencySelect(page).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(frequencySelect(page)).toHaveText(label);
}
