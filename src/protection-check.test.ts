// Deliberately failing test: checks that branch protection blocks a PR with red CI. Never merge.
import { expect, test } from "vitest";

test("fails on purpose", () => {
  expect(1 + 1).toBe(3);
});
