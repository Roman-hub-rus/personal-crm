// The main scenario and success criteria from specs/01-продуктовая-идея.md.

import { expect, test } from "@playwright/test";

import { E2E_SEEDED_CONTACTS } from "./test-database";

test.describe.configure({ mode: "serial" });

test("opened -> the list shows all contacts", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
  await expect(page.getByTestId("contacts-total")).toHaveText(/^1\s000 контактов$/);
  await expect(page.getByTestId("contact-row")).toHaveCount(E2E_SEEDED_CONTACTS);
});

test("a contact without a name is not created", async ({ page }) => {
  await page.goto("/contacts/new");
  await page.getByRole("button", { name: "Добавить контакт" }).click();

  await expect(page.getByText("Укажите имя")).toBeVisible();
  await expect(page).toHaveURL(/\/contacts\/new$/);
});

test("search ignores case and treats ё as е", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill("алена");

  await expect(page).toHaveURL(/\?q=/);
  const rows = page.getByTestId("contact-row");
  await expect(rows.first()).toBeVisible();
  for (const text of await rows.allInnerTexts()) {
    expect(text).toMatch(/Ал[её]на/);
  }
});

test("added a contact -> found it by name -> appended a note -> saved; another browser sees the same", async ({
  browser,
}) => {
  const suffix = Date.now().toString().slice(-6);
  const name = `Проверка Сценарьева ${suffix}`;
  const firstNote = "08.10.2026 — Познакомились, договорились созвониться на неделе.";
  const secondNote = "09.10.2026 — Созвонились, встречаемся в субботу в 12:00.";

  // Browser A: add a contact.
  const contextA = await browser.newContext();
  const page = await contextA.newPage();
  await page.goto("/");
  await page.getByRole("link", { name: "Добавить контакт" }).click();
  await page.getByLabel("Имя").fill(name);
  await page.getByLabel("Кто это").fill("Тестовый контакт");
  await page.getByLabel("Телефон").fill("+7 900 000-00-00");
  await page.getByLabel("Заметки").fill(firstNote);
  await page.getByRole("button", { name: "Добавить контакт" }).click();

  // It appears in the list.
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  await expect(page.getByText(`Контакт «${name}» добавлен`)).toBeVisible();
  await expect(page.getByTestId("contact-row").filter({ hasText: name })).toBeInViewport();
  await expect(page.getByTestId("contact-row")).toHaveCount(E2E_SEEDED_CONTACTS + 1);

  // Find it by (part of) the name and open the card.
  await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill(`сценарьева ${suffix}`);
  await expect(page.getByTestId("contact-row")).toHaveCount(1);
  await page.getByTestId("contact-row").click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByLabel("Заметки")).toHaveValue(firstNote);

  // Append a note after the conversation and save.
  const notes = page.getByLabel("Заметки");
  await notes.focus();
  await notes.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
  await notes.pressSequentially(`\n\n${secondNote}`);
  await expect(page.getByText("Есть несохранённые изменения")).toBeVisible();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Изменения сохранены")).toBeVisible();
  await expect(page.getByText(/^Сохранено/)).toBeVisible();

  // The change is stored on the server: it survives a reload.
  const expectedNotes = `${firstNote}\n\n${secondNote}`;
  await page.reload();
  await expect(page.getByLabel("Заметки")).toHaveValue(expectedNotes);

  // Browser B (separate profile: no shared cookies or storage) sees the same contacts.
  const contextB = await browser.newContext();
  const other = await contextB.newPage();
  await other.goto("/");
  await expect(other.getByTestId("contact-row")).toHaveCount(E2E_SEEDED_CONTACTS + 1);
  await other.getByRole("searchbox", { name: "Найти контакт по имени" }).fill(name);
  await expect(other.getByTestId("contact-row")).toHaveCount(1);
  await other.getByTestId("contact-row").click();
  await expect(other.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(other.getByLabel("Заметки")).toHaveValue(expectedNotes);

  await contextA.close();
  await contextB.close();
});
