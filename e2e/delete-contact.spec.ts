// Deleting a contact from its card. The test adds its own contact, so the totals
// checked in main-scenario.spec.ts stay the same.

import { expect, test } from "@playwright/test";

test("deleted a contact -> back to the search results, it is gone from the list and its link", async ({ page }) => {
  const name = `Проверка Удаляева ${Date.now().toString().slice(-6)}`;

  await page.goto("/");
  const total = page.getByTestId("contacts-total");
  // textContent, not innerText: the counter is uppercased with CSS.
  const totalBefore = (await total.textContent()) ?? "";

  // Add a contact to delete.
  await page.goto("/contacts/new");
  await page.getByLabel("Имя").fill(name);
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  await expect(total).not.toHaveText(totalBefore);

  // Open its card from the search results.
  await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill(name);
  await expect(page.getByTestId("contact-row")).toHaveCount(1);
  await page.getByTestId("contact-row").click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const cardUrl = page.url();

  // "Cancel" keeps the contact.
  const dialog = page.getByRole("alertdialog");
  await page.getByRole("button", { name: "Удалить контакт" }).click();
  await expect(dialog).toContainText(`Удалить контакт «${name}»?`);
  await expect(dialog).toContainText("удалятся насовсем");
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  // "Delete" removes it and returns to the same search.
  await page.getByRole("button", { name: "Удалить контакт" }).click();
  await dialog.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByText(`Контакт «${name}» удалён`)).toBeVisible();
  await expect(page).toHaveURL(/\/\?q=/);
  await expect(page.getByText(`Никого не нашли по запросу «${name}»`)).toBeVisible();
  await expect(total).toHaveText(totalBefore);

  // The old link to the card leads nowhere.
  await page.goto(cardUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Такой страницы нет" })).toBeVisible();
});
