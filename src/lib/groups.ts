import "server-only";

import { asc, count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { contactGroups, groups } from "@/db/schema";

export type GroupListItem = { id: number; name: string };
export type GroupWithCount = GroupListItem & { contactCount: number };

// Groups sorted alphabetically (Russian collation), like contact names.
export async function listGroups(): Promise<GroupListItem[]> {
  return db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .orderBy(sql`${groups.name} collate "ru-RU-x-icu"`, asc(groups.id));
}

export async function listGroupsWithCounts(): Promise<GroupWithCount[]> {
  return db
    .select({ id: groups.id, name: groups.name, contactCount: count(contactGroups.contactId) })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .groupBy(groups.id, groups.name)
    .orderBy(sql`${groups.name} collate "ru-RU-x-icu"`, asc(groups.id));
}

export async function getGroup(id: number): Promise<GroupListItem | null> {
  const [group] = await db.select({ id: groups.id, name: groups.name }).from(groups).where(eq(groups.id, id));
  return group ?? null;
}
