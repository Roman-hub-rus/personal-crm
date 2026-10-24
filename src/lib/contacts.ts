import "server-only";

import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { keepInTouchSql } from "@/db/keep-in-touch-sql";
import { contacts, type ContactFrequency } from "@/db/schema";

import { searchWords } from "./search";

export type ContactListItem = {
  id: number;
  name: string;
  about: string | null;
  phone: string | null;
  email: string | null;
};

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

// Contacts sorted alphabetically (Russian collation); `search` filters by name.
export async function listContacts(search = ""): Promise<ContactListItem[]> {
  const normalizedName = sql`replace(lower(${contacts.name}), 'ё', 'е')`;
  const conditions = searchWords(search).map(
    (word) => sql`${normalizedName} like ${`%${escapeLike(word)}%`}`,
  );

  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${contacts.name} collate "ru-RU-x-icu"`, asc(contacts.id));
}

export type DueContact = {
  id: number;
  name: string;
  frequency: ContactFrequency;
  // The later of the last note and the last "Связались"; null if neither is known.
  lastContactAt: Date | null;
  frequencySetAt: Date | null;
};

// "Пора связаться": contacts whose period has run out, the most overdue first.
export async function listDueContacts(): Promise<DueContact[]> {
  const { lastContactAt, dueAt } = keepInTouchSql();
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      frequency: sql<ContactFrequency>`${contacts.contactFrequency}`,
      lastContactAt: sql`${lastContactAt}`.mapWith(contacts.lastNoteAt),
      frequencySetAt: contacts.frequencySetAt,
    })
    .from(contacts)
    .where(and(isNotNull(contacts.contactFrequency), sql`${dueAt} < now()`))
    .orderBy(dueAt, sql`${contacts.name} collate "ru-RU-x-icu"`, asc(contacts.id));
}

export async function countContacts(): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(contacts);
  return value;
}

// Cached per request: the page and its metadata share one query.
export const getContact = cache(async (id: number) => {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
  return contact ?? null;
});

// Parses the id from the URL; returns null for anything that is not a positive integer.
export function parseContactId(value: string): number | null {
  if (!/^\d{1,10}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 && id <= 2_147_483_647 ? id : null;
}
