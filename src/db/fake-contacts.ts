// Deterministic generator of realistic test contacts (Russian names and texts).
// The same seed always produces the same contacts.

import { contactFrequency, type ContactFrequency, type NewContact } from "./schema";

type Gender = "m" | "f";

const MALE_FIRST_NAMES = [
  "Александр",
  "Алексей",
  "Андрей",
  "Антон",
  "Арсений",
  "Артём",
  "Борис",
  "Вадим",
  "Валентин",
  "Василий",
  "Виктор",
  "Виталий",
  "Владимир",
  "Владислав",
  "Всеволод",
  "Вячеслав",
  "Глеб",
  "Григорий",
  "Даниил",
  "Денис",
  "Дмитрий",
  "Евгений",
  "Егор",
  "Иван",
  "Игорь",
  "Илья",
  "Кирилл",
  "Константин",
  "Лев",
  "Леонид",
  "Максим",
  "Марк",
  "Матвей",
  "Михаил",
  "Никита",
  "Николай",
  "Олег",
  "Павел",
  "Пётр",
  "Роман",
  "Руслан",
  "Семён",
  "Сергей",
  "Станислав",
  "Степан",
  "Тимофей",
  "Тимур",
  "Фёдор",
  "Юрий",
  "Ярослав",
];

const FEMALE_FIRST_NAMES = [
  "Александра",
  "Алёна",
  "Алина",
  "Алиса",
  "Анастасия",
  "Ангелина",
  "Анна",
  "Валентина",
  "Валерия",
  "Варвара",
  "Василиса",
  "Вера",
  "Вероника",
  "Виктория",
  "Галина",
  "Дарья",
  "Диана",
  "Ева",
  "Евгения",
  "Екатерина",
  "Елена",
  "Елизавета",
  "Жанна",
  "Зоя",
  "Инна",
  "Ирина",
  "Карина",
  "Кира",
  "Ксения",
  "Лариса",
  "Лидия",
  "Любовь",
  "Людмила",
  "Маргарита",
  "Марина",
  "Мария",
  "Милана",
  "Надежда",
  "Наталья",
  "Нина",
  "Оксана",
  "Ольга",
  "Полина",
  "Светлана",
  "София",
  "Таисия",
  "Татьяна",
  "Ульяна",
  "Юлия",
  "Яна",
];

// Male forms; female forms are derived in femaleLastName().
const LAST_NAMES = [
  "Иванов",
  "Смирнов",
  "Кузнецов",
  "Попов",
  "Васильев",
  "Петров",
  "Соколов",
  "Михайлов",
  "Новиков",
  "Фёдоров",
  "Морозов",
  "Волков",
  "Алексеев",
  "Лебедев",
  "Семёнов",
  "Егоров",
  "Павлов",
  "Козлов",
  "Степанов",
  "Николаев",
  "Орлов",
  "Андреев",
  "Макаров",
  "Никитин",
  "Захаров",
  "Зайцев",
  "Соловьёв",
  "Борисов",
  "Яковлев",
  "Григорьев",
  "Романов",
  "Воробьёв",
  "Сергеев",
  "Кузьмин",
  "Фролов",
  "Александров",
  "Дмитриев",
  "Королёв",
  "Гусев",
  "Киселёв",
  "Ильин",
  "Максимов",
  "Поляков",
  "Сорокин",
  "Виноградов",
  "Ковалёв",
  "Белов",
  "Медведев",
  "Антонов",
  "Тарасов",
  "Жуков",
  "Баранов",
  "Филиппов",
  "Комаров",
  "Давыдов",
  "Беляев",
  "Герасимов",
  "Богданов",
  "Осипов",
  "Сидоров",
  "Матвеев",
  "Титов",
  "Марков",
  "Миронов",
  "Крылов",
  "Куликов",
  "Карпов",
  "Власов",
  "Мельников",
  "Денисов",
  "Гаврилов",
  "Тихонов",
  "Казаков",
  "Афанасьев",
  "Данилов",
  "Савельев",
  "Тимофеев",
  "Фомин",
  "Чернов",
  "Абрамов",
  "Мартынов",
  "Ефимов",
  "Федотов",
  "Щербаков",
  "Назаров",
  "Калинин",
  "Исаев",
  "Чернышёв",
  "Быков",
  "Маслов",
  "Родионов",
  "Коновалов",
  "Лазарев",
  "Воронин",
  "Климов",
  "Филатов",
  "Пономарёв",
  "Голубев",
  "Кудрявцев",
  "Прохоров",
  "Наумов",
  "Потапов",
  "Журавлёв",
  "Овчинников",
  "Трофимов",
  "Леонов",
  "Соболев",
  "Ермаков",
  "Колесников",
  "Гончаров",
  "Емельянов",
  "Никифоров",
  "Грачёв",
  "Котов",
  "Гришин",
  "Ефремов",
  "Архипов",
  "Громов",
  "Кириллов",
  "Малышев",
  "Панов",
  "Моисеев",
  "Румянцев",
  "Акимов",
  "Кондратьев",
  "Бирюков",
  "Горбунов",
  "Анисимов",
  "Тихомиров",
  "Галкин",
  "Лукьянов",
  "Михеев",
  "Скворцов",
  "Юдин",
  "Белоусов",
  "Нестеров",
  "Симонов",
  "Прокофьев",
  "Харитонов",
  "Князев",
  "Цветков",
  "Левин",
  "Митрофанов",
  "Воронов",
  "Аксёнов",
  "Мальцев",
  "Логинов",
  "Горшков",
  "Савин",
  "Краснов",
  "Майоров",
  "Демидов",
  "Елисеев",
  "Рыбаков",
  "Сафонов",
  "Плотников",
  "Хохлов",
  "Фадеев",
  "Молчанов",
  "Литвинов",
  "Ершов",
  "Ушаков",
  "Рябов",
  "Мухин",
  "Калашников",
  "Лобанов",
  "Корнилов",
  "Бородин",
  "Платонов",
  "Некрасов",
  "Бобров",
  "Жданов",
  "Блинов",
  "Коротков",
  "Муравьёв",
  "Крюков",
  "Дроздов",
  "Лавров",
  "Зуев",
  "Ларин",
  "Никулин",
  "Серов",
  "Зотов",
  "Устинов",
  "Фокин",
  "Самойлов",
  "Сахаров",
  "Шишкин",
  "Чистяков",
  "Носов",
  "Воронцов",
  "Зверев",
  "Нечаев",
  "Седов",
  "Головин",
  "Терехов",
  "Шестаков",
  "Гордеев",
  "Зимин",
  "Костин",
  "Широков",
  "Суворов",
  "Корнеев",
  "Булгаков",
  "Шубин",
  "Островский",
  "Высоцкий",
  "Вишневский",
  "Покровский",
  "Успенский",
  "Белецкий",
  "Толстой",
  "Шевченко",
  "Бондаренко",
  "Коваленко",
  "Ким",
  "Цой",
  "Гарипов",
  "Сафин",
];

const CITIES_IN = [
  "в Москве",
  "в Санкт-Петербурге",
  "в Казани",
  "в Новосибирске",
  "в Екатеринбурге",
  "в Нижнем Новгороде",
  "в Сочи",
  "в Калининграде",
  "в Краснодаре",
  "в Самаре",
  "в Перми",
  "в Тбилиси",
  "в Ереване",
  "в Белграде",
  "в Стамбуле",
  "в Ярославле",
  "в Твери",
];

const CITIES_TO = [
  "в Москву",
  "в Санкт-Петербург",
  "в Казань",
  "в Новосибирск",
  "в Екатеринбург",
  "в Сочи",
  "в Калининград",
  "в Тбилиси",
  "в Ереван",
  "в Белград",
  "в Ярославль",
];

const PROFESSIONS = [
  "Дизайнер интерфейсов",
  "Фронтенд-разработчик",
  "Бэкенд-разработчик",
  "Продакт-менеджер",
  "Аналитик данных",
  "Бухгалтер",
  "Юрист по недвижимости",
  "Нотариус",
  "Стоматолог",
  "Терапевт",
  "Ветеринар",
  "Фотограф",
  "Архитектор",
  "Учитель математики",
  "Преподаватель английского",
  "Тренер по плаванию",
  "Фитнес-тренер",
  "Риелтор",
  "Автомеханик",
  "Мастер по ремонту квартир",
  "Электрик",
  "Повар",
  "Владелец кофейни",
  "Маркетолог",
  "HR-менеджер",
  "Рекрутер",
  "Журналист",
  "Редактор",
  "Переводчик",
  "Психолог",
  "Финансовый консультант",
  "Основатель стартапа",
  "Музыкант",
  "Художник",
  "Сценарист",
  "Видеооператор",
  "Педиатр",
  "Инженер-конструктор",
  "Системный администратор",
  "DevOps-инженер",
  "Тестировщик",
  "Тимлид",
  "Технический директор",
  "Event-менеджер",
  "Флорист",
  "Парикмахер",
  "Массажист",
  "Иллюстратор",
  "Звукорежиссёр",
  "Логопед",
];

const WORKPLACES = [
  "в банке",
  "в IT-компании",
  "в рекламном агентстве",
  "в издательстве",
  "в школе",
  "в частной клинике",
  "в архитектурном бюро",
  "в студии брендинга",
  "в стартапе",
  "на заводе",
  "в университете",
  "в консалтинге",
  "на фрилансе",
  "в своей студии",
  "в маркетплейсе",
  "в театре",
];

// [male form, female form]
const RELATIONS: [string, string][] = [
  ["Друг детства", "Подруга детства"],
  ["Бывший коллега", "Бывшая коллега"],
  ["Однокурсник", "Однокурсница"],
  ["Одноклассник", "Одноклассница"],
  ["Сосед по даче", "Соседка по даче"],
  ["Сосед по подъезду", "Соседка по подъезду"],
  ["Знакомый по йоге", "Знакомая по йоге"],
  ["Друг брата", "Подруга сестры"],
  ["Знакомый по бегу", "Знакомая по бегу"],
  ["Коллега по прошлой работе", "Коллега по прошлой работе"],
  ["Папа одноклассника сына", "Мама одноклассницы дочки"],
  ["Знакомый по походам", "Знакомая по походам"],
];

const UNIVERSITIES = ["МГУ", "СПбГУ", "МФТИ", "ВШЭ", "МГТУ им. Баумана", "УрФУ", "КФУ", "НГУ", "ИТМО"];
const HIKES = ["Алтаю", "Карелии", "Кавказу", "Байкалу", "Хибинам", "Уралу", "Крыму"];
const COURSES = [
  "английского",
  "гончарного дела",
  "фотографии",
  "программирования",
  "испанского",
  "актёрского мастерства",
  "вождения",
  "рисования",
];
const COMPANIES = [
  "в банке",
  "в агентстве",
  "в стартапе",
  "в IT-компании",
  "в издательстве",
  "в школе",
  "на прошлой работе",
  "в консалтинге",
];
const BOOKS = [
  "«Мастер и Маргарита»",
  "«Сто лет одиночества»",
  "«Задача трёх тел»",
  "«Дюна»",
  "«Атлант расправил плечи»",
  "«Тонкое искусство пофигизма»",
  "«Пикник на обочине»",
];
const HOBBIES = [
  "скалолазанием",
  "керамикой",
  "настольными играми",
  "велосипедом",
  "фотографией",
  "виниловыми пластинками",
  "сапбордингом",
  "горными лыжами",
  "шахматами",
  "садоводством",
];
const DOG_NAMES = ["Бублик", "Тайсон", "Луна", "Ричи", "Марта", "Граф", "Пончик", "Джек"];
const MONTHS_IN = [
  "в январе",
  "в феврале",
  "в марте",
  "в апреле",
  "в мае",
  "в июне",
  "в июле",
  "в августе",
  "в сентябре",
  "в октябре",
  "в ноябре",
  "в декабре",
];
const EMAIL_DOMAINS = [
  "gmail.com",
  "yandex.ru",
  "mail.ru",
  "proton.me",
  "outlook.com",
  "icloud.com",
  "ya.ru",
  "bk.ru",
  "inbox.ru",
];

const TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const DAY_MS = 24 * 60 * 60 * 1000;

// mulberry32: small, fast, deterministic PRNG.
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    chance: (probability: number) => next() < probability,
  };
}

type Random = ReturnType<typeof createRandom>;

function femaleLastName(male: string): string {
  if (male.endsWith("ский") || male.endsWith("цкий")) return `${male.slice(0, -2)}ая`;
  if (male.endsWith("ой")) return `${male.slice(0, -2)}ая`;
  if (/(ов|ев|ёв|ин|ын)$/.test(male)) return `${male}а`;
  return male; // Indeclinable surnames: Шевченко, Ким, Цой.
}

function transliterate(text: string): string {
  return [...text.toLowerCase()].map((char) => TRANSLIT[char] ?? char).join("");
}

function byGender(gender: Gender, male: string, female: string) {
  return gender === "m" ? male : female;
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}`;
}

// Lowercases the first letter of a Cyrillic word; keeps Latin words like "DevOps" or "HR" intact.
function lowerFirst(text: string): string {
  return /^[А-ЯЁ]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function randomPerson(random: Random) {
  const gender: Gender = random.chance(0.5) ? "m" : "f";
  const firstName = random.pick(gender === "m" ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
  const maleLastName = random.pick(LAST_NAMES);
  const lastName = gender === "m" ? maleLastName : femaleLastName(maleLastName);
  return { gender, firstName, lastName };
}

function makeAbout(random: Random, gender: Gender): string | null {
  const roll = random.next();
  if (roll < 0.05) return null;
  if (roll < 0.45) {
    const profession = random.pick(PROFESSIONS);
    return random.chance(0.5) ? `${profession} ${random.pick(WORKPLACES)}` : profession;
  }
  const [male, female] = random.pick(RELATIONS);
  const relation = byGender(gender, male, female);
  if (roll < 0.7) return relation;
  return `${relation}, сейчас ${lowerFirst(random.pick(PROFESSIONS))}`;
}

function makeHowWeMet(random: Random, gender: Gender): string | null {
  const friend = randomPerson(random);
  const friendShort = `${friend.firstName} ${friend.lastName}`;
  const year = random.int(2008, 2025);
  const options = [
    () => `Учились вместе в ${random.pick(UNIVERSITIES)}`,
    () => `Учились в одной школе, в параллельных классах`,
    () => `Познакомились на конференции ${random.pick(CITIES_IN)} в ${year} году`,
    () => {
      const start = random.int(2010, 2021);
      return `Работали вместе ${random.pick(COMPANIES)} в ${start}–${start + random.int(1, 4)}`;
    },
    () => `${byGender(friend.gender, "Познакомил", "Познакомила")} ${friendShort}`,
    () => `Через общих друзей, на дне рождения у ${byGender(friend.gender, "друга", "подруги")}`,
    () => `Соседи по дому, живём в одном подъезде`,
    () => `Познакомились в походе по ${random.pick(HIKES)} в ${year} году`,
    () => `Вместе ходили на курсы ${random.pick(COURSES)}`,
    () => "На свадьбе общих друзей — сидели за одним столом",
    () => `Нашли по рекомендации, ${byGender(gender, "делал", "делала")} нам ремонт`,
    () => `Разговорились в самолёте ${random.pick(CITIES_TO)}`,
    () => `Ходим в один спортзал`,
    () => `Через чат дома — ${byGender(gender, "помог", "помогла")} с парковкой`,
    () => `Познакомились на работе: ${byGender(gender, "был подрядчиком", "была подрядчиком")} на проекте`,
    () => `Были вместе в летнем лагере в детстве`,
    () => `Познакомились на митапе ${random.pick(CITIES_IN)}`,
  ];
  if (random.chance(0.1)) return null;
  return random.pick(options)();
}

function makeNoteText(random: Random, gender: Gender): string {
  const options = [
    () => "Созвонились, договорились встретиться после праздников.",
    () => `${byGender(gender, "Обещал", "Обещала")} прислать контакты хорошего юриста.`,
    () =>
      `Пили кофе. ${byGender(gender, "Рассказал", "Рассказала")}, что ищет новую работу — договорились, что я перешлю вакансии.`,
    () => `Договорились созвониться ${random.pick(MONTHS_IN)}.`,
    () => `Вернуть книгу ${random.pick(BOOKS)}.`,
    () => `${byGender(gender, "Посоветовал", "Посоветовала")} курс по фотографии — надо посмотреть.`,
    () => `Есть собака по кличке ${random.pick(DOG_NAMES)}.`,
    () => "Не ест мясо — учесть, если зовём в гости.",
    () => `Увлекается ${random.pick(HOBBIES)}.`,
    () => `${byGender(gender, "Переехал", "Переехала")} ${random.pick(CITIES_TO)}, будет в городе наездами.`,
    () => `${byGender(gender, "Помог", "Помогла")} с переездом — с меня ужин.`,
    () => "Ищет квартиру в аренду, двушку рядом с метро. Если что-то попадётся — написать.",
    () => "Позвать на новоселье.",
    () => `Договорились вместе сходить на концерт ${random.pick(MONTHS_IN)}.`,
    () => "Обсудили проект — ждёт от меня смету до пятницы.",
    () => "Спросить, как прошла операция у мамы.",
    () => "Скинуть фото с поездки.",
    () => `Хочет попробовать заниматься ${random.pick(HOBBIES)} — позвать с нами в следующий раз.`,
    () => `${byGender(gender, "Должен", "Должна")} мне ${random.int(1, 9) * 500} ₽ за билеты, не к спеху.`,
    () =>
      `День рождения ${random.int(1, 28)} ${random.pick(["марта", "мая", "июля", "сентября", "ноября", "января"])} — поздравить.`,
    () => "Встретились на выставке, договорились сделать совместный проект весной.",
    () => `${byGender(gender, "Готов", "Готова")} помочь с рекомендацией в свою компанию.`,
    () => "Обменялись книгами, договорились обсудить, когда дочитаем.",
    () => "Созвонились по видео, обсудили идеи для стартапа. Следующий созвон через две недели.",
  ];
  return random.pick(options)();
}

function makeNotes(random: Random, gender: Gender, from: Date, to: Date) {
  const count = random.chance(0.2) ? 0 : random.int(1, 4);
  if (count === 0) return { notes: null, lastNoteAt: null };
  const span = Math.max(to.getTime() - from.getTime(), DAY_MS);
  const dates = Array.from({ length: count }, () => new Date(from.getTime() + random.next() * span)).sort(
    (a, b) => a.getTime() - b.getTime(),
  );
  const lines = dates.map((date) => `${formatDate(date)} — ${makeNoteText(random, gender)}`);
  return { notes: lines.join("\n\n"), lastNoteAt: dates[dates.length - 1] };
}

// Shortest and longest period of each frequency, in days.
const PERIOD_DAYS: Record<ContactFrequency, [number, number]> = {
  week: [7, 7],
  month: [28, 31],
  quarter: [89, 92],
  year: [365, 366],
};

// About half of the contacts given a frequency are overdue: 10–15 rows in "Пора связаться".
const OVERDUE_SHARE = 0.5;

// Frequency and moments of contact for "Пора связаться". The period start stays at least 3 days
// away from the end of the period, so the same contacts are overdue on whatever day the seed runs.
function makeKeepInTouch(random: Random, now: Date, hasNotes: boolean) {
  const frequency = random.pick(contactFrequency.enumValues);
  const [shortest, longest] = PERIOD_DAYS[frequency];
  const startDaysAgo = random.chance(OVERDUE_SHARE)
    ? longest + random.int(3, shortest + 3)
    : random.int(0, shortest - 3);
  const start = new Date(now.getTime() - (startDaysAgo + random.next() * 0.9) * DAY_MS);
  const daysBeforeStart = (days: number) => new Date(start.getTime() - days * DAY_MS);

  // The period starts at the latest of the three moments; which one it is differs from contact to contact.
  const kind = random.pick(hasNotes ? (["note", "contacted", "chosen"] as const) : (["contacted", "chosen"] as const));
  if (kind === "chosen") {
    return { contactFrequency: frequency, frequencySetAt: start, lastNoteAt: null, lastContactedAt: null };
  }
  const frequencySetAt = daysBeforeStart(random.int(1, 60));
  if (kind === "note") {
    return { contactFrequency: frequency, frequencySetAt, lastNoteAt: start, lastContactedAt: null };
  }
  return {
    contactFrequency: frequency,
    frequencySetAt,
    lastNoteAt: hasNotes ? daysBeforeStart(random.int(5, 120)) : null,
    lastContactedAt: start,
  };
}

function makePhone(random: Random): string | null {
  if (random.chance(0.12)) return null;
  const digits = (length: number) => Array.from({ length }, () => random.int(0, 9)).join("");
  if (random.chance(0.03)) {
    const code = random.pick(["+374", "+995", "+381", "+90"]);
    return `${code} ${digits(2)} ${digits(3)} ${digits(3)}`;
  }
  return `+7 9${digits(2)} ${digits(3)}-${digits(2)}-${digits(2)}`;
}

function makeEmail(random: Random, firstName: string, lastName: string): string | null {
  if (random.chance(0.3)) return null;
  const first = transliterate(firstName);
  const last = transliterate(lastName);
  const local = random.pick([
    `${first}.${last}`,
    `${first[0]}.${last}`,
    `${last}${random.int(70, 99)}`,
    `${first}${last}`,
    `${first}_${last}`,
    `${last}.${first}`,
  ]);
  return `${local}@${random.pick(EMAIL_DOMAINS)}`;
}

export function generateFakeContacts(count: number, seed = 20261008, now = new Date()): NewContact[] {
  const random = createRandom(seed);
  // A separate stream: adding "Пора связаться" data does not change the other contacts.
  const keepInTouchRandom = createRandom(seed + 1);
  const usedNames = new Set<string>();
  const result: NewContact[] = [];
  const fourYearsAgo = new Date(now.getTime() - 4 * 365 * DAY_MS);

  while (result.length < count) {
    const { gender, firstName, lastName } = randomPerson(random);
    const name = `${firstName} ${lastName}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);

    const createdAt = new Date(
      fourYearsAgo.getTime() + random.next() * (now.getTime() - fourYearsAgo.getTime() - DAY_MS),
    );
    const { notes, lastNoteAt } = makeNotes(random, gender, createdAt, now);
    const contact: NewContact = {
      name,
      about: makeAbout(random, gender),
      howWeMet: makeHowWeMet(random, gender),
      phone: makePhone(random),
      email: makeEmail(random, firstName, lastName),
      notes,
      createdAt,
      updatedAt: lastNoteAt ?? createdAt,
    };

    // Only contacts added long ago, so that every moment falls after the contact was added.
    if (createdAt.getTime() < now.getTime() - 800 * DAY_MS && keepInTouchRandom.chance(0.06)) {
      const keepInTouch = makeKeepInTouch(keepInTouchRandom, now, notes !== null);
      Object.assign(contact, keepInTouch);
      contact.updatedAt = new Date(
        Math.max(
          contact.updatedAt!.getTime(),
          keepInTouch.frequencySetAt.getTime(),
          keepInTouch.lastNoteAt?.getTime() ?? 0,
        ),
      );
    }

    result.push(contact);
  }

  return result;
}
