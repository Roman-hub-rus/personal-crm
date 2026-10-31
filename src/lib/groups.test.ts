import { describe, expect, test } from "vitest";

import { db } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";

import { listGroupsWithCounts } from "./groups";

describe("listGroupsWithCounts", () => {
  test("Список групп", async () => {
    const [tennis, analytics] = await db
      .insert(groups)
      .values([{ name: "Теннис" }, { name: "Аналитики" }, { name: "Друзья" }])
      .returning({ id: groups.id, name: groups.name });
    const [person1, person2, person3] = await db
      .insert(contacts)
      .values([{ name: "Контакт 1" }, { name: "Контакт 2" }, { name: "Контакт 3" }])
      .returning({ id: contacts.id });

    await db.insert(contactGroups).values([
      { contactId: person1.id, groupId: tennis.id },
      { contactId: person2.id, groupId: tennis.id },
      { contactId: person3.id, groupId: tennis.id },
      { contactId: person1.id, groupId: analytics.id },
    ]);

    const result = await listGroupsWithCounts();

    expect(result).toEqual([
      { id: analytics.id, name: "Аналитики", contactCount: 1 },
      { id: expect.any(Number), name: "Друзья", contactCount: 0 },
      { id: tennis.id, name: "Теннис", contactCount: 3 },
    ]);
  });
});
