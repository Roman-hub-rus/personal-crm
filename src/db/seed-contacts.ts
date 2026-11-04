import { randomUUID } from "node:crypto";

import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { generateFakeContacts } from "./fake-contacts";
import { FAKE_GROUP_NAMES, generateFakeGroupAssignments } from "./fake-groups";
import { normalizeEmail } from "../lib/email";
import { contactGroups, contacts, groups, users } from "./schema";

const BATCH_SIZE = 250;

// Inserts test contacts (and groups for them) into an empty contacts table, for the user with the owner's
// email (the OWNER_EMAIL setting): he is found, or created if nobody has signed in with that email yet.
// If the table already has rows, nothing is changed and `inserted` is 0.
export async function seedContacts(databaseUrl: string, amount: number, ownerEmail: string | undefined) {
  if (!ownerEmail) {
    throw new Error("OWNER_EMAIL is not set. The test contacts need an owner: add the owner's email to .env.");
  }
  const email = normalizeEmail(ownerEmail);
  if (!email) {
    throw new Error("OWNER_EMAIL is not a valid email address.");
  }

  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const db = drizzle(client);
  try {
    const [{ value: existing }] = await db.select({ value: count() }).from(contacts);
    if (existing > 0) {
      return { inserted: 0, existing };
    }

    const rows = generateFakeContacts(amount);
    await db.transaction(async (tx) => {
      const [found] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
      const ownerId = found?.id ?? randomUUID();
      if (!found) {
        // Signed in by the link later, he is this very user (same email).
        await tx.insert(users).values({ id: ownerId, name: "", email, emailVerified: true });
      }

      const contactIds: number[] = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const inserted = await tx
          .insert(contacts)
          .values(rows.slice(i, i + BATCH_SIZE).map((row) => ({ ...row, ownerId })))
          .returning({ id: contacts.id });
        contactIds.push(...inserted.map((row) => row.id));
      }

      const insertedGroups = await tx
        .insert(groups)
        .values(FAKE_GROUP_NAMES.map((name) => ({ ownerId, name })))
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
