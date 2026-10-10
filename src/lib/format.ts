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
