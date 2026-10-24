// Formatting for UI texts. Runs on the server so that dates match the server's time zone.

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

const pluralRules = new Intl.PluralRules("ru-RU");

// "8 октября 2026"
export function formatDate(date: Date): string {
  return dateFormatter.format(date).replace(/\s*г\.$/, "");
}

// "8 октября 2026 в 19:40"
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} в ${timeFormatter.format(date)}`;
}

export function pluralize(amount: number, one: string, few: string, many: string): string {
  const rule = pluralRules.select(amount);
  if (rule === "one") return one;
  if (rule === "few") return few;
  return many;
}

// "1 000 контактов"
export function formatContactsCount(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ${pluralize(amount, "контакт", "контакта", "контактов")}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar months like in Postgres: January 31 + 1 month is the last day of February.
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function wholeMonthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return addMonths(from, months) > to ? months - 1 : months;
}

// How long ago, rounded down: "9 дней", "5 недель", "4 месяца", "1 год".
export function formatElapsed(from: Date, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY_MS));
  if (days < 14) return `${days} ${pluralize(days, "день", "дня", "дней")}`;
  if (days < 60) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${pluralize(weeks, "неделю", "недели", "недель")}`;
  }
  const months = wholeMonthsBetween(from, now);
  if (months < 12) return `${months} ${pluralize(months, "месяц", "месяца", "месяцев")}`;
  const years = Math.floor(months / 12);
  return `${years} ${pluralize(years, "год", "года", "лет")}`;
}
