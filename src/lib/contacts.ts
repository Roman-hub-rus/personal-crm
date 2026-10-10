import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { contacts } from "@/db/schema";

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
