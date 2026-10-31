// Stands in for the "server-only" package in tests: that package throws outside Next.js,
// but the modules that import it (e.g. src/db/index.ts) are also exercised here.
export {};
