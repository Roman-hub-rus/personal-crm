// Actions of the server on behalf of a user: only their own contacts and groups are found and changed.
// A request with the number of another user's record gets the same answer as for a record that does not exist.

import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { db } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";
import { listContacts } from "@/lib/contacts";
import { listGroups } from "@/lib/groups";
import { insertContact, insertGroup } from "../../test-support/data";
import { signInAs, signOutTestUser } from "../../vitest.session";
import { createContact, deleteContact, markContacted, undoMarkContacted, updateContact } from "./contacts/actions";
import { createGroup, deleteGroup, renameGroup } from "./groups/actions";

function input(overrides: Partial<Record<string, unknown>> = {}) {
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

async function twoUsers() {
  const a = (await signInAs("a@example.com")).user.id;
  const b = (await signInAs("b@example.com")).user.id;
  return { a, b };
}

// The state of a contact or a group, to see that nothing changed.
async function contactRow(id: number) {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
  return row;
}
async function groupRow(id: number) {
  const [row] = await db.select().from(groups).where(eq(groups.id, id));
  return row;
}

describe("the owner of new records", () => {
  test("Добавил контакт", async () => {
    const a = (await signInAs("a@example.com")).user.id;
    const created = await createContact(input({ name: "Новый контакт" }));
    if (!created.ok) throw new Error("unreachable");

    expect((await contactRow(created.id)).ownerId).toBe(a);
    const b = (await signInAs("b@example.com")).user.id;
    expect(await listContacts(b)).toEqual([]);
    expect((await listContacts(a)).map((contact) => contact.name)).toEqual(["Новый контакт"]);
  });

  test("Создал группу из карточки", async () => {
    const a = (await signInAs("a@example.com")).user.id;
    const created = await createContact(input({ newGroups: ["Аналитики"] }));
    expect(created.ok).toBe(true);

    expect((await listGroups(a)).map((group) => group.name)).toEqual(["Аналитики"]);
    const [group] = await db.select().from(groups);
    expect(group.ownerId).toBe(a);
    const b = (await signInAs("b@example.com")).user.id;
    expect(await listGroups(b)).toEqual([]);
  });

  test("Создал группу на странице «Группы»", async () => {
    const a = (await signInAs("a@example.com")).user.id;
    const created = await createGroup("Коллеги");
    if (!created.ok) throw new Error("unreachable");

    expect((await groupRow(created.id)).ownerId).toBe(a);
  });
});

describe("changing another user's contact", () => {
  test("Сохранить чужой контакт", async () => {
    const { a } = await twoUsers();
    const id = await insertContact(a, "Контакт Анны");
    const before = await contactRow(id);

    // B (the last one who signed in) sends the number of the contact of A.
    const result = await updateContact(id, input({ name: "Взломано", notes: "чужая заметка" }));

    expect(result).toEqual({ ok: false, message: "Контакт не найден — возможно, его удалили" });
    expect(await contactRow(id)).toEqual(before);
  });

  test("Удалить чужой контакт", async () => {
    const { a } = await twoUsers();
    const id = await insertContact(a, "Контакт Анны");

    const result = await deleteContact(id);

    expect(result).toEqual({ ok: false, message: "Контакт не найден — возможно, его уже удалили" });
    expect(await contactRow(id)).toBeDefined();
  });

  test("«Связались» у чужого контакта", async () => {
    const { a } = await twoUsers();
    const id = await insertContact(a, "Контакт Анны");
    const before = await contactRow(id);

    const result = await markContacted(id);

    expect(result).toEqual({ ok: false, message: "Контакт не найден — возможно, его удалили" });
    expect((await contactRow(id)).lastContactedAt).toEqual(before.lastContactedAt);
  });

  test("Отмена «Связались» у чужого контакта", async () => {
    const a = (await signInAs("a@example.com")).user.id;
    const id = await insertContact(a, "Контакт Анны");
    const marked = await markContacted(id);
    if (!marked.ok) throw new Error("unreachable");
    const markedMoment = (await contactRow(id)).lastContactedAt;

    await signInAs("b@example.com");
    const result = await undoMarkContacted(id, marked.markedAt, marked.previous);

    expect(result).toEqual({ ok: true, undone: false });
    expect((await contactRow(id)).lastContactedAt).toEqual(markedMoment);
  });

  test("Свой контакт в чужую группу", async () => {
    const a = (await signInAs("a@example.com")).user.id;
    const groupOfA = await insertGroup(a, "Теннис");
    const b = (await signInAs("b@example.com")).user.id;
    const contactOfB = await insertContact(b, "Контакт Бориса");

    const result = await updateContact(contactOfB, input({ name: "Контакт Бориса", groupIds: [groupOfA] }));

    expect(result.ok).toBe(true);
    expect(await db.select().from(contactGroups).where(eq(contactGroups.groupId, groupOfA))).toEqual([]);
    // Creating a contact with the number of a foreign group works the same.
    const created = await createContact(input({ name: "Ещё контакт", groupIds: [groupOfA] }));
    expect(created.ok).toBe(true);
    expect(await db.select().from(contactGroups).where(eq(contactGroups.groupId, groupOfA))).toEqual([]);
  });

  test("Чужой контакт нельзя сохранить в свою группу и забрать себе", async () => {
    const { a, b } = await twoUsers();
    const idOfA = await insertContact(a, "Контакт Анны");
    const groupOfB = await insertGroup(b, "Мои");

    const result = await updateContact(idOfA, input({ groupIds: [groupOfB] }));

    expect(result.ok).toBe(false);
    expect(await db.select().from(contactGroups)).toEqual([]);
  });
});

describe("changing another user's group", () => {
  test("Переименовать чужую группу", async () => {
    const { a } = await twoUsers();
    const id = await insertGroup(a, "Теннис");

    const result = await renameGroup(id, "Взломано");

    expect(result).toEqual({ ok: false, message: "Группа не найдена — возможно, её удалили" });
    expect((await groupRow(id)).name).toBe("Теннис");
  });

  test("Удалить чужую группу", async () => {
    const { a } = await twoUsers();
    const group = await insertGroup(a, "Теннис");
    const contact = await insertContact(a, "Игрок", [group]);

    const result = await deleteGroup(group);

    expect(result).toEqual({ ok: false, message: "Группа не найдена — возможно, её удалили" });
    expect(await groupRow(group)).toBeDefined();
    expect(await db.select().from(contactGroups).where(eq(contactGroups.contactId, contact))).toHaveLength(1);
  });
});

describe("a request without sign-in", () => {
  test("Запрос без входа", async () => {
    const a = (await signInAs("a@example.com")).user.id;
    const contact = await insertContact(a, "Контакт Анны");
    const group = await insertGroup(a, "Теннис");
    const contactBefore = await contactRow(contact);
    const groupBefore = await groupRow(group);

    signOutTestUser();
    const attempts = [
      () => createContact(input({ name: "Без входа" })),
      () => updateContact(contact, input({ name: "Без входа" })),
      () => deleteContact(contact),
      () => markContacted(contact),
      () => undoMarkContacted(contact, "2026-01-01T00:00:00.000000Z", null),
      () => createGroup("Без входа"),
      () => renameGroup(group, "Без входа"),
      () => deleteGroup(group),
    ];
    for (const attempt of attempts) {
      // The server sends the visitor to the sign-in page instead of doing anything.
      await expect(attempt()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    }

    expect(await contactRow(contact)).toEqual(contactBefore);
    expect(await groupRow(group)).toEqual(groupBefore);
    expect(await db.select().from(contacts)).toHaveLength(1);
    expect(await db.select().from(groups)).toHaveLength(1);
  });
});

describe("groups with the same name for different users", () => {
  test("Такая же группа у другого пользователя", async () => {
    const a = (await signInAs("a@example.com")).user.id;
    const friendsOfA = await insertGroup(a, "Друзья");
    const contactOfA = await insertContact(a, "Друг Анны", [friendsOfA]);

    const b = (await signInAs("b@example.com")).user.id;
    const created = await createGroup("Друзья");

    // B gets a group of their own, and the group of A keeps its people.
    expect(created).toMatchObject({ ok: true, name: "Друзья" });
    if (!created.ok) throw new Error("unreachable");
    expect(created.id).not.toBe(friendsOfA);
    expect((await groupRow(created.id)).ownerId).toBe(b);
    expect((await listGroups(a)).map((group) => group.id)).toEqual([friendsOfA]);
    expect(await db.select().from(contactGroups).where(eq(contactGroups.contactId, contactOfA))).toHaveLength(1);
  });

  test("Переименовал в название группы другого пользователя", async () => {
    const a = (await signInAs("a@example.com")).user.id;
    const tennisOfA = await insertGroup(a, "Теннис");
    const b = (await signInAs("b@example.com")).user.id;
    const groupOfB = await insertGroup(b, "Спорт");

    const result = await renameGroup(groupOfB, "Теннис");

    expect(result).toEqual({ ok: true, name: "Теннис" });
    expect((await groupRow(groupOfB)).name).toBe("Теннис");
    expect((await groupRow(tennisOfA)).name).toBe("Теннис");
  });

  test("Вписал в карточке название группы другого пользователя", async () => {
    const a = (await signInAs("a@example.com")).user.id;
    const tennisOfA = await insertGroup(a, "Теннис");
    const memberOfA = await insertContact(a, "Игрок А", [tennisOfA]);
    const b = (await signInAs("b@example.com")).user.id;
    const contactOfB = await insertContact(b, "Игрок Б");

    const result = await updateContact(contactOfB, input({ name: "Игрок Б", newGroups: ["теннис"] }));

    expect(result.ok).toBe(true);
    // B has a group of their own with the contact, and nobody was added to the group of A.
    const groupsOfB = await listGroups(b);
    expect(groupsOfB.map((group) => group.name)).toEqual(["теннис"]);
    const members = await db.select().from(contactGroups).where(eq(contactGroups.groupId, tennisOfA));
    expect(members.map((row) => row.contactId)).toEqual([memberOfA]);
    const ownMembers = await db.select().from(contactGroups).where(eq(contactGroups.groupId, groupsOfB[0].id));
    expect(ownMembers.map((row) => row.contactId)).toEqual([contactOfB]);
  });

  test("Такая группа уже есть — среди групп того же пользователя", async () => {
    const a = (await signInAs("a@example.com")).user.id;
    await insertGroup(a, "Теннис");

    expect(await createGroup("теннис")).toEqual({ ok: false, message: "Группа «Теннис» уже есть" });
  });
});
