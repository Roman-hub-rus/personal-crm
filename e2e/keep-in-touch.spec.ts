// "Пора связаться" from openspec/changes/keep-in-touch/specs/keep-in-touch/spec.md.
// Tests add their own contacts and remove them at the end, so main-scenario.spec.ts still sees
// exactly the seeded contacts.

import { expect, test, type Page } from "@playwright/test";

import {
  addContact,
  chooseFrequency,
  clearFrequencyExcept,
  closeDatabase,
  deleteTestContacts,
  frequencySelect,
  getStoredContact,
  insertContact,
  insertGroup,
  setMomentsAgo,
  shiftMomentsBack,
  uniqueName,
} from "./keep-in-touch-helpers";

// Seeded contacts can be in the block too, so tests look only at their own rows.
const block = (page: Page) => page.getByRole("region", { name: "Пора связаться" });
const dueRows = (page: Page) => page.getByTestId("due-contact-row");
const dueRow = (page: Page, name: string) => dueRows(page).filter({ hasText: name });

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
}

async function openCard(page: Page, name: string) {
  await page.goto(`/?${new URLSearchParams({ q: name })}`);
  await page.getByTestId("contact-row").filter({ hasText: name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function saveCard(page: Page) {
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Изменения сохранены")).toBeVisible();
}

async function dueNames(page: Page) {
  return (await dueRows(page).allInnerTexts()).map((text) => text.split("\n").find((line) => line.includes(" ")) ?? "");
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await deleteTestContacts();
  await closeDatabase();
});

test.describe("frequency in the card", () => {
  test("new contact form: not set by default, with the hint", async ({ page }) => {
    await page.goto("/contacts/new");
    await expect(frequencySelect(page)).toHaveText("Не задано");
    await expect(page.getByText("Если дольше не общаться, контакт появится в блоке «Пора связаться»")).toBeVisible();
  });

  test("chosen when created, changed and reset; another browser sees the same", async ({ page, browser }) => {
    const name = uniqueName("Частота Неделькина");
    const id = await addContact(page, { name, frequency: "Раз в неделю" });

    await page.goto(`/contacts/${id}`);
    await expect(frequencySelect(page)).toHaveText("Раз в неделю");

    // Changed but not saved yet.
    await chooseFrequency(page, "Раз в месяц");
    await expect(page.getByText("Есть несохранённые изменения")).toBeVisible();
    await expect(page.getByRole("button", { name: "Сохранить" })).toBeEnabled();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Изменения сохранены")).toBeVisible();

    await page.reload();
    await expect(frequencySelect(page)).toHaveText("Раз в месяц");

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(`/contacts/${id}`);
    await expect(frequencySelect(otherPage)).toHaveText("Раз в месяц");
    await other.close();

    await chooseFrequency(page, "Не задано");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Изменения сохранены")).toBeVisible();
    await page.reload();
    await expect(frequencySelect(page)).toHaveText("Не задано");
  });
});

test.describe("the block on the home page", () => {
  test("counted from choosing the frequency: shown once more than 7 days have passed", async ({ page }) => {
    const name = uniqueName("Отсчёт Выборов");
    await addContact(page, { name, frequency: "Раз в неделю" });
    await openHome(page);
    await expect(dueRow(page, name)).toHaveCount(0);

    await setMomentsAgo(name, { frequencySetAt: "6 days" });
    await openHome(page);
    await expect(dueRow(page, name)).toHaveCount(0);

    await setMomentsAgo(name, { frequencySetAt: "8 days" });
    await openHome(page);
    await expect(dueRow(page, name)).toContainText("Не общались уже 8 дней · раз в неделю");
    // The overdue contact stays in the list as well.
    await expect(page.getByTestId("contact-row").filter({ hasText: name })).toHaveCount(1);
    await expect(block(page).getByText(String(await dueRows(page).count()), { exact: true })).toBeVisible();
  });

  test("a note written when creating the contact counts as the last contact", async ({ page }) => {
    const withNote = uniqueName("Создан Заметкин");
    const withoutNote = uniqueName("Создан Беззаметкин");
    await addContact(page, { name: withNote, frequency: "Раз в неделю", notes: "Познакомились на конференции" });
    await addContact(page, { name: withoutNote, frequency: "Раз в неделю" });

    // As if 8 days have passed since both were created.
    await shiftMomentsBack(withNote, "8 days");
    await shiftMomentsBack(withoutNote, "8 days");
    await openHome(page);
    await expect(dueRow(page, withNote)).toContainText("Последнее общение 8 дней назад · раз в неделю");
    await expect(dueRow(page, withoutNote)).toContainText("Не общались уже 8 дней · раз в неделю");
  });

  test("a group chosen on the home page: only its overdue contacts, hidden while searching", async ({ page }) => {
    const first = uniqueName("Теннис Первый");
    const second = uniqueName("Теннис Второй");
    const outside = uniqueName("Вне Группы");
    const onTime = uniqueName("Семья Вовремякина");
    for (const name of [first, second, outside]) {
      await insertContact(name, { frequency: "week", frequencySetAt: "10 days" });
    }
    await insertContact(onTime, { frequency: "week", frequencySetAt: "2 days" });
    const tennis = uniqueName("Теннис");
    const family = uniqueName("Семья");
    await insertGroup(tennis, [first, second]);
    await insertGroup(family, [onTime]);
    const groupLink = (name: string) => page.getByRole("link", { name, exact: true });

    await openHome(page);
    await expect(dueRow(page, outside)).toHaveCount(1);

    await groupLink(tennis).click();
    await expect(groupLink(tennis)).toHaveAttribute("aria-current", "true");
    await expect(dueRows(page)).toHaveCount(2);
    expect((await dueNames(page)).sort()).toEqual([first, second].sort());
    await expect(block(page).getByText("2", { exact: true })).toBeVisible();

    // Searching inside the group hides the block; clearing the search brings back the group's overdue.
    await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill(first);
    await expect(page.getByTestId("contact-row")).toHaveCount(1);
    await expect(block(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Очистить поиск" }).click();
    await expect(groupLink(tennis)).toHaveAttribute("aria-current", "true");
    await expect(dueRows(page)).toHaveCount(2);
    await expect(dueRow(page, outside)).toHaveCount(0);

    // Nobody in "Семья" is overdue.
    await groupLink(family).click();
    await expect(groupLink(family)).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("contact-row")).toHaveCount(1);
    await expect(block(page)).toHaveCount(0);
  });

  test("the row tells how long ago the last note was", async ({ page }) => {
    const name = uniqueName("Квартал Заметкин");
    await insertContact(name, {
      frequency: "quarter",
      notes: "Старая заметка",
      lastNoteAt: "4 months",
      frequencySetAt: "5 months",
    });
    await openHome(page);
    await expect(dueRow(page, name)).toContainText(name);
    await expect(dueRow(page, name)).toContainText("Последнее общение 4 месяца назад · раз в квартал");
    await expect(dueRow(page, name).getByRole("button", { name: `Связались — ${name}` })).toBeVisible();
  });

  test("the most overdue first, whatever the frequency", async ({ page }) => {
    const weekly = uniqueName("Неделя Двухдневкин");
    const yearly = uniqueName("Год Двадцатидневкин");
    await insertContact(weekly, { frequency: "week", frequencySetAt: "9 days" });
    await insertContact(yearly, { frequency: "year", frequencySetAt: "1 year 20 days" });
    await openHome(page);
    const names = await dueNames(page);
    expect(names).toContain(weekly);
    expect(names.indexOf(yearly)).toBeLessThan(names.indexOf(weekly));
  });

  test("month -> week after a contact 10 days ago: shown right away", async ({ page }) => {
    const name = uniqueName("Смена Частотина");
    await insertContact(name, {
      frequency: "month",
      notes: "Созвонились",
      lastNoteAt: "10 days",
      frequencySetAt: "20 days",
    });
    await openHome(page);
    await expect(dueRow(page, name)).toHaveCount(0);

    await openCard(page, name);
    await chooseFrequency(page, "Раз в неделю");
    await saveCard(page);
    await openHome(page);
    await expect(dueRow(page, name)).toContainText("Последнее общение 10 дней назад · раз в неделю");
  });

  test("an old note does not make a contact overdue when the frequency is chosen now", async ({ page }) => {
    const name = uniqueName("Старая Заметкина");
    await insertContact(name, { notes: "Давняя заметка", lastNoteAt: "3 months" });
    await openHome(page);
    // Frequency not set: never overdue.
    await expect(dueRow(page, name)).toHaveCount(0);

    await openCard(page, name);
    await chooseFrequency(page, "Раз в месяц");
    await saveCard(page);
    await openHome(page);
    await expect(dueRow(page, name)).toHaveCount(0);
  });

  test("appending a note takes the contact out of the block, changing only the phone does not", async ({ page }) => {
    const name = uniqueName("Заметка Допискина");
    await insertContact(name, {
      frequency: "week",
      notes: "Первая заметка",
      lastNoteAt: "8 days",
      frequencySetAt: "30 days",
    });
    await openHome(page);
    await expect(dueRow(page, name)).toHaveCount(1);

    await openCard(page, name);
    await page.getByLabel("Телефон").fill("+7 900 111-22-33");
    await saveCard(page);
    await openHome(page);
    await expect(dueRow(page, name)).toHaveCount(1);

    await openCard(page, name);
    await page.getByLabel("Заметки").fill("Первая заметка\n\nВторая заметка");
    await saveCard(page);
    await openHome(page);
    await expect(dueRow(page, name)).toHaveCount(0);
  });

  test("resetting the frequency takes the contact out of the block", async ({ page }) => {
    const name = uniqueName("Сброс Годовой");
    await insertContact(name, { frequency: "year", frequencySetAt: "2 years" });
    await openHome(page);
    await expect(dueRow(page, name)).toHaveCount(1);

    await openCard(page, name);
    await chooseFrequency(page, "Не задано");
    await saveCard(page);
    await openHome(page);
    await expect(dueRow(page, name)).toHaveCount(0);
  });

  test("hidden while searching, back when the search is cleared", async ({ page }) => {
    const name = uniqueName("Поиск Скрывалов");
    await insertContact(name, { frequency: "week", frequencySetAt: "10 days" });
    await openHome(page);
    await expect(block(page)).toBeVisible();

    await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill(name);
    await expect(page.getByTestId("contact-row")).toHaveCount(1);
    await expect(block(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Очистить поиск" }).click();
    await expect(dueRow(page, name)).toHaveCount(1);
  });

  test("a click on the row outside the button opens the card", async ({ page }) => {
    const name = uniqueName("Клик Строкин");
    await insertContact(name, { frequency: "week", frequencySetAt: "10 days" });
    await openHome(page);
    await dueRow(page, name).getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    await page.getByRole("link", { name: "Все контакты" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(dueRow(page, name)).toHaveCount(1);
  });

  test("a deleted contact is gone from the block", async ({ page }) => {
    const name = uniqueName("Удаление Блоков");
    await insertContact(name, { frequency: "week", frequencySetAt: "10 days" });
    await openHome(page);
    await dueRow(page, name).getByRole("link").click();
    await page.getByRole("button", { name: "Удалить контакт" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(page.getByText(`Контакт «${name}» удалён`)).toBeVisible();
    await openHome(page);
    await expect(dueRow(page, name)).toHaveCount(0);
  });
});

test.describe("«Связались»", () => {
  test("from the block: the row goes away, «Отменить» brings it back in place", async ({ page }) => {
    const names = [uniqueName("Первый Отменов"), uniqueName("Второй Отменов"), uniqueName("Третий Отменов")];
    await insertContact(names[0], { frequency: "week", frequencySetAt: "40 days" });
    await insertContact(names[1], {
      frequency: "week",
      notes: "Заметка",
      lastNoteAt: "30 days",
      frequencySetAt: "60 days",
    });
    await insertContact(names[2], { frequency: "week", frequencySetAt: "20 days" });
    await openHome(page);
    const before = await dueRows(page).allTextContents();
    const storedBefore = await getStoredContact(names[1]);

    await dueRow(page, names[1])
      .getByRole("button", { name: `Связались — ${names[1]}` })
      .click();
    await expect(page.getByText(`Отмечено: ${names[1]}`)).toBeVisible();
    await expect(dueRow(page, names[1])).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);

    // The notes and the moment of the last note stay as they were.
    const storedAfter = await getStoredContact(names[1]);
    expect(storedAfter.notes).toBe(storedBefore.notes);
    expect(storedAfter.lastNoteAt).toEqual(storedBefore.lastNoteAt);
    expect(storedAfter.lastContactedAt).not.toBeNull();

    await page.getByRole("button", { name: "Отменить" }).click();
    await expect(dueRows(page)).toHaveText(before);
    await expect(dueRow(page, names[1])).toContainText("Последнее общение 4 недели назад · раз в неделю");
    expect((await getStoredContact(names[1])).lastContactedAt).toBeNull();
  });

  test("from the block without undo: still gone after a reload", async ({ page }) => {
    const name = uniqueName("Без Отмены");
    await insertContact(name, { frequency: "month", frequencySetAt: "2 months" });
    await openHome(page);
    await dueRow(page, name)
      .getByRole("button", { name: `Связались — ${name}` })
      .click();
    const message = page.getByText(`Отмечено: ${name}`);
    await expect(message).toBeVisible();
    await expect(message).toBeHidden({ timeout: 10_000 });

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
    await expect(dueRow(page, name)).toHaveCount(0);
  });

  test("from the card: notes and unsaved edits stay, the contact leaves the block", async ({ page }) => {
    const name = uniqueName("Карточка Связалова");
    await insertContact(name, {
      frequency: "week",
      notes: "Обсудили поездку",
      lastNoteAt: "12 days",
      frequencySetAt: "30 days",
    });
    const before = await getStoredContact(name);

    await openCard(page, name);
    await page.getByLabel("Телефон").fill("+7 900 555-66-77");
    await page.getByRole("button", { name: `Связались — ${name}` }).click();
    await expect(page.getByText(`Отмечено: ${name}`)).toBeVisible();
    await expect(page.getByLabel("Телефон")).toHaveValue("+7 900 555-66-77");
    await expect(page.getByText("Есть несохранённые изменения")).toBeVisible();

    const after = await getStoredContact(name);
    expect(after.notes).toBe(before.notes);
    expect(after.lastNoteAt).toEqual(before.lastNoteAt);
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(after.lastContactedAt).not.toBeNull();

    await openHome(page);
    await expect(dueRow(page, name)).toHaveCount(0);
  });

  test("no button in the card while the frequency is not set", async ({ page }) => {
    const name = uniqueName("Без Частоты");
    await insertContact(name, { notes: "Заметка", lastNoteAt: "1 year" });
    await openCard(page, name);
    await expect(page.getByRole("button", { name: /^Связались/ })).toHaveCount(0);
  });

  test("«Связались» later than the note restarts the period", async ({ page }) => {
    const recent = uniqueName("Недавно Связались");
    const earlier = uniqueName("Давно Связались");
    await insertContact(recent, {
      frequency: "week",
      notes: "Заметка",
      lastNoteAt: "20 days",
      lastContactedAt: "2 days",
      frequencySetAt: "60 days",
    });
    await insertContact(earlier, {
      frequency: "week",
      notes: "Заметка",
      lastNoteAt: "3 months",
      lastContactedAt: "10 days",
      frequencySetAt: "6 months",
    });
    await openHome(page);
    await expect(dueRow(page, recent)).toHaveCount(0);
    await expect(dueRow(page, earlier)).toContainText("Последнее общение 10 дней назад · раз в неделю");
  });

  // Last: it clears the frequency of every other contact in the e2e database.
  test("the last contact in the block: the block disappears", async ({ page }) => {
    const name = uniqueName("Последний Блоков");
    await insertContact(name, { frequency: "week", frequencySetAt: "10 days" });
    await clearFrequencyExcept([name]);
    await openHome(page);
    await expect(dueRows(page)).toHaveCount(1);
    await expect(block(page).getByText("1", { exact: true })).toBeVisible();

    await dueRow(page, name)
      .getByRole("button", { name: `Связались — ${name}` })
      .click();
    await expect(page.getByText(`Отмечено: ${name}`)).toBeVisible();
    await expect(block(page)).toHaveCount(0);
  });
});
