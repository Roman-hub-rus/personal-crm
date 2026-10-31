// Group rules shared by the browser, the server and the tests: no "server-only" here.
// Decisions behind this module are in openspec/changes/groups/design.md (decision 2).

import { z } from "zod";

export const GROUP_NAME_MAX_LENGTH = 50;

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Введите название группы")
  .max(GROUP_NAME_MAX_LENGTH, "Название слишком длинное — не больше 50 символов");

export type GroupOption = { id: number; name: string };

function sameGroupName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// What happens when the user types a group name and confirms it in the "Группы" field:
// picks the existing group (case-insensitively) or proposes a new one.
export type PickedGroup =
  | { kind: "error"; message: string }
  | { kind: "existing"; id: number }
  | { kind: "new"; name: string };

export function pickGroupByName(input: string, groups: GroupOption[]): PickedGroup {
  const parsed = groupNameSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "error", message: parsed.error.issues[0].message };
  }
  const existing = groups.find((group) => sameGroupName(group.name, parsed.data));
  return existing ? { kind: "existing", id: existing.id } : { kind: "new", name: parsed.data };
}

export type GroupSelection = { groupIds: number[]; newGroups: string[] };

function sortedNumbers(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function sortedNames(values: string[]): string[] {
  return [...values].map((value) => value.trim().toLowerCase()).sort();
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// "Есть несохранённые изменения" also fires when only the group selection changed.
export function areGroupSelectionsEqual(a: GroupSelection, b: GroupSelection): boolean {
  return (
    arraysEqual(sortedNumbers(a.groupIds), sortedNumbers(b.groupIds)) &&
    arraysEqual(sortedNames(a.newGroups), sortedNames(b.newGroups))
  );
}

const MAX_VISIBLE_LABELS = 3;

// Up to three group names for the list row, plus the number of the rest ("+N").
export function splitGroupLabels(names: string[]): { shown: string[]; hiddenCount: number } {
  return { shown: names.slice(0, MAX_VISIBLE_LABELS), hiddenCount: Math.max(0, names.length - MAX_VISIBLE_LABELS) };
}

export type HomeHrefParams = { query?: string; groupId?: number | null };

// The home page address for a search query and/or a selected group; "/" when both are empty.
export function homeHref({ query = "", groupId = null }: HomeHrefParams = {}): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (groupId !== null) params.set("group", String(groupId));
  const search = params.toString();
  return search ? `/?${search}` : "/";
}

// The card address, carrying the same search query and selected group as the home page.
export function contactHref(contactId: number, { query = "", groupId = null }: HomeHrefParams = {}): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (groupId !== null) params.set("group", String(groupId));
  const search = params.toString();
  return search ? `/contacts/${contactId}?${search}` : `/contacts/${contactId}`;
}

export type BackLink = { text: string; href: string };

// The "back" link under the card: to the search results, to the selected group, or to everyone.
export function backLink({
  query = "",
  groupId = null,
  groupName = null,
}: {
  query?: string;
  groupId?: number | null;
  groupName?: string | null;
}): BackLink {
  if (query) {
    return { text: "К результатам поиска", href: homeHref({ query, groupId }) };
  }
  if (groupId !== null && groupName !== null) {
    return { text: `К группе «${groupName}»`, href: homeHref({ groupId }) };
  }
  return { text: "Все контакты", href: "/" };
}

// Parses "?group=" from the address, picking the group only if it still exists; "Все" otherwise.
export function parseGroupId(value: string | undefined, groups: GroupOption[]): number | null {
  if (value === undefined) return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return groups.some((group) => group.id === id) ? id : null;
}

export type GroupFilterItem = { id: number | null; name: string; href: string; isSelected: boolean };

// The row of filter buttons on the home page: "Все" plus every group, in that order.
// Empty when there are no groups, so the row is not rendered at all.
export function groupFilterItems(groups: GroupOption[], selectedGroupId: number | null, query = ""): GroupFilterItem[] {
  if (groups.length === 0) return [];
  return [
    { id: null, name: "Все", href: homeHref({ query }), isSelected: selectedGroupId === null },
    ...groups.map((group) => ({
      id: group.id,
      name: group.name,
      href: homeHref({ query, groupId: group.id }),
      isSelected: selectedGroupId === group.id,
    })),
  ];
}
