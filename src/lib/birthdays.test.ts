import { describe, expect, test } from "vitest";

import {
  APP_TIME_ZONE,
  birthdayRowText,
  nextBirthday,
  todayIn,
  upcomingBirthdays,
  type CalendarDate,
} from "./birthdays";

type Row = { name: string; birthDay: number | null; birthMonth: number | null; birthYear: number | null };

const row = (name: string, day: number | null, month: number | null, year: number | null = null): Row => ({
  name,
  birthDay: day,
  birthMonth: month,
  birthYear: year,
});

const date = (year: number, month: number, day: number): CalendarDate => ({ year, month, day });

const NOV_14_2026 = date(2026, 11, 14);
const DEC_28_2026 = date(2026, 12, 28);

const upcomingNames = (rows: Row[], today: CalendarDate) =>
  upcomingBirthdays(rows, today).map((item) => item.contact.name);

// The row text of the only contact, if it is in the block.
function rowText(contact: Row, today: CalendarDate) {
  const [item] = upcomingBirthdays([contact], today);
  return item ? birthdayRowText(item) : undefined;
}

describe("todayIn", () => {
  test("Полночь по Москве", () => {
    // 20:30 UTC is 23:30 in Moscow, 21:30 UTC is 00:30 of the next day.
    expect(todayIn(APP_TIME_ZONE, new Date("2026-11-13T20:30:00Z"))).toEqual(date(2026, 11, 13));
    expect(todayIn(APP_TIME_ZONE, new Date("2026-11-13T21:30:00Z"))).toEqual(date(2026, 11, 14));

    const contact = row("Анна", 21, 11);
    expect(upcomingNames([contact], todayIn(APP_TIME_ZONE, new Date("2026-11-13T20:30:00Z")))).toEqual([]);
    expect(upcomingNames([contact], todayIn(APP_TIME_ZONE, new Date("2026-11-13T21:30:00Z")))).toEqual(["Анна"]);
  });
});

describe("nextBirthday", () => {
  test("в этом году, если ещё не прошёл", () => {
    expect(nextBirthday(17, 11, NOV_14_2026)).toEqual(date(2026, 11, 17));
  });

  test("сегодня", () => {
    expect(nextBirthday(14, 11, NOV_14_2026)).toEqual(date(2026, 11, 14));
  });

  test("в следующем году, если уже прошёл", () => {
    expect(nextBirthday(13, 11, NOV_14_2026)).toEqual(date(2027, 11, 13));
  });

  test("29 февраля в невисокосный год — 28 февраля", () => {
    expect(nextBirthday(29, 2, date(2027, 1, 10))).toEqual(date(2027, 2, 28));
  });

  test("29 февраля в високосный год", () => {
    expect(nextBirthday(29, 2, date(2028, 1, 10))).toEqual(date(2028, 2, 29));
  });
});

describe("Кто попадает в блок «Скоро день рождения»", () => {
  test("День рождения сегодня", () => {
    expect(upcomingNames([row("Анна", 14, 11)], NOV_14_2026)).toEqual(["Анна"]);
  });

  test("Через 7 дней", () => {
    expect(upcomingNames([row("Анна", 21, 11)], NOV_14_2026)).toEqual(["Анна"]);
  });

  test("Через 8 дней", () => {
    expect(upcomingNames([row("Анна", 22, 11)], NOV_14_2026)).toEqual([]);
  });

  test("Вчера", () => {
    expect(upcomingNames([row("Анна", 13, 11)], NOV_14_2026)).toEqual([]);
  });

  test("Через Новый год", () => {
    expect(upcomingNames([row("Анна", 3, 1)], DEC_28_2026)).toEqual(["Анна"]);
  });

  test("29 февраля в невисокосный год", () => {
    expect(rowText(row("Анна", 29, 2), date(2027, 2, 28))).toBe("28 февраля · сегодня");
  });

  test("29 февраля в високосный год", () => {
    expect(rowText(row("Анна", 29, 2), date(2028, 2, 28))).toBe("29 февраля · завтра");
  });

  test("Дня рождения нет", () => {
    expect(upcomingNames([row("Анна", null, null)], NOV_14_2026)).toEqual([]);
  });

  test("год рождения не влияет", () => {
    expect(upcomingNames([row("Анна", 15, 11, 1991), row("Борис", 15, 11)], NOV_14_2026)).toEqual(["Анна", "Борис"]);
  });
});

describe("Порядок в блоке «Скоро день рождения»", () => {
  test("Ближайшие сверху", () => {
    const rows = [row("А", 3, 1), row("Б", 30, 12), row("В", 28, 12)];
    expect(upcomingNames(rows, DEC_28_2026)).toEqual(["В", "Б", "А"]);
  });

  test("Один день", () => {
    // Rows come from the database sorted by name; on the same day that order is kept.
    const rows = [row("Анна", 16, 11), row("Борис", 16, 11), row("Вера", 15, 11)];
    expect(upcomingNames(rows, NOV_14_2026)).toEqual(["Вера", "Анна", "Борис"]);
  });
});

describe("Строка контакта в блоке «Скоро день рождения»", () => {
  test("Год известен", () => {
    expect(rowText(row("Анна", 17, 11, 1991), NOV_14_2026)).toBe("17 ноября · через 3 дня · исполнится 35 лет");
  });

  test("Год неизвестен", () => {
    expect(rowText(row("Анна", 15, 11), NOV_14_2026)).toBe("15 ноября · завтра");
  });

  test("Сегодня", () => {
    expect(rowText(row("Анна", 14, 11, 2005), NOV_14_2026)).toBe("14 ноября · сегодня · исполняется 21 год");
  });

  test("Возраст через Новый год", () => {
    expect(rowText(row("Анна", 2, 1, 1990), DEC_28_2026)).toBe("2 января · через 5 дней · исполнится 37 лет");
  });

  test("склонения дней и лет", () => {
    expect(rowText(row("Анна", 16, 11, 2024), NOV_14_2026)).toBe("16 ноября · через 2 дня · исполнится 2 года");
    expect(rowText(row("Анна", 21, 11, 1925), NOV_14_2026)).toBe("21 ноября · через 7 дней · исполнится 101 год");
  });
});
