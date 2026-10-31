// Kept separate from vitest.config.ts so vitest.global-setup.ts and vitest.setup.ts never
// have to import the config file itself: Vite's config loader does not expect that.
export const VITEST_DATABASE_SUFFIX = "_test";
