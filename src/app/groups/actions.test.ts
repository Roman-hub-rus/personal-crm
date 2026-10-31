import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { db } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";

import { createGroup, deleteGroup, renameGroup } from "./actions";

describe("createGroup", () => {
  test("Пустое название", async () => {
    const result = await createGroup("   ");
    expect(result).toEqual({ ok: false, message: "Введите название группы" });
  });

  test("Слишком длинное название", async () => {
    const result = await createGroup("а".repeat(51));
    expect(result).toEqual({ ok: false, message: "Название слишком длинное — не больше 50 символов" });
  });

  test("Пробелы по краям", async () => {
    const result = await createGroup("  Теннис  ");
    expect(result).toMatchObject({ ok: true, name: "Теннис" });
  });

  test("Такая группа уже есть", async () => {
    await db.insert(groups).values({ name: "Теннис" });

    const result = await createGroup("теннис");

    expect(result).toEqual({ ok: false, message: "Группа «Теннис» уже есть" });
  });

  test("Создал группу на странице", async () => {
    const result = await createGroup("Коллеги");

    expect(result).toMatchObject({ ok: true, name: "Коллеги" });
    const rows = await db.select({ name: groups.name }).from(groups);
    expect(rows.map((row) => row.name)).toEqual(["Коллеги"]);
  });
});

describe("renameGroup", () => {
  test("Переименовал группу", async () => {
    const [tennis] = await db.insert(groups).values({ name: "Теннис" }).returning({ id: groups.id });
    const [p1, p2, p3] = await db
      .insert(contacts)
      .values([{ name: "Контакт 1" }, { name: "Контакт 2" }, { name: "Контакт 3" }])
      .returning({ id: contacts.id });
    await db.insert(contactGroups).values([
      { contactId: p1.id, groupId: tennis.id },
      { contactId: p2.id, groupId: tennis.id },
      { contactId: p3.id, groupId: tennis.id },
    ]);

    const result = await renameGroup(tennis.id, "Большой теннис");

    expect(result).toEqual({ ok: true, name: "Большой теннис" });
    const members = await db.select().from(contactGroups).where(eq(contactGroups.groupId, tennis.id));
    expect(members).toHaveLength(3);
  });

  test("Название занято другой группой", async () => {
    await db.insert(groups).values({ name: "Теннис" });
    const [friends] = await db.insert(groups).values({ name: "Друзья" }).returning({ id: groups.id });

    const result = await renameGroup(friends.id, "теннис");

    expect(result).toEqual({ ok: false, message: "Группа «Теннис» уже есть" });
    const [stillFriends] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, friends.id));
    expect(stillFriends.name).toBe("Друзья");
  });

  test("Сменил только регистр", async () => {
    const [tennis] = await db.insert(groups).values({ name: "теннис" }).returning({ id: groups.id });

    const result = await renameGroup(tennis.id, "Теннис");

    expect(result).toEqual({ ok: true, name: "Теннис" });
  });
});

describe("deleteGroup", () => {
  test("Удалил группу", async () => {
    const [tennis] = await db.insert(groups).values({ name: "Теннис" }).returning({ id: groups.id });
    const [p1, p2, p3] = await db
      .insert(contacts)
      .values([{ name: "Контакт 1" }, { name: "Контакт 2" }, { name: "Контакт 3" }])
      .returning({ id: contacts.id });
    await db.insert(contactGroups).values([
      { contactId: p1.id, groupId: tennis.id },
      { contactId: p2.id, groupId: tennis.id },
      { contactId: p3.id, groupId: tennis.id },
    ]);

    const result = await deleteGroup(tennis.id);

    expect(result).toEqual({ ok: true, name: "Теннис" });
    const remainingGroups = await db.select().from(groups);
    expect(remainingGroups).toHaveLength(0);
    const remainingContacts = await db.select().from(contacts);
    expect(remainingContacts).toHaveLength(3);
  });
});
