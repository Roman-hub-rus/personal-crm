import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { db } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";

import { createContact, deleteContact, updateContact } from "./actions";

function baseInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Анна Петрова",
    about: "",
    howWeMet: "",
    phone: "",
    email: "",
    frequency: "",
    notes: "",
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
    const [friends] = await db.insert(groups).values({ name: "Друзья" }).returning({ id: groups.id });

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
    const [tennis] = await db.insert(groups).values({ name: "Теннис" }).returning({ id: groups.id });

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
    const [friends] = await db.insert(groups).values({ name: "Друзья" }).returning({ id: groups.id });
    const [tennis] = await db.insert(groups).values({ name: "Теннис" }).returning({ id: groups.id });
    const created = await createContact(baseInput());
    if (!created.ok) throw new Error("unreachable");

    const result = await updateContact(created.id, baseInput({ groupIds: [friends.id, tennis.id] }));

    expect(result.ok).toBe(true);
    expect(await membersOf(friends.id)).toEqual([created.id]);
    expect(await membersOf(tennis.id)).toEqual([created.id]);
  });

  test("Отметил группы и сохранил", async () => {
    const [family] = await db.insert(groups).values({ name: "Семья" }).returning({ id: groups.id });
    const created = await createContact(baseInput());
    if (!created.ok) throw new Error("unreachable");

    await updateContact(created.id, baseInput({ groupIds: [family.id] }));
    const result = await updateContact(created.id, baseInput({ groupIds: [family.id] }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.values.groupIds).toEqual([family.id]);
  });

  test("Убрал контакт из группы", async () => {
    const [family] = await db.insert(groups).values({ name: "Семья" }).returning({ id: groups.id });
    const [tennis] = await db.insert(groups).values({ name: "Теннис" }).returning({ id: groups.id });
    const created = await createContact(baseInput({ groupIds: [family.id, tennis.id] }));
    if (!created.ok) throw new Error("unreachable");

    const result = await updateContact(created.id, baseInput({ groupIds: [family.id] }));

    expect(result.ok).toBe(true);
    expect(await membersOf(tennis.id)).toEqual([]);
    expect(await membersOf(family.id)).toEqual([created.id]);
  });

  test("Удалил контакт из группы", async () => {
    const [tennis] = await db.insert(groups).values({ name: "Теннис" }).returning({ id: groups.id });
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
