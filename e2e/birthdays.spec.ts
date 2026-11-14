// "Скоро день рождения" from openspec/changes/birthdays/specs/birthdays/spec.md.
// The test adds its own contacts and removes them at the end, so main-scenario.spec.ts still sees
// exactly the seeded contacts.

import { expect, test, type Page } from "@playwright/test";

import { APP_TIME_ZONE, todayIn } from "../src/lib/birthdays";
import { closeDatabase, deleteTestContacts, uniqueName } from "./keep-in-touch-helpers";

const MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

// Seeded contacts can be in the block too, so the test looks only at its own row.
const block = (page: Page) => page.getByRole("region", { name: "Скоро день рождения" });
const birthdayRow = (page: Page, name: string) => page.getByTestId("birthday-row").filter({ hasText: name });

// Tomorrow in Moscow, whatever the time zone of the machine running the test.
function tomorrowInMoscow() {
  const today = todayIn(APP_TIME_ZONE, new Date());
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  return { year: tomorrow.getUTCFullYear(), month: tomorrow.getUTCMonth() + 1, day: tomorrow.getUTCDate() };
}

async function choose(page: Page, select: string, option: string) {
  await page.getByRole("combobox", { name: select, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("combobox", { name: select, exact: true })).toHaveText(option);
}

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
}

test.afterAll(async () => {
  await deleteTestContacts();
  await closeDatabase();
});

test("a birthday tomorrow shows up in the block, hides while searching and goes away when cleared", async ({
  page,
}) => {
  const name = uniqueName("Именинник Завтрашний");
  const tomorrow = tomorrowInMoscow();
  const birthYear = tomorrow.year - 30;

  // New contact with the birthday: the field starts empty, with the hint.
  await page.goto("/contacts/new");
  await expect(page.getByText("Год можно не указывать")).toBeVisible();
  await page.getByLabel("Имя").fill(name);
  await choose(page, "День", String(tomorrow.day));
  await choose(page, "Месяц", MONTHS[tomorrow.month - 1]);
  await page.getByRole("textbox", { name: "Год", exact: true }).fill(String(birthYear));
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  const id = Number(new URL(page.url()).searchParams.get("added"));

  // On the home page: tomorrow, with the age.
  await openHome(page);
  await expect(birthdayRow(page, name)).toContainText("завтра · исполнится 30 лет");
  await expect(block(page)).toBeVisible();
  // The contact stays in the list as well.
  await expect(page.getByTestId("contact-row").filter({ hasText: name })).toHaveCount(1);

  // Searching hides the block.
  await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill(name);
  await expect(page.getByTestId("contact-row")).toHaveCount(1);
  await expect(block(page)).toHaveCount(0);

  // A click on the row opens the card.
  await openHome(page);
  await birthdayRow(page, name).click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${id}`));
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Год", exact: true })).toHaveValue(String(birthYear));

  // Cleared and saved: the contact leaves the block.
  await page.getByRole("button", { name: "Очистить", exact: true }).click();
  await expect(page.getByText("Есть несохранённые изменения")).toBeVisible();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Изменения сохранены")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "День", exact: true })).toHaveText("День");
  await expect(page.getByRole("textbox", { name: "Год", exact: true })).toHaveValue("");

  await openHome(page);
  await expect(birthdayRow(page, name)).toHaveCount(0);
});
