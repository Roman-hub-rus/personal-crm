import { describe, expect, test } from "vitest";

import type { CalendarDate } from "./birthdays";
import { EMPTY_CONTACT_FORM, contactInputSchema, toFieldErrors } from "./contact-input";

const NOV_14_2026: CalendarDate = { year: 2026, month: 11, day: 14 };

function parse(birthDay: string, birthMonth: string, birthYear: string, today = NOV_14_2026) {
  return contactInputSchema(today).safeParse({
    ...EMPTY_CONTACT_FORM,
    name: "Анна Петрова",
    birthDay,
    birthMonth,
    birthYear,
  });
}

function birthdayError(birthDay: string, birthMonth: string, birthYear: string, today = NOV_14_2026) {
  const result = parse(birthDay, birthMonth, birthYear, today);
  return result.success ? undefined : toFieldErrors(result.error).birthday;
}

function storedBirthday(birthDay: string, birthMonth: string, birthYear: string) {
  const result = parse(birthDay, birthMonth, birthYear);
  if (!result.success) throw new Error(`Unexpected errors: ${JSON.stringify(toFieldErrors(result.error))}`);
  const { birthDay: day, birthMonth: month, birthYear: year } = result.data;
  return { day, month, year };
}

describe("Проверка даты рождения", () => {
  test("пустое поле — верное значение", () => {
    expect(storedBirthday("", "", "")).toEqual({ day: null, month: null, year: null });
  });

  test("дата с годом и без года", () => {
    expect(storedBirthday("17", "11", "1991")).toEqual({ day: 17, month: 11, year: 1991 });
    expect(storedBirthday("3", "3", "")).toEqual({ day: 3, month: 3, year: null });
    expect(storedBirthday("3", "3", " 1990 ")).toEqual({ day: 3, month: 3, year: 1990 });
  });

  test("Только день или только месяц", () => {
    expect(birthdayError("12", "", "")).toBe("Укажите и день, и месяц");
    expect(birthdayError("", "4", "")).toBe("Укажите и день, и месяц");
    expect(birthdayError("12", "", "1990")).toBe("Укажите и день, и месяц");
  });

  test("Только год", () => {
    expect(birthdayError("", "", "1990")).toBe("Укажите и день, и месяц");
  });

  test("Такого дня нет в месяце", () => {
    expect(birthdayError("31", "4", "")).toBe("Такой даты нет — проверьте день и месяц");
    expect(birthdayError("30", "2", "")).toBe("Такой даты нет — проверьте день и месяц");
    expect(birthdayError("32", "1", "")).toBe("Такой даты нет — проверьте день и месяц");
    expect(birthdayError("1", "13", "")).toBe("Такой даты нет — проверьте день и месяц");
    expect(birthdayError("abc", "1", "")).toBe("Такой даты нет — проверьте день и месяц");
  });

  test("29 февраля в невисокосный год", () => {
    expect(birthdayError("29", "2", "1990")).toBe("Такой даты нет — проверьте день и месяц");
  });

  test("29 февраля в високосный год", () => {
    expect(storedBirthday("29", "2", "1992")).toEqual({ day: 29, month: 2, year: 1992 });
  });

  test("29 февраля без года", () => {
    expect(storedBirthday("29", "2", "")).toEqual({ day: 29, month: 2, year: null });
  });

  test("Год вне диапазона", () => {
    const message = "Проверьте год — от 1900 до 2026";
    expect(birthdayError("1", "1", "1899")).toBe(message);
    expect(birthdayError("1", "1", "2027")).toBe(message);
    expect(birthdayError("1", "1", "19ab")).toBe(message);
    expect(birthdayError("1", "1", "1990.5")).toBe(message);
    expect(birthdayError("1", "1", "1900")).toBeUndefined();
    expect(birthdayError("1", "1", "2026")).toBeUndefined();
    // The current year comes from "today".
    expect(birthdayError("1", "1", "2027", { year: 2027, month: 1, day: 1 })).toBeUndefined();
  });

  test("Дата в будущем", () => {
    expect(birthdayError("20", "12", "2026")).toBe("Дата рождения не может быть в будущем");
    expect(birthdayError("15", "11", "2026")).toBe("Дата рождения не может быть в будущем");
    expect(birthdayError("14", "11", "2026")).toBeUndefined();
    // Without a year a date is never in the future.
    expect(birthdayError("20", "12", "")).toBeUndefined();
  });

  test("ошибка не мешает проверке остальных полей", () => {
    const result = contactInputSchema(NOV_14_2026).safeParse({
      ...EMPTY_CONTACT_FORM,
      name: "",
      birthDay: "12",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toFieldErrors(result.error)).toMatchObject({
      name: "Укажите имя — по нему контакт можно будет найти",
      birthday: "Укажите и день, и месяц",
    });
  });
});
