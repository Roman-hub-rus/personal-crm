// Sign-in from a browser that is not signed in, scenario by scenario from
// openspec/changes/login/specs/sign-in/spec.md. Every test uses addresses of its own.

import { expect, test, type Browser, type Page } from "@playwright/test";

import { findEmails, waitForEmails } from "../test-support/mailpit";
import {
  closeSignInDatabase,
  db,
  requestSignInLink,
  sessionExpiresAt,
  setSessionEndsIn,
  signIn,
  uniqueEmail,
} from "./sign-in-helpers";

// A browser of its own, signed out: like another device.
async function newDevice(browser: Browser) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  return { context, page: await context.newPage() };
}

async function expectLoginPage(page: Page) {
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Почта")).toBeVisible();
  await expect(page.getByRole("button", { name: "Получить ссылку" })).toBeVisible();
}

test.afterAll(closeSignInDatabase);

test.describe("without sign-in", () => {
  test("Открыл приложение без входа", async ({ page }) => {
    await page.goto("/");

    await expectLoginPage(page);
    await expect(page.getByTestId("contact-row")).toHaveCount(0);
    await expect(page.getByTestId("contacts-total")).toHaveCount(0);
  });

  test("Прямая ссылка без входа", async ({ page }) => {
    await page.goto("/contacts/1");
    await expectLoginPage(page);

    await page.goto("/groups");
    await expectLoginPage(page);
  });

  test("Проверка выкатки без входа", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", version: expect.any(String) });
  });
});

test.describe("requesting the link", () => {
  test("Отправил ссылку", async ({ page }) => {
    const email = uniqueEmail("anna");
    await page.goto("/login");
    await page.getByLabel("Почта").fill(email);
    await page.getByRole("button", { name: "Получить ссылку" }).click();

    await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
    // The field stays on the page.
    await expect(page.getByLabel("Почта")).toHaveValue(email);
    expect(await waitForEmails(email)).toHaveLength(1);
  });

  test("Пробелы по краям в форме", async ({ page }) => {
    const email = uniqueEmail("anna");
    await page.goto("/login");
    await page.getByLabel("Почта").fill(`  ${email.toUpperCase()}  `);
    await page.getByRole("button", { name: "Получить ссылку" }).click();

    await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
    expect(await waitForEmails(email)).toHaveLength(1);
  });

  test("Неверный адрес в форме", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Почта").fill("anna@");
    await page.getByRole("button", { name: "Получить ссылку" }).click();

    await expect(page.getByText("Проверь адрес почты")).toBeVisible();
    await expect(page.getByText(/Ссылка для входа отправлена/)).toHaveCount(0);
    expect(await findEmails("anna@")).toHaveLength(0);
  });

  test("Пустое поле", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Получить ссылку" }).click();

    await expect(page.getByText("Проверь адрес почты")).toBeVisible();
    await expect(page.getByText(/Ссылка для входа отправлена/)).toHaveCount(0);
  });

  test("Четвёртое письмо в форме", async ({ page }) => {
    const email = uniqueEmail("anna");
    for (let i = 0; i < 3; i++) {
      await requestSignInLink(page, email);
    }

    await page.goto("/login");
    await page.getByLabel("Почта").fill(email);
    await page.getByRole("button", { name: "Получить ссылку" }).click();
    await expect(page.getByText("Слишком часто, попробуй через несколько минут")).toBeVisible();
    expect(await findEmails(email)).toHaveLength(3);
  });
});

test.describe("signing in", () => {
  test("Открыл ссылку", async ({ page }) => {
    const email = uniqueEmail("anna");
    const link = await requestSignInLink(page, email);

    await page.goto(link);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
  });

  test("Первый вход", async ({ page }) => {
    const email = uniqueEmail("newcomer");
    await signIn(page, email);

    // No questions: straight to an empty list, though the base has the contacts of other users.
    await expect(page.getByText("Пока нет ни одного контакта")).toBeVisible();
    await expect(page.getByRole("link", { name: "Добавить первый контакт" })).toBeVisible();
    await expect(page.getByTestId("contact-row")).toHaveCount(0);
  });

  test("Вошедший открыл страницу входа", async ({ page }) => {
    await signIn(page, uniqueEmail("anna"));

    await page.goto("/login");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
  });

  test("Письмо на компьютере владельца", async ({ page }) => {
    // An address that does not exist anywhere: the email is seen in Mailpit and the link signs in.
    const email = uniqueEmail("nobody-has-this-mailbox");
    await signIn(page, email);

    const [message] = await findEmails(email);
    expect(message.from.name).toBe("Личная CRM");
    expect(message.subject).toBe("Вход в Личную CRM");
  });
});

test.describe("the link works once and for 15 minutes", () => {
  test("Использованная ссылка", async ({ page, browser }) => {
    const email = uniqueEmail("anna");
    const link = await requestSignInLink(page, email);
    await page.goto(link);
    await expect(page).toHaveURL(/\/$/);

    // The same link in another browser.
    const other = await newDevice(browser);
    await other.page.goto(link);

    await expect(other.page.getByText("Ссылка устарела, запроси новую")).toBeVisible();
    await expect(other.page.getByRole("link", { name: "На страницу входа" })).toBeVisible();
    await other.context.close();
  });

  test("Ссылке больше 15 минут", async ({ page }) => {
    const email = uniqueEmail("anna");
    const link = await requestSignInLink(page, email);
    // The link lives 15 minutes: an hour later it is gone. The time is moved in the e2e database.
    await db()`update verifications set expires_at = now() - interval '1 minute'`;

    await page.goto(link);

    await expect(page.getByText("Ссылка устарела, запроси новую")).toBeVisible();
  });

  test("Запросил новую ссылку", async ({ page }) => {
    const email = uniqueEmail("anna");
    const first = await requestSignInLink(page, email);
    const second = await requestSignInLink(page, email);

    await page.goto(first);
    await expect(page.getByText("Ссылка устарела, запроси новую")).toBeVisible();

    await page.goto(second);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("user-email")).toHaveText(email);
  });

  test("На страницу входа", async ({ page }) => {
    await page.goto("/api/auth/magic-link/verify?token=nonsense&callbackURL=%2F&errorCallbackURL=%2Flogin");
    await expect(page.getByText("Ссылка устарела, запроси новую")).toBeVisible();

    await page.getByRole("link", { name: "На страницу входа" }).click();

    await expectLoginPage(page);
    await expect(page.getByText("Ссылка устарела, запроси новую")).toHaveCount(0);
  });
});

test.describe("the sign-in lasts 30 days from the last visit", () => {
  test("Заходит регулярно", async ({ page }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);

    // Signed in 40 days ago, visits once a week since: each visit starts the 30 days anew.
    for (let week = 0; week < 3; week++) {
      await setSessionEndsIn(email, "23 days"); // the last visit was 7 days ago
      await page.goto("/");
      await expect(page.getByTestId("user-email")).toHaveText(email);

      const endsAt = await sessionExpiresAt(email);
      const daysLeft = (endsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(daysLeft).toBeGreaterThan(29.9);
    }
  });

  test("Не заходил 30 дней", async ({ page }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);

    await setSessionEndsIn(email, "-1 minute"); // the last visit was more than 30 days ago
    await page.goto("/");

    await expectLoginPage(page);
  });

  test("Два устройства", async ({ page, browser }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);
    const phone = await newDevice(browser);
    await signIn(phone.page, email);

    // The contact added on one device is on the other.
    const name = `Два Устройства ${Date.now()}`;
    await page.goto("/contacts/new");
    await page.getByLabel("Имя").fill(name);
    await page.getByRole("button", { name: "Добавить контакт" }).click();
    await expect(page).toHaveURL(/\/\?added=\d+$/);

    await phone.page.goto("/");
    await expect(phone.page.getByTestId("contact-row").filter({ hasText: name })).toHaveCount(1);
    await expect(page.getByTestId("contact-row").filter({ hasText: name })).toHaveCount(1);
    await phone.context.close();
  });
});

test.describe("the email in the header and signing out", () => {
  test("Почта в шапке", async ({ page }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);

    await expect(page.getByTestId("user-email")).toHaveText(email);
    await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
  });

  test("Длинная почта в шапке на телефоне", async ({ page }) => {
    const email = uniqueEmail("a-very-long-name-that-does-not-fit-into-a-phone-screen-at-all");
    await page.setViewportSize({ width: 360, height: 740 });
    await signIn(page, email);

    // The address is cut with an ellipsis, the page does not scroll sideways, "Выйти" stays reachable.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("button", { name: "Выйти" })).toBeInViewport();
  });

  test("Вышел", async ({ page }) => {
    await signIn(page, uniqueEmail("anna"));

    await page.getByRole("button", { name: "Выйти" }).click();

    await expectLoginPage(page);
    await page.goto("/");
    await expectLoginPage(page);
  });

  test("Выход только на этом устройстве", async ({ page, browser }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);
    const phone = await newDevice(browser);
    await signIn(phone.page, email);

    await page.getByRole("button", { name: "Выйти" }).click();
    await expectLoginPage(page);

    // The other device is still in the app.
    await phone.page.goto("/");
    await expect(phone.page.getByTestId("user-email")).toHaveText(email);
    await phone.context.close();
  });
});

test.describe("two users do not see each other's contacts", () => {
  // The success criterion of the sign-in spec, both ways: two people sign in by the link from the email in
  // two separate browsers, each adds a contact, and each sees only their own.
  async function addContactAs(page: Page, name: string) {
    await page.goto("/contacts/new");
    await page.getByLabel("Имя").fill(name);
    await page.getByRole("button", { name: "Добавить контакт" }).click();
    await expect(page).toHaveURL(/\/\?added=(\d+)$/);
    return Number(new URL(page.url()).searchParams.get("added"));
  }

  async function expectOnlyOwnContact(page: Page, own: string, foreign: string, foreignId: number) {
    // The list, the count and the search show only the own contact.
    await page.goto("/");
    await expect(page.getByTestId("contact-row")).toHaveCount(1);
    await expect(page.getByTestId("contact-row")).toContainText(own);
    await expect(page.getByTestId("contacts-total")).toHaveText("1 контакт");
    await expect(page.getByText(foreign)).toHaveCount(0);

    await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill(foreign);
    await expect(page.getByText(`Никого не нашли по запросу «${foreign}»`)).toBeVisible();

    // The direct link to the foreign contact: "Контакт не найден", nothing of the contact is shown.
    await page.goto(`/contacts/${foreignId}`);
    await expect(page.getByRole("heading", { name: "Контакт не найден" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ко всем контактам" })).toBeVisible();
    await expect(page.getByText(foreign)).toHaveCount(0);
    await expect(page.getByLabel("Заметки")).toHaveCount(0);
  }

  test("Открыл чужой контакт", async ({ browser }) => {
    const suffix = Date.now().toString(36);
    const nameA = `Контакт Анны ${suffix}`;
    const nameB = `Контакт Бориса ${suffix}`;
    const a = await newDevice(browser);
    const b = await newDevice(browser);
    await signIn(a.page, uniqueEmail("anna"));
    await signIn(b.page, uniqueEmail("boris"));

    const idA = await addContactAs(a.page, nameA);
    const idB = await addContactAs(b.page, nameB);

    await expectOnlyOwnContact(a.page, nameA, nameB, idB);
    await expectOnlyOwnContact(b.page, nameB, nameA, idA);
    await a.context.close();
    await b.context.close();
  });

  test("Контакта нет совсем", async ({ page }) => {
    await signIn(page, uniqueEmail("anna"));

    await page.goto("/contacts/2000000000");
    await expect(page.getByRole("heading", { name: "Контакт не найден" })).toBeVisible();

    await page.goto("/contacts/abc");
    await expect(page.getByRole("heading", { name: "Контакт не найден" })).toBeVisible();
  });
});
