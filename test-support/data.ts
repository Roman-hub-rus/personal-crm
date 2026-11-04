// Test data written straight to the database, on behalf of an owner (the id of a user made with signInAs).

import { db } from "@/db";
import { contactGroups, contacts, groups, type ContactFrequency } from "@/db/schema";

export async function insertGroup(ownerId: string, name: string) {
  const [group] = await db.insert(groups).values({ ownerId, name }).returning({ id: groups.id });
  return group.id;
}

export async function insertContact(ownerId: string, name: string, groupIds: number[] = []) {
  const [contact] = await db.insert(contacts).values({ ownerId, name }).returning({ id: contacts.id });
  if (groupIds.length > 0) {
    await db.insert(contactGroups).values(groupIds.map((groupId) => ({ contactId: contact.id, groupId })));
  }
  return contact.id;
}

// A contact whose "keep in touch" period ran out long ago, so it is in "Пора связаться".
export async function insertOverdueContact(ownerId: string, name: string, groupIds: number[] = []) {
  const frequency: ContactFrequency = "week";
  const [contact] = await db
    .insert(contacts)
    .values({
      ownerId,
      name,
      contactFrequency: frequency,
      frequencySetAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    })
    .returning({ id: contacts.id });
  if (groupIds.length > 0) {
    await db.insert(contactGroups).values(groupIds.map((groupId) => ({ contactId: contact.id, groupId })));
  }
  return contact.id;
}
