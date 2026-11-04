// Runs once before the other e2e tests: signs in as the owner of the test contacts, like a person does,
// and saves the state of the browser. The other tests start already signed in with that state.

import { test as setup } from "@playwright/test";

import { signIn } from "./sign-in-helpers";
import { E2E_AUTH_STATE, E2E_OWNER_EMAIL } from "./test-database";

setup("sign in as the owner", async ({ page }) => {
  await signIn(page, E2E_OWNER_EMAIL);
  await page.context().storageState({ path: E2E_AUTH_STATE });
});
