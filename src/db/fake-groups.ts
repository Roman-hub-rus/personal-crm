// Deterministic generator of group assignments for test data (`pnpm db:seed`).
// Runs on its own random stream so it never changes the contacts from generateFakeContacts.

import { createRandom } from "./fake-contacts";

export const FAKE_GROUP_NAMES = ["Семья", "Друзья", "Знакомые", "Коллеги", "Теннис", "Аналитики"];

export type FakeGroupAssignment = { contactIndex: number; groupIndex: number };

// About half of the contacts get one group, most of the rest two or three.
export function generateFakeGroupAssignments(contactCount: number, seed = 20261008 + 2): FakeGroupAssignment[] {
  const random = createRandom(seed);
  const assignments: FakeGroupAssignment[] = [];

  for (let contactIndex = 0; contactIndex < contactCount; contactIndex++) {
    if (!random.chance(0.5)) continue;

    const groupCount = random.chance(0.7) ? 1 : random.int(2, 3);
    const groupIndices = new Set<number>();
    while (groupIndices.size < groupCount) {
      groupIndices.add(random.int(0, FAKE_GROUP_NAMES.length - 1));
    }
    for (const groupIndex of groupIndices) {
      assignments.push({ contactIndex, groupIndex });
    }
  }

  return assignments;
}
