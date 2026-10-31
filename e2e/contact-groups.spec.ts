// A group from start to finish, from openspec/specs/contact-groups/spec.md: created on the "Группы" page,
// ticked in contact cards, chosen on the home page, and the same address in another browser.
// The test removes its contacts and group at the end, so main-scenario.spec.ts still sees exactly
// the seeded contacts.

import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

import { E2E_SEEDED_CONTACTS, getTestDatabaseUrl, splitTestDatabaseUrl } from "./test-database";

const RUN_TAG = Date.now().toString().slice(-6);
const groupName = `Теннис ${RUN_TAG}`;
const members = [`Группа Подачина ${RUN_TAG}`, `Группа Сеткина ${RUN_TAG}`];

test.afterAll(async () => {
  const url = getTestDatabaseUrl();
  splitTestDatabaseUrl(url); // Throws unless this is the "*_e2e" database.
  const db = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await db`delete from contacts where name = any(${members})`;
    await db`delete from groups where name = ${groupName}`;
  } finally {
    await db.end();
  }
});

// Adds a contact through the form; returns its id.
async function addContact(page: Page, name: string) {
  await page.goto("/contacts/new");
  await page.getByLabel("Имя").fill(name);
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  return Number(new URL(page.url()).searchParams.get("added"));
}

function groupChip(page: Page) {
  return page.getByRole("group", { name: "Группы" }).getByRole("button", { name: groupName, exact: true });
}

async function expectOnlyMembers(page: Page) {
  await expect(page.getByRole("link", { name: groupName, exact: true })).toHaveAttribute("aria-current", "true");
  const rows = page.getByTestId("contact-row");
  await expect(rows).toHaveCount(members.length);
  for (const name of members) {
    // The row carries the group label.
    await expect(rows.filter({ hasText: name })).toContainText(groupName);
  }
  const total = (E2E_SEEDED_CONTACTS + members.length).toLocaleString("ru-RU");
  await expect(page.getByText(`Найдено: ${members.length} контакта из ${total}`)).toBeVisible();
}

test("created a group -> ticked it in cards -> chose it on the home page; another browser sees the same", async ({
  page,
  browser,
}) => {
  const ids = [];
  for (const name of members) ids.push(await addContact(page, name));

  // The "Группы" page from the header: create the group.
  await page.goto("/");
  await page.getByRole("link", { name: "Группы", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Группы" })).toBeVisible();
  await page.getByRole("textbox", { name: "Новая группа" }).fill(groupName);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByText(`Группа «${groupName}» создана`)).toBeVisible();
  await expect(page.getByRole("link", { name: `${groupName} — 0 контактов` })).toBeVisible();

  // Tick the group in each card and save; it stays ticked after a reload.
  for (const id of ids) {
    await page.goto(`/contacts/${id}`);
    await expect(groupChip(page)).toHaveAttribute("aria-pressed", "false");
    await groupChip(page).click();
    await expect(groupChip(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Есть несохранённые изменения")).toBeVisible();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Изменения сохранены")).toBeVisible();
    await page.reload();
    await expect(groupChip(page)).toHaveAttribute("aria-pressed", "true");
  }

  // The "Группы" page counts the people; a click on the group opens the home page with it chosen.
  await page.goto("/groups");
  await page.getByRole("link", { name: `${groupName} — 2 контакта` }).click();
  await expect(page).toHaveURL(/\/\?group=\d+$/);
  await expectOnlyMembers(page);
  const groupUrl = page.url();

  // "Все" brings back the whole list.
  await page.getByRole("link", { name: "Все", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("contact-row")).toHaveCount(E2E_SEEDED_CONTACTS + members.length);

  // The filter row on the home page chooses the group too.
  await page.getByRole("link", { name: groupName, exact: true }).click();
  await expect(page).toHaveURL(groupUrl);
  await expectOnlyMembers(page);

  // Browser B (separate profile: no shared cookies or storage) opens the same address.
  const contextB = await browser.newContext();
  const other = await contextB.newPage();
  await other.goto(groupUrl);
  await expectOnlyMembers(other);
  await contextB.close();
});
