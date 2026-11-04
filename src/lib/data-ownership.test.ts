// What a user sees: their own contacts and groups, and nothing of another user's.

import { describe, expect, test } from "vitest";

import { insertContact, insertGroup, insertOverdueContact } from "../../test-support/data";
import { signInAs } from "../../vitest.session";
import { parseGroupId } from "./contact-groups";
import { countContacts, getContact, listContacts, listDueContacts } from "./contacts";
import { listGroups, listGroupsWithCounts } from "./groups";

async function twoUsers() {
  const a = (await signInAs("a@example.com")).user.id;
  const b = (await signInAs("b@example.com")).user.id;
  return { a, b };
}

describe("contacts of another user", () => {
  test("Контакта другого нет в списке", async () => {
    const { a, b } = await twoUsers();
    await insertContact(a, "Контакт Анны");
    await insertContact(b, "Контакт Бориса");

    expect((await listContacts(b)).map((contact) => contact.name)).toEqual(["Контакт Бориса"]);
    expect(await countContacts(b)).toBe(1);
    expect((await listContacts(a)).map((contact) => contact.name)).toEqual(["Контакт Анны"]);
    expect(await countContacts(a)).toBe(1);
  });

  test("Контакта другого нет в поиске", async () => {
    const { a, b } = await twoUsers();
    await insertContact(a, "Проверка Чужаков");

    expect(await listContacts(b, "Чужаков")).toEqual([]);
    expect((await listContacts(a, "Чужаков")).map((contact) => contact.name)).toEqual(["Проверка Чужаков"]);
  });

  test("Чужие просроченные", async () => {
    const { a, b } = await twoUsers();
    await insertOverdueContact(a, "Просроченный у Анны");

    expect(await listDueContacts(b)).toEqual([]);
    expect(await listDueContacts(a)).toHaveLength(1);
  });

  test("Новый пользователь", async () => {
    const { a, b } = await twoUsers();
    await insertContact(a, "Контакт Анны");

    expect(await countContacts(b)).toBe(0);
    expect(await listContacts(b)).toEqual([]);
  });

  test("Открыл чужой контакт", async () => {
    const { a, b } = await twoUsers();
    const id = await insertContact(a, "Контакт Анны");

    // The same answer as for a contact that does not exist.
    expect(await getContact(b, id)).toBeNull();
    expect(await getContact(b, 999_999)).toBeNull();
    expect((await getContact(a, id))?.name).toBe("Контакт Анны");
  });

  test("Группа другого не фильтрует чужие контакты", async () => {
    const { a, b } = await twoUsers();
    const tennisOfA = await insertGroup(a, "Теннис");
    await insertContact(a, "Игрок А", [tennisOfA]);
    await insertContact(b, "Контакт Бориса");

    // B asks for the group of A by its number: nobody is shown.
    expect(await listContacts(b, "", tennisOfA)).toEqual([]);
    expect(await listDueContacts(b, tennisOfA)).toEqual([]);
  });
});

describe("groups of another user", () => {
  test("Чужих групп не видно", async () => {
    const { a, b } = await twoUsers();
    await insertGroup(a, "Теннис");

    expect(await listGroups(b)).toEqual([]);
    expect(await listGroupsWithCounts(b)).toEqual([]);
    expect((await listGroups(a)).map((group) => group.name)).toEqual(["Теннис"]);
  });

  test("В группе считаются только контакты её владельца", async () => {
    const { a, b } = await twoUsers();
    const tennis = await insertGroup(a, "Теннис");
    await insertContact(a, "Игрок А", [tennis]);
    // A contact of B in the group of A can only appear through a broken write; the count still ignores it.
    await insertContact(b, "Чужой в группе", [tennis]);

    expect(await listGroupsWithCounts(a)).toEqual([{ id: tennis, name: "Теннис", contactCount: 1 }]);
  });

  test("Чужая группа в адресе", async () => {
    const { a, b } = await twoUsers();
    const tennisOfA = await insertGroup(a, "Теннис");
    await insertContact(b, "Контакт Бориса");

    // The number of the group of A in the address of B means "Все": it is not among the groups of B.
    const groupsOfB = await listGroups(b);
    expect(parseGroupId(String(tennisOfA), groupsOfB)).toBeNull();
    expect(
      (await listContacts(b, "", parseGroupId(String(tennisOfA), groupsOfB))).map((contact) => contact.name),
    ).toEqual(["Контакт Бориса"]);
  });
});
