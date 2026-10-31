import { describe, expect, test } from "vitest";

import {
  areGroupSelectionsEqual,
  backLink,
  groupFilterItems,
  groupNameSchema,
  homeHref,
  parseGroupId,
  pickGroupByName,
  splitGroupLabels,
} from "./contact-groups";

const GROUPS = [
  { id: 1, name: "Теннис" },
  { id: 2, name: "Друзья" },
];

describe("groupNameSchema", () => {
  test("Неверное название в карточке", () => {
    expect(groupNameSchema.safeParse("   ").error?.issues[0].message).toBe("Введите название группы");
    expect(groupNameSchema.safeParse("а".repeat(51)).error?.issues[0].message).toBe(
      "Название слишком длинное — не больше 50 символов",
    );
  });
});

describe("pickGroupByName", () => {
  test("Вписал название существующей группы", () => {
    expect(pickGroupByName("теннис", GROUPS)).toEqual({ kind: "existing", id: 1 });
  });

  test("предлагает новую группу, если такой ещё нет", () => {
    expect(pickGroupByName("Аналитики", GROUPS)).toEqual({ kind: "new", name: "Аналитики" });
  });
});

describe("areGroupSelectionsEqual", () => {
  test("Несохранённый выбор групп", () => {
    expect(areGroupSelectionsEqual({ groupIds: [1, 2], newGroups: [] }, { groupIds: [1], newGroups: [] })).toBe(false);
    expect(
      areGroupSelectionsEqual(
        { groupIds: [2, 1], newGroups: ["Аналитики"] },
        { groupIds: [1, 2], newGroups: ["аналитики"] },
      ),
    ).toBe(true);
  });
});

describe("splitGroupLabels", () => {
  test("Контакт в пяти группах", () => {
    expect(splitGroupLabels(["Аналитики", "Друзья", "Коллеги", "Семья", "Теннис"])).toEqual({
      shown: ["Аналитики", "Друзья", "Коллеги"],
      hiddenCount: 2,
    });
  });
});

describe("homeHref", () => {
  test("Открыть группу со страницы «Группы»", () => {
    expect(homeHref({ groupId: 5 })).toBe("/?group=5");
  });

  test("Вернулся ко всем", () => {
    expect(homeHref({ groupId: null })).toBe("/");
  });

  test("Сменил группу во время поиска", () => {
    expect(homeHref({ query: "аня", groupId: 5 })).toBe("/?q=%D0%B0%D0%BD%D1%8F&group=5");
  });
});

describe("parseGroupId", () => {
  test("Тот же адрес в другом браузере", () => {
    expect(parseGroupId("1", GROUPS)).toBe(1);
  });

  test("Группы из адреса уже нет", () => {
    expect(parseGroupId("999", GROUPS)).toBe(null);
  });
});

describe("groupFilterItems", () => {
  test("Групп нет", () => {
    expect(groupFilterItems([], null)).toEqual([]);
  });
});

describe("backLink", () => {
  test("Назад к группе", () => {
    expect(backLink({ groupId: 1, groupName: "Теннис" })).toEqual({
      text: "К группе «Теннис»",
      href: "/?group=1",
    });
  });

  test("Назад к поиску в группе", () => {
    expect(backLink({ query: "аня", groupId: 1, groupName: "Теннис" })).toEqual({
      text: "К результатам поиска",
      href: homeHref({ query: "аня", groupId: 1 }),
    });
  });

  test("Назад к группе из блока «Пора связаться»", () => {
    expect(backLink({ groupId: 1, groupName: "Теннис" })).toEqual({
      text: "К группе «Теннис»",
      href: "/?group=1",
    });
  });
});
