// Birthdays: "today" in the app's time zone and who has a birthday soon. Pure functions with "today"
// as input, so every date scenario is testable without faking clocks. Used by the server and by the form.

import { pluralize } from "./format";

// "Today" for birthdays is Moscow time, like the daily backup, whatever the server or browser zone is.
export const APP_TIME_ZONE = "Europe/Moscow";

// How many days ahead the "Скоро день рождения" block looks, besides today.
export const BIRTHDAY_WINDOW_DAYS = 7;

// A calendar day without time; month is 1-12.
export type CalendarDate = { year: number; month: number; day: number };

export type BirthdayFields = {
  birthDay: number | null;
  birthMonth: number | null;
  birthYear: number | null;
};

export type UpcomingBirthday<T> = {
  contact: T;
  // The day the birthday is celebrated (29 February is 28 February in a non-leap year).
  date: CalendarDate;
  // 0 is today.
  daysUntil: number;
  // How old the contact turns that day; null when the birth year is unknown.
  age: number | null;
};

export function todayIn(timeZone: string, now: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Days since the epoch, so the difference between two calendar days does not depend on any time zone.
function dayNumber({ year, month, day }: CalendarDate): number {
  return Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000);
}

function compareDates(a: CalendarDate, b: CalendarDate): number {
  return dayNumber(a) - dayNumber(b);
}

function celebratedIn(year: number, day: number, month: number): CalendarDate {
  return { year, month, day: Math.min(day, daysInMonth(year, month)) };
}

// The nearest celebration not earlier than today: this year, or next year if it has already passed.
export function nextBirthday(day: number, month: number, today: CalendarDate): CalendarDate {
  const thisYear = celebratedIn(today.year, day, month);
  return compareDates(thisYear, today) >= 0 ? thisYear : celebratedIn(today.year + 1, day, month);
}

// Contacts whose birthday is today or within the window, nearest first. The sort is stable, so contacts
// with the same day keep the order they came in (by name, from the database).
export function upcomingBirthdays<T extends BirthdayFields>(
  rows: T[],
  today: CalendarDate,
  windowDays = BIRTHDAY_WINDOW_DAYS,
): UpcomingBirthday<T>[] {
  const result: UpcomingBirthday<T>[] = [];
  for (const contact of rows) {
    if (contact.birthDay === null || contact.birthMonth === null) continue;
    const date = nextBirthday(contact.birthDay, contact.birthMonth, today);
    const daysUntil = compareDates(date, today);
    if (daysUntil > windowDays) continue;
    const age = contact.birthYear === null ? null : date.year - contact.birthYear;
    result.push({ contact, date, daysUntil, age });
  }
  return result.sort((a, b) => a.daysUntil - b.daysUntil);
}

const dayMonthFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });

// "17 ноября"
export function formatDayMonth({ year, month, day }: CalendarDate): string {
  return dayMonthFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

function whenText(daysUntil: number): string {
  if (daysUntil === 0) return "сегодня";
  if (daysUntil === 1) return "завтра";
  return `через ${daysUntil} ${pluralize(daysUntil, "день", "дня", "дней")}`;
}

// "17 ноября · через 3 дня · исполнится 35 лет", "14 ноября · сегодня · исполняется 21 год", "15 ноября · завтра"
export function birthdayRowText(item: Pick<UpcomingBirthday<unknown>, "date" | "daysUntil" | "age">): string {
  const parts = [formatDayMonth(item.date), whenText(item.daysUntil)];
  if (item.age !== null) {
    const verb = item.daysUntil === 0 ? "исполняется" : "исполнится";
    parts.push(`${verb} ${item.age} ${pluralize(item.age, "год", "года", "лет")}`);
  }
  return parts.join(" · ");
}
