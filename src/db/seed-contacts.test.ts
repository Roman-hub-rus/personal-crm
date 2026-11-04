import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { db } from "@/db";
import { listContacts } from "@/lib/contacts";
import { listGroups } from "@/lib/groups";
import { insertContact } from "../../test-support/data";
import { signInAs } from "../../vitest.session";
import { getDatabaseUrl } from "./env";
import { seedContacts } from "./seed-contacts";

const OWNER = "owner@example.com";

async function countUsers() {
  const [{ count }] = await db.execute<{ count: number }>(sql`select count(*)::int as count from users`);
  return count;
}

describe("seedContacts", () => {
  test("Демо-данные после входа", async () => {
    const result = await seedContacts(getDatabaseUrl(), 30, OWNER);
    expect(result.inserted).toBe(30);

    // The owner signs in with the email from the settings and sees the demo contacts and groups.
    const { user: owner } = await signInAs(OWNER);
    expect(await listContacts(owner.id)).toHaveLength(30);
    expect((await listGroups(owner.id)).length).toBeGreaterThan(0);

    // Another user sees an empty list.
    const { user: other } = await signInAs("other@example.com");
    expect(await listContacts(other.id)).toEqual([]);
    expect(await listGroups(other.id)).toEqual([]);
  });

  test("Пользователь с этой почтой уже есть", async () => {
    const { user } = await signInAs(OWNER);

    await seedContacts(getDatabaseUrl(), 10, OWNER);

    // The existing user is taken, a second one is not made.
    expect(await countUsers()).toBe(1);
    expect(await listContacts(user.id)).toHaveLength(10);
  });

  test("Почта пишется как угодно", async () => {
    await seedContacts(getDatabaseUrl(), 5, "  Owner@Example.COM ");

    const users = await db.execute<{ email: string }>(sql`select email from users`);
    expect(users.map((row) => row.email)).toEqual([OWNER]);
  });

  test("Почта не задана", async () => {
    await expect(seedContacts(getDatabaseUrl(), 5, "")).rejects.toThrow("OWNER_EMAIL");
    await expect(seedContacts(getDatabaseUrl(), 5, undefined)).rejects.toThrow("OWNER_EMAIL");
    expect(await countUsers()).toBe(0);
  });

  test("Непустая база", async () => {
    const { user } = await signInAs("someone@example.com");
    await insertContact(user.id, "Живой контакт");

    const result = await seedContacts(getDatabaseUrl(), 5, OWNER);

    // Nothing changes: no demo contacts, and the owner is not even created.
    expect(result).toEqual({ inserted: 0, existing: 1 });
    expect(await listContacts(user.id)).toHaveLength(1);
    expect(await countUsers()).toBe(1);
  });
});
