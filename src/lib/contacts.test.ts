import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { db } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";

import { listContacts, listDueContacts } from "./contacts";

async function insertGroup(name: string) {
  const [group] = await db.insert(groups).values({ name }).returning({ id: groups.id });
  return group.id;
}

async function insertContact(name: string, groupIds: number[] = []) {
  const [contact] = await db.insert(contacts).values({ name }).returning({ id: contacts.id });
  if (groupIds.length > 0) {
    await db.insert(contactGroups).values(groupIds.map((groupId) => ({ contactId: contact.id, groupId })));
  }
  return contact.id;
}

describe("listContacts", () => {
  test("возвращает контакты по алфавиту", async () => {
    await db.insert(contacts).values([{ name: "Борис" }, { name: "Анна" }, { name: "Вера" }]);

    const result = await listContacts();

    expect(result.map((contact) => contact.name)).toEqual(["Анна", "Борис", "Вера"]);
  });

  test("фильтрует по имени без учёта регистра и «ё»", async () => {
    await db.insert(contacts).values([{ name: "Алёна Иванова" }, { name: "Елена Петрова" }, { name: "Борис Орлов" }]);

    const result = await listContacts("АЛЕНА");

    expect(result.map((contact) => contact.name)).toEqual(["Алёна Иванова"]);
  });

  test("Выбрал группу", async () => {
    const tennis = await insertGroup("Теннис");
    await insertGroup("Друзья");
    await insertContact("Вера Теннисная", [tennis]);
    await insertContact("Анна Теннисная", [tennis]);
    await insertContact("Борис Вне группы");

    const result = await listContacts("", tennis);

    expect(result.map((contact) => contact.name)).toEqual(["Анна Теннисная", "Вера Теннисная"]);
  });

  test("Вернулся ко всем", async () => {
    const tennis = await insertGroup("Теннис");
    await insertContact("В группе", [tennis]);
    await insertContact("Без группы");

    const result = await listContacts("", null);

    expect(result.map((contact) => contact.name)).toEqual(["Без группы", "В группе"]);
  });

  test("Пустая группа", async () => {
    const empty = await insertGroup("Пустая");
    await insertContact("Кто-то");

    const result = await listContacts("", empty);

    expect(result).toEqual([]);
  });

  test("Поиск в группе", async () => {
    const tennis = await insertGroup("Теннис");
    await insertContact("Анна Теннисная", [tennis]);
    await insertContact("Анна Вне группы");

    const result = await listContacts("анна", tennis);

    expect(result.map((contact) => contact.name)).toEqual(["Анна Теннисная"]);
  });

  test("Ничего не нашли в группе", async () => {
    const tennis = await insertGroup("Теннис");
    await insertContact("Анна Теннисная", [tennis]);

    const result = await listContacts("борис", tennis);

    expect(result).toEqual([]);
  });

  test("Контакт в двух группах", async () => {
    const friends = await insertGroup("Друзья");
    const tennis = await insertGroup("Теннис");
    await insertContact("Анна", [tennis, friends]);

    const [result] = await listContacts();

    expect(result.groups).toEqual(["Друзья", "Теннис"]);
  });

  test("Контакт без групп", async () => {
    await insertContact("Анна");

    const [result] = await listContacts();

    expect(result.groups).toEqual([]);
  });

  test("Удалил контакт, открытый из группы", async () => {
    const tennis = await insertGroup("Теннис");
    const id = await insertContact("Анна", [tennis]);

    await db.delete(contacts).where(eq(contacts.id, id));

    const result = await listContacts("", tennis);

    expect(result).toEqual([]);
  });
});

describe("listDueContacts", () => {
  async function insertOverdue(name: string, groupIds: number[] = []) {
    const [contact] = await db
      .insert(contacts)
      .values({
        name,
        contactFrequency: "week",
        frequencySetAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      })
      .returning({ id: contacts.id });
    if (groupIds.length > 0) {
      await db.insert(contactGroups).values(groupIds.map((groupId) => ({ contactId: contact.id, groupId })));
    }
    return contact.id;
  }

  test("Выбрана группа", async () => {
    const tennis = await insertGroup("Теннис");
    await insertOverdue("Первый", [tennis]);
    await insertOverdue("Второй", [tennis]);
    await insertOverdue("Третий");

    const result = await listDueContacts(tennis);

    expect(result.map((contact) => contact.name)).toEqual(["Первый", "Второй"]);
  });

  test("В группе нет просроченных", async () => {
    const family = await insertGroup("Семья");
    await insertOverdue("Просроченный без группы");

    const result = await listDueContacts(family);

    expect(result).toEqual([]);
  });
});
