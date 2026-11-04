import { describe, expect, test } from "vitest";

import { buildSignInEmail } from "./sign-in-email";

// A link with "&" in it: in HTML it must be written as "&amp;", in the text version as it is.
const LINK = "http://localhost:3000/api/auth/magic-link/verify?token=abc123&callbackURL=%2F";

describe("sign-in email", () => {
  test("Что в письме", () => {
    const email = buildSignInEmail(LINK);

    expect(email.subject).toBe("Вход в Личную CRM");

    // The button "Войти" leads to the link.
    expect(email.html).toMatch(
      /<a href="http:\/\/localhost:3000\/api\/auth\/magic-link\/verify\?token=abc123&amp;callbackURL=%2F"[^>]*>\s*Войти\s*<\/a>/,
    );
    expect(email.html).toContain("Ссылка работает 15 минут");
    expect(email.html).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");

    // The text version for mail programs without HTML: the same words and the link itself.
    expect(email.text).toContain(LINK);
    expect(email.text).toContain("Ссылка работает 15 минут");
    expect(email.text).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");
  });

  test("Ссылка в письме не ломает разметку", () => {
    const email = buildSignInEmail('http://localhost:3000/?a="><script>alert(1)</script>');
    expect(email.html).not.toContain("<script>");
  });
});
