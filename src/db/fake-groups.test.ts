import { describe, expect, test } from "vitest";

import { generateFakeContacts } from "./fake-contacts";
import { FAKE_GROUP_NAMES, generateFakeGroupAssignments } from "./fake-groups";

describe("generateFakeGroupAssignments", () => {
  test("шесть групп с заданными названиями", () => {
    expect(FAKE_GROUP_NAMES).toEqual(["Семья", "Друзья", "Знакомые", "Коллеги", "Теннис", "Аналитики"]);
  });

  test("детерминирован при одном зерне", () => {
    const first = generateFakeGroupAssignments(200);
    const second = generateFakeGroupAssignments(200);

    expect(second).toEqual(first);
  });

  test("примерно половину контактов раскладывает по группам, часть — в две-три", () => {
    const assignments = generateFakeGroupAssignments(1000);
    const byContact = new Map<number, number[]>();
    for (const { contactIndex, groupIndex } of assignments) {
      const groupIndices = byContact.get(contactIndex) ?? [];
      groupIndices.push(groupIndex);
      byContact.set(contactIndex, groupIndices);
    }

    expect(byContact.size).toBeGreaterThan(350);
    expect(byContact.size).toBeLessThan(650);
    const inMultipleGroups = [...byContact.values()].filter((groupIndices) => groupIndices.length >= 2);
    expect(inMultipleGroups.length).toBeGreaterThan(0);
    for (const groupIndices of byContact.values()) {
      expect(groupIndices.length).toBeGreaterThanOrEqual(1);
      expect(groupIndices.length).toBeLessThanOrEqual(3);
      expect(new Set(groupIndices).size).toBe(groupIndices.length);
    }
  });

  test("не меняет контакты из generateFakeContacts", () => {
    const now = new Date("2026-10-31T12:00:00.000Z");
    const withoutGroups = generateFakeContacts(50, undefined, now);
    generateFakeGroupAssignments(50);
    const withGroups = generateFakeContacts(50, undefined, now);

    expect(withGroups).toEqual(withoutGroups);
  });
});
