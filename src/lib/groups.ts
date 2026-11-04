import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";

export type GroupListItem = { id: number; name: string };
export type GroupWithCount = GroupListItem & { contactCount: number };

// Every function here takes the id of the signed-in user first and works only with that user's groups.

// Groups of the user sorted alphabetically (Russian collation), like contact names.
export async function listGroups(userId: string): Promise<GroupListItem[]> {
  return db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(eq(groups.ownerId, userId))
    .orderBy(sql`${groups.name} collate "ru-RU-x-icu"`, asc(groups.id));
}

// The number of people in a group counts only the user's own contacts.
export async function listGroupsWithCounts(userId: string): Promise<GroupWithCount[]> {
  return db
    .select({ id: groups.id, name: groups.name, contactCount: count(contacts.id) })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .leftJoin(contacts, and(eq(contacts.id, contactGroups.contactId), eq(contacts.ownerId, userId)))
    .where(eq(groups.ownerId, userId))
    .groupBy(groups.id, groups.name)
    .orderBy(sql`${groups.name} collate "ru-RU-x-icu"`, asc(groups.id));
}

export async function getGroup(userId: string, id: number): Promise<GroupListItem | null> {
  const [group] = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(and(eq(groups.id, id), eq(groups.ownerId, userId)));
  return group ?? null;
}
