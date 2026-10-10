import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { generateFakeContacts } from "./fake-contacts";
import { contacts } from "./schema";

const BATCH_SIZE = 250;

// Inserts test contacts into an empty contacts table.
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
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        await tx.insert(contacts).values(rows.slice(i, i + BATCH_SIZE));
      }
    });
    return { inserted: rows.length, existing };
  } finally {
    await client.end();
  }
}
