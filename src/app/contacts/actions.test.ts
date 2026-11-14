import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";
import { signInAs } from "../../../vitest.session";

import { createContact, deleteContact, updateContact } from "./actions";

// Every test acts as one signed-in user; the groups it inserts directly belong to that user.
let userId: string;
beforeEach(async () => {
  userId = (await signInAs("anna@example.com")).user.id;
});

function baseInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Анна Петрова",
    about: "",
    howWeMet: "",
    phone: "",
    email: "",
    frequency: "",
    notes: "",
    birthDay: "",
    birthMonth: "",
    birthYear: "",
    groupIds: [],
    newGroups: [],
    ...overrides,
  };
}

async function membersOf(groupId: number): Promise<number[]> {
  const rows = await db
    .select({ contactId: contactGroups.contactId })
    .from(contactGroups)
    .where(eq(contactGroups.groupId, groupId));
  return rows.map((row) => row.contactId);
}

describe("createContact", () => {
  test("Новый контакт с группами", async () => {
    const [friends] = await db.insert(groups).values({ ownerId: userId, name: "Друзья" }).returning({ id: groups.id });

    const result = await createContact(baseInput({ groupIds: [friends.id] }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(await membersOf(friends.id)).toEqual([result.id]);
  });

  test("Создал группу в карточке", async () => {
    const result = await createContact(baseInput({ newGroups: ["Аналитики"] }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    const [analytics] = await db.select().from(groups).where(eq(groups.name, "Аналитики"));
    expect(analytics).toBeDefined();
    expect(await membersOf(analytics.id)).toEqual([result.id]);
  });

  test("Вписал название существующей группы", async () => {
    const [tennis] = await db.insert(groups).values({ ownerId: userId, name: "Теннис" }).returning({ id: groups.id });

    const result = await createContact(baseInput({ newGroups: ["теннис"] }));

    expect(result.ok).toBe(true);
    const allGroups = await db.select().from(groups);
    expect(allGroups).toHaveLength(1);
    if (!result.ok) throw new Error("unreachable");
    expect(await membersOf(tennis.id)).toEqual([result.id]);
  });

  test("неверное название в newGroups → ошибка поля groups и ничего не сохранено", async () => {
    const result = await createContact(baseInput({ newGroups: ["   "] }));

    expect(result).toMatchObject({ ok: false, fieldErrors: { groups: "Введите название группы" } });
    expect(await db.select().from(contacts)).toHaveLength(0);
  });

  test("id удалённой группы молча отбрасывается", async () => {
    const result = await createContact(baseInput({ groupIds: [999] }));

    expect(result.ok).toBe(true);
    const links = await db.select().from(contactGroups);
    expect(links).toHaveLength(0);
  });

  test("Контакт создан с заметкой", async () => {
    const result = await createContact(baseInput({ notes: "Познакомились на конференции" }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    const [stored] = await db
      .select({ lastNoteAt: contacts.lastNoteAt, createdAt: contacts.createdAt })
      .from(contacts)
      .where(eq(contacts.id, result.id));
    expect(stored.lastNoteAt).toEqual(stored.createdAt);
  });

  test("Контакт создан без заметок", async () => {
    const result = await createContact(baseInput({ notes: "" }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    const [stored] = await db
      .select({ lastNoteAt: contacts.lastNoteAt })
      .from(contacts)
      .where(eq(contacts.id, result.id));
    expect(stored.lastNoteAt).toBeNull();
  });
});

describe("updateContact", () => {
  test("Контакт в нескольких группах", async () => {
    const [friends] = await db.insert(groups).values({ ownerId: userId, name: "Друзья" }).returning({ id: groups.id });
    const [tennis] = await db.insert(groups).values({ ownerId: userId, name: "Теннис" }).returning({ id: groups.id });
    const created = await createContact(baseInput());
    if (!created.ok) throw new Error("unreachable");

    const result = await updateContact(created.id, baseInput({ groupIds: [friends.id, tennis.id] }));

    expect(result.ok).toBe(true);
    expect(await membersOf(friends.id)).toEqual([created.id]);
    expect(await membersOf(tennis.id)).toEqual([created.id]);
  });

  test("Отметил группы и сохранил", async () => {
    const [family] = await db.insert(groups).values({ ownerId: userId, name: "Семья" }).returning({ id: groups.id });
    const created = await createContact(baseInput());
    if (!created.ok) throw new Error("unreachable");

    await updateContact(created.id, baseInput({ groupIds: [family.id] }));
    const result = await updateContact(created.id, baseInput({ groupIds: [family.id] }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.values.groupIds).toEqual([family.id]);
  });

  test("Убрал контакт из группы", async () => {
    const [family] = await db.insert(groups).values({ ownerId: userId, name: "Семья" }).returning({ id: groups.id });
    const [tennis] = await db.insert(groups).values({ ownerId: userId, name: "Теннис" }).returning({ id: groups.id });
    const created = await createContact(baseInput({ groupIds: [family.id, tennis.id] }));
    if (!created.ok) throw new Error("unreachable");

    const result = await updateContact(created.id, baseInput({ groupIds: [family.id] }));

    expect(result.ok).toBe(true);
    expect(await membersOf(tennis.id)).toEqual([]);
    expect(await membersOf(family.id)).toEqual([created.id]);
  });

  test("Удалил контакт из группы", async () => {
    const [tennis] = await db.insert(groups).values({ ownerId: userId, name: "Теннис" }).returning({ id: groups.id });
    const first = await createContact(baseInput({ name: "Первый", groupIds: [tennis.id] }));
    const second = await createContact(baseInput({ name: "Второй", groupIds: [tennis.id] }));
    const third = await createContact(baseInput({ name: "Третий", groupIds: [tennis.id] }));
    if (!first.ok || !second.ok || !third.ok) throw new Error("unreachable");

    await deleteContact(first.id);

    expect(await membersOf(tennis.id)).toEqual([second.id, third.id]);
  });

  test("неверное название в newGroups → ошибка поля groups и ничего не сохранено", async () => {
    const created = await createContact(baseInput({ name: "Исходное" }));
    if (!created.ok) throw new Error("unreachable");

    const result = await updateContact(created.id, baseInput({ name: "Новое имя", newGroups: ["а".repeat(51)] }));

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { groups: "Название слишком длинное — не больше 50 символов" },
    });
    const [stillStored] = await db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, created.id));
    expect(stillStored.name).toBe("Исходное");
  });

  test("id удалённой группы молча отбрасывается", async () => {
    const created = await createContact(baseInput());
    if (!created.ok) throw new Error("unreachable");

    const result = await updateContact(created.id, baseInput({ groupIds: [999] }));

    expect(result.ok).toBe(true);
    expect(await db.select().from(contactGroups)).toHaveLength(0);
  });
});

describe("День рождения", () => {
  async function storedBirthday(id: number) {
    const [row] = await db
      .select({ day: contacts.birthDay, month: contacts.birthMonth, year: contacts.birthYear })
      .from(contacts)
      .where(eq(contacts.id, id));
    return row;
  }

  test("Указал день рождения с годом", async () => {
    const created = await createContact(baseInput());
    if (!created.ok) throw new Error("unreachable");

    const result = await updateContact(created.id, baseInput({ birthDay: "17", birthMonth: "11", birthYear: "1991" }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.values).toMatchObject({ birthDay: "17", birthMonth: "11", birthYear: "1991" });
    expect(await storedBirthday(created.id)).toEqual({ day: 17, month: 11, year: 1991 });
  });

  test("Указал день рождения без года", async () => {
    const created = await createContact(baseInput());
    if (!created.ok) throw new Error("unreachable");

    const result = await updateContact(created.id, baseInput({ birthDay: "3", birthMonth: "3", birthYear: "" }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.values).toMatchObject({ birthDay: "3", birthMonth: "3", birthYear: "" });
    expect(await storedBirthday(created.id)).toEqual({ day: 3, month: 3, year: null });
  });

  test("День рождения при создании контакта", async () => {
    const result = await createContact(baseInput({ birthDay: "5", birthMonth: "5", birthYear: "1988" }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(await storedBirthday(result.id)).toEqual({ day: 5, month: 5, year: 1988 });
  });

  test("Убрал день рождения", async () => {
    const created = await createContact(baseInput({ birthDay: "17", birthMonth: "11", birthYear: "1991" }));
    if (!created.ok) throw new Error("unreachable");

    const result = await updateContact(created.id, baseInput({ birthDay: "", birthMonth: "", birthYear: "" }));

    expect(result.ok).toBe(true);
    expect(await storedBirthday(created.id)).toEqual({ day: null, month: null, year: null });
  });

  test("Неверная дата в обход формы", async () => {
    const created = await createContact(baseInput({ birthDay: "17", birthMonth: "11", birthYear: "1991" }));
    if (!created.ok) throw new Error("unreachable");
    const [before] = await db.select().from(contacts).where(eq(contacts.id, created.id));

    const result = await updateContact(created.id, baseInput({ name: "Новое имя", birthDay: "31", birthMonth: "4" }));

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { birthday: "Такой даты нет — проверьте день и месяц" },
    });
    const [after] = await db.select().from(contacts).where(eq(contacts.id, created.id));
    expect(after).toEqual(before);
  });

  test("неверная дата при создании — контакт не создан", async () => {
    const result = await createContact(baseInput({ birthDay: "12", birthMonth: "" }));

    expect(result).toMatchObject({ ok: false, fieldErrors: { birthday: "Укажите и день, и месяц" } });
    expect(await db.select().from(contacts)).toHaveLength(0);
  });
});
