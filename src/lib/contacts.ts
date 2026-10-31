import "server-only";

import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { keepInTouchSql } from "@/db/keep-in-touch-sql";
import { contactGroups, contacts, groups, type ContactFrequency } from "@/db/schema";

import { searchWords } from "./search";

export type ContactListItem = {
  id: number;
  name: string;
  about: string | null;
  phone: string | null;
  email: string | null;
  // Group names, alphabetically; empty when the contact is in no group.
  groups: string[];
};

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

// Group names of a contact, alphabetically, as one correlated subquery.
// Table and column names are spelled out (not interpolated as column objects): Drizzle renders
// an interpolated column without its table prefix, which is ambiguous once two tables are joined.
const contactGroupNames = sql<string[]>`coalesce((
  select array_agg(groups.name order by groups.name collate "ru-RU-x-icu")
  from contact_groups
  inner join groups on groups.id = contact_groups.group_id
  where contact_groups.contact_id = contacts.id
), array[]::text[])`;

// True when the contact belongs to the given group.
function inGroup(groupId: number) {
  return sql`exists (
    select 1 from contact_groups
    where contact_groups.contact_id = contacts.id and contact_groups.group_id = ${groupId}
  )`;
}

// Contacts sorted alphabetically (Russian collation); `search` filters by name,
// `groupId` (when given) keeps only the people in that group.
export async function listContacts(search = "", groupId: number | null = null): Promise<ContactListItem[]> {
  const normalizedName = sql`replace(lower(${contacts.name}), 'ё', 'е')`;
  const conditions = searchWords(search).map((word) => sql`${normalizedName} like ${`%${escapeLike(word)}%`}`);
  if (groupId !== null) conditions.push(inGroup(groupId));

  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
      groups: contactGroupNames,
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
// `groupId` (when given) keeps only the overdue people in that group.
export async function listDueContacts(groupId: number | null = null): Promise<DueContact[]> {
  const { lastContactAt, dueAt } = keepInTouchSql();
  const conditions = [isNotNull(contacts.contactFrequency), sql`${dueAt} < now()`];
  if (groupId !== null) conditions.push(inGroup(groupId));

  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      frequency: sql<ContactFrequency>`${contacts.contactFrequency}`,
      lastContactAt: sql`${lastContactAt}`.mapWith(contacts.lastNoteAt),
      frequencySetAt: contacts.frequencySetAt,
    })
    .from(contacts)
    .where(and(...conditions))
    .orderBy(dueAt, sql`${contacts.name} collate "ru-RU-x-icu"`, asc(contacts.id));
}

export async function countContacts(): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(contacts);
  return value;
}

// Cached per request: the page and its metadata share one query.
export const getContact = cache(async (id: number) => {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!contact) return null;

  const contactGroupRows = await db
    .select({ id: groups.id, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(eq(contactGroups.contactId, id))
    .orderBy(sql`${groups.name} collate "ru-RU-x-icu"`);

  return { ...contact, groups: contactGroupRows };
});

// Parses the id from the URL; returns null for anything that is not a positive integer.
export function parseContactId(value: string): number | null {
  if (!/^\d{1,10}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 && id <= 2_147_483_647 ? id : null;
}
