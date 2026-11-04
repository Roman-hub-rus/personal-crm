import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { contacts } from "@/db/schema";
import {
  insertContact as insertContactFor,
  insertGroup as insertGroupFor,
  insertOverdueContact,
} from "../../test-support/data";
import { signInAs } from "../../vitest.session";

import { listContacts, listDueContacts } from "./contacts";

// Every test works with the contacts of one user.
let userId: string;
beforeEach(async () => {
  userId = (await signInAs("anna@example.com")).user.id;
});

const insertGroup = (name: string) => insertGroupFor(userId, name);
const insertContact = (name: string, groupIds: number[] = []) => insertContactFor(userId, name, groupIds);

describe("listContacts", () => {
  test("возвращает контакты по алфавиту", async () => {
    await db
      .insert(contacts)
      .values([{ name: "Борис" }, { name: "Анна" }, { name: "Вера" }].map((row) => ({ ...row, ownerId: userId })));

    const result = await listContacts(userId);

    expect(result.map((contact) => contact.name)).toEqual(["Анна", "Борис", "Вера"]);
  });

  test("фильтрует по имени без учёта регистра и «ё»", async () => {
    await db.insert(contacts).values(
      [{ name: "Алёна Иванова" }, { name: "Елена Петрова" }, { name: "Борис Орлов" }].map((row) => ({
        ...row,
        ownerId: userId,
      })),
    );

    const result = await listContacts(userId, "АЛЕНА");

    expect(result.map((contact) => contact.name)).toEqual(["Алёна Иванова"]);
  });

  test("Выбрал группу", async () => {
    const tennis = await insertGroup("Теннис");
    await insertGroup("Друзья");
    await insertContact("Вера Теннисная", [tennis]);
    await insertContact("Анна Теннисная", [tennis]);
    await insertContact("Борис Вне группы");

    const result = await listContacts(userId, "", tennis);

    expect(result.map((contact) => contact.name)).toEqual(["Анна Теннисная", "Вера Теннисная"]);
  });

  test("Вернулся ко всем", async () => {
    const tennis = await insertGroup("Теннис");
    await insertContact("В группе", [tennis]);
    await insertContact("Без группы");

    const result = await listContacts(userId, "", null);

    expect(result.map((contact) => contact.name)).toEqual(["Без группы", "В группе"]);
  });

  test("Пустая группа", async () => {
    const empty = await insertGroup("Пустая");
    await insertContact("Кто-то");

    const result = await listContacts(userId, "", empty);

    expect(result).toEqual([]);
  });

  test("Поиск в группе", async () => {
    const tennis = await insertGroup("Теннис");
    await insertContact("Анна Теннисная", [tennis]);
    await insertContact("Анна Вне группы");

    const result = await listContacts(userId, "анна", tennis);

    expect(result.map((contact) => contact.name)).toEqual(["Анна Теннисная"]);
  });

  test("Ничего не нашли в группе", async () => {
    const tennis = await insertGroup("Теннис");
    await insertContact("Анна Теннисная", [tennis]);

    const result = await listContacts(userId, "борис", tennis);

    expect(result).toEqual([]);
  });

  test("Контакт в двух группах", async () => {
    const friends = await insertGroup("Друзья");
    const tennis = await insertGroup("Теннис");
    await insertContact("Анна", [tennis, friends]);

    const [result] = await listContacts(userId);

    expect(result.groups).toEqual(["Друзья", "Теннис"]);
  });

  test("Контакт без групп", async () => {
    await insertContact("Анна");

    const [result] = await listContacts(userId);

    expect(result.groups).toEqual([]);
  });

  test("Удалил контакт, открытый из группы", async () => {
    const tennis = await insertGroup("Теннис");
    const id = await insertContact("Анна", [tennis]);

    await db.delete(contacts).where(eq(contacts.id, id));

    const result = await listContacts(userId, "", tennis);

    expect(result).toEqual([]);
  });
});

describe("listDueContacts", () => {
  const insertOverdue = (name: string, groupIds: number[] = []) => insertOverdueContact(userId, name, groupIds);

  test("Выбрана группа", async () => {
    const tennis = await insertGroup("Теннис");
    await insertOverdue("Первый", [tennis]);
    await insertOverdue("Второй", [tennis]);
    await insertOverdue("Третий");

    const result = await listDueContacts(userId, tennis);

    expect(result.map((contact) => contact.name)).toEqual(["Первый", "Второй"]);
  });

  test("В группе нет просроченных", async () => {
    const family = await insertGroup("Семья");
    await insertOverdue("Просроченный без группы");

    const result = await listDueContacts(userId, family);

    expect(result).toEqual([]);
  });
});
