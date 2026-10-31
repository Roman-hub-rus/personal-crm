import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { generateFakeContacts } from "./fake-contacts";
import { FAKE_GROUP_NAMES, generateFakeGroupAssignments } from "./fake-groups";
import { contactGroups, contacts, groups } from "./schema";

const BATCH_SIZE = 250;

// Inserts test contacts (and groups for them) into an empty contacts table.
// If the table already has rows, nothing is changed and `inserted` is 0.
export async function seedContacts(databaseUrl: string, amount: number) {
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const db = drizzle(client);
  try {
    const [{ value: existing }] = await db.select({ value: count() }).from(contacts);
    if (existing > 0) {
      return { inserted: 0, existing };
    }

    const rows = generateFakeContacts(amount);
    await db.transaction(async (tx) => {
      const contactIds: number[] = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const inserted = await tx
          .insert(contacts)
          .values(rows.slice(i, i + BATCH_SIZE))
          .returning({ id: contacts.id });
        contactIds.push(...inserted.map((row) => row.id));
      }

      const insertedGroups = await tx
        .insert(groups)
        .values(FAKE_GROUP_NAMES.map((name) => ({ name })))
        .returning({ id: groups.id });
      const assignments = generateFakeGroupAssignments(rows.length);
      if (assignments.length > 0) {
        await tx.insert(contactGroups).values(
          assignments.map(({ contactIndex, groupIndex }) => ({
            contactId: contactIds[contactIndex],
            groupId: insertedGroups[groupIndex].id,
          })),
        );
      }
    });
    return { inserted: rows.length, existing };
  } finally {
    await client.end();
  }
}
