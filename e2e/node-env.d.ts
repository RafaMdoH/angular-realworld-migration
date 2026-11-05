// Minimal typing for the only Node global used by playwright.config.ts.
// Avoids adding @types/node just to type-check the e2e sources.
declare const process: { env: Record<string, string | undefined> };
