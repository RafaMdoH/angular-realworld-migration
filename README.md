# Angular RealWorld — incremental migration

[![CI](https://github.com/RafaMdoH/angular-realworld-migration/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/RafaMdoH/angular-realworld-migration/actions/workflows/ci.yml)

A documented, real-world Angular upgrade of the [RealWorld "Conduit" example app](https://github.com/gothinkster/angular-realworld-example-app), from **Angular 15 to the current version, one major version at a time**.

Every stage is a separate, merged and tagged unit with its own decision record: what was diagnosed before touching anything, what `ng update` changed, what broke, how it was verified, and how the result compares with the upstream project's own upgrade.

## Approach

- **Safety net first.** Characterization tests lock the current behavior (including existing bugs) before any upgrade.
- **Migrating ≠ fixing.** Bugs found along the way are locked with explicit `KNOWN BUG (locked)` specs, not silently fixed during an upgrade.
- **One major at a time.** Upgrade and modernization are separate changes; one concept per change.
- **Peer-driven versions.** Third-party versions are chosen by `peerDependencies` matching the Angular major, not by the latest suggestion.
- **Verify, don't trust.** Every stage is checked with build, tests, coverage and mutation checks (break the code on purpose, confirm the tests fail). AI-assisted work is re-verified independently against git.
- **Compare with an answer key.** Each stage is compared with the corresponding upstream upgrade commit.

## Stages

| #   | Stage                                                            | Tag                   | Decision record (EN / ES)                                                                                                     |
| --- | ---------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 00  | Characterization tests (baseline Angular 15.2)                   | `v15-baseline`        | [EN](docs/migration-log/en/00-characterization-tests.md) / [ES](docs/migration-log/es/00-tests-de-caracterizacion.md)         |
| 01  | Angular 15 → 16                                                  | `v16-upgraded`        | [EN](docs/migration-log/en/01-upgrade-angular-16.md) / [ES](docs/migration-log/es/01-upgrade-angular-16.md)                   |
| 02  | Angular 16 → 17                                                  | `v17-upgraded`        | [EN](docs/migration-log/en/02-upgrade-angular-17.md) / [ES](docs/migration-log/es/02-upgrade-angular-17.md)                   |
| 03  | Builder: webpack → esbuild `application` (Angular 17.3)          | `v17-esbuild`         | [EN](docs/migration-log/en/03-esbuild-application-builder.md) / [ES](docs/migration-log/es/03-builder-esbuild-application.md) |
| 04  | Angular 17 → 18                                                  | `v18-upgraded`        | [EN](docs/migration-log/en/04-upgrade-angular-18.md) / [ES](docs/migration-log/es/04-upgrade-angular-18.md)                   |
| 05  | Angular 18 → 19                                                  | `v19-upgraded`        | [EN](docs/migration-log/en/05-upgrade-angular-19.md) / [ES](docs/migration-log/es/05-upgrade-angular-19.md)                   |
| 06  | Runtime: Node 18 → 22 (Angular 19.2)                             | `v19-node22`          | [EN](docs/migration-log/en/06-upgrade-node-22.md) / [ES](docs/migration-log/es/06-upgrade-node-22.md)                         |
| 07  | Angular 19 → 20                                                  | `v20-upgraded`        | [EN](docs/migration-log/en/07-upgrade-angular-20.md) / [ES](docs/migration-log/es/07-upgrade-angular-20.md)                   |
| 08  | Built-in control flow (Angular 20.3)                             | `v20-control-flow`    | [EN](docs/migration-log/en/08-control-flow-migration.md) / [ES](docs/migration-log/es/08-migracion-control-flow.md)           |
| 09  | Angular 20 → 21                                                  | `v21-upgraded`        | [EN](docs/migration-log/en/09-upgrade-angular-21.md) / [ES](docs/migration-log/es/09-upgrade-angular-21.md)                   |
| 10  | Builder package: build-angular → `@angular/build` (Angular 21.2) | `v21-angular-build`   | [EN](docs/migration-log/en/10-angular-build-package.md) / [ES](docs/migration-log/es/10-paquete-angular-build.md)             |
| 11  | Angular 21 → 22 (+ TypeScript 6.0)                               | `v22-upgraded`        | [EN](docs/migration-log/en/11-upgrade-angular-22.md) / [ES](docs/migration-log/es/11-upgrade-angular-22.md)                   |
| 12  | `APP_INITIALIZER` → `provideAppInitializer()` (Angular 22.2)     | `v22-app-initializer` | [EN](docs/migration-log/en/12-provide-app-initializer.md) / [ES](docs/migration-log/es/12-provide-app-initializer.md)         |
| 13  | Runtime: Node 22 → 24 (Angular 22.2)                             | `v22-node24`          | [EN](docs/migration-log/en/13-upgrade-node-24.md) / [ES](docs/migration-log/es/13-upgrade-node-24.md)                         |
| 14  | Tests: Karma + Jasmine → Vitest (Angular 22.2)                   | `v22-vitest`          | [EN](docs/migration-log/en/14-karma-to-vitest.md) / [ES](docs/migration-log/es/14-karma-a-vitest.md)                          |
| 15  | Zoneless change detection (Angular 22.2)                         | `v22-zoneless`        | [EN](docs/migration-log/en/15-zoneless.md) / [ES](docs/migration-log/es/15-zoneless.md)                                       |

Task checklists with verification evidence for each stage live in [`docs/tasks/`](docs/tasks/). Current state and next step: [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md).

Technical closure (problem, hardest decisions, results, lessons, AI-assisted development): [`docs/technical-closure.md`](docs/technical-closure.md) ([ES](docs/technical-closure.es.md)).

## Results (before / after)

"Before" is the Angular 15 baseline (stage 00, tag `v15-baseline`) unless a later stage is named; a metric first recorded at a later stage is marked "not measured" for v15 and its first recorded value is given instead. "After" is `main` after stage 15 plus the closure changes, measured on 2026-11-05 with Node 24.19.0 / npm 11.

| Metric                                               | Before                                                                                                        | After                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Angular                                              | 15.2.3                                                                                                        | 22.2.4 (CLI / `@angular/build` 22.2.6)                                   |
| TypeScript                                           | 4.8                                                                                                           | 6.0.3                                                                    |
| Node                                                 | 18                                                                                                            | 24 (`engines.node` `^24.15.0`)                                           |
| Builder                                              | `@angular-devkit/build-angular:browser` (webpack)                                                             | `@angular/build:application` (esbuild)                                   |
| Test runner                                          | Karma + Jasmine (Chrome headless)                                                                             | Vitest + jsdom (`@angular/build:unit-test`)                              |
| Tests                                                | 67 specs (stage 00)                                                                                           | 143 specs in 32 files                                                    |
| Coverage (statements / branches / functions / lines) | 44.78% / 56% / 41.46% / 42.02% (Karma, istanbul)                                                              | 87.17% / 79.66% / 77.45% / 85.82% (Vitest, `@vitest/coverage-istanbul`)  |
| Initial bundle (raw / transfer)                      | Not measured on v15; first recorded 332.17 kB / 92.64 kB (Angular 17.3, webpack, stage 03)                    | 319.70 kB / 87.46 kB                                                     |
| `dist` output size                                   | 508 KB (stage 00; measurement method not recorded)                                                            | 528 KB (`du -sh dist/angular-conduit`)                                   |
| Installed packages / `node_modules` (`npm ci`)       | Not measured on v15; first recorded 1093 / 511 MB (Angular 21.2, before the builder package switch, stage 10) | 460 / 321 MB                                                             |
| Change detection                                     | zone.js (`~0.12.0`)                                                                                           | Zoneless (`provideZonelessChangeDetection()`, stage 15); zone.js removed |
| `npm audit`                                          | Not measured on v15; first recorded 65, 2 critical (stage 06)                                                 | 4 (2 moderate / 2 high), accepted with reason (see Limitations)          |
| E2E                                                  | None                                                                                                          | 1 Playwright flow with a fully mocked API                                |

Notes:

- The coverage increase is not a migration side effect: it comes from specs added before risky changes (44 template characterization specs before the control-flow migration in stage 08, the interceptor-chain and initializer-wiring integration specs, 21 zoneless specs in stage 15). Coverage was not a target.
- Package counts depend on the npm version: the same lockfile installed 595 packages with npm 10 and 586 with npm 11 (stage 13). The "after" count includes `@playwright/test`.
- Build times are not compared: they vary between runs and the stage logs do not use them as evidence.

## Limitations

- **The app cannot be used live.** The public RealWorld API (`api.realworld.io`) and the theme stylesheet (`demo.productionready.io/main.css`) are no longer available. Restoring them is maintenance, not migration, and is out of scope.
- **Functional validation** is limited to the unit / integration specs (Vitest + jsdom, not a real browser) and one Playwright flow in Chromium with every API call mocked: sign in → home → "Your Feed" → open an article (title, markdown body, comment). No visual validation against the real theme was possible.
- **Inherited defects are locked, not fixed.** Ten findings are pinned by `KNOWN BUG (locked)` specs; the list is in [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md#locked-findings-not-fixed). The E2E flow reproduces finding 7 in a real browser: after sign-in, `HomeComponent` stays on "Global Feed" (and calls `GET /articles`) instead of the user's feed, so the test selects "Your Feed" explicitly.
- **Coverage is not fully comparable across stages.** Karma and Vitest both use istanbul, but with the same tests they report different statements / branches / lines (stage 14; functions are identical). Coverage also has a small nondeterminism: `MarkdownPipe.transform` awaits `import("marked")` and no spec awaits the pipe, so one line may or may not run before teardown (seen as a one-statement difference in CI; stages 14–15).
- **`npm audit` reports 4 findings** (`minimatch`, `ng-morph`, `ts-morph`, `@ts-morph/common`), all from `ng-morph@4`, used only by the `@rx-angular/*` schematics (`ng add` / `ng update`). None reaches the browser bundle. The fix is `ng-morph@5`, which `@rx-angular` 22 does not allow; forcing it with npm `overrides` was rejected. Accepted and tracked; classification in [`docs/tasks/migration-closure.md`](docs/tasks/migration-closure.md) (T1).

## Out of scope

| Improvement                                                                                      | Decision                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Convert all state to signals                                                                     | Out of scope (future opportunity)                             |
| Move all components to `OnPush`                                                                  | Out of scope (future opportunity)                             |
| Reach 90–100 % coverage                                                                          | Not a goal                                                    |
| Fix all inherited defects (locked bugs)                                                          | Out of scope unless a risk is blocking ("migrating ≠ fixing") |
| Rewrite the architecture                                                                         | Out of scope                                                  |
| Add more AI tooling                                                                              | Out of scope                                                  |
| Other follow-ups (`MarkdownPipe` await spec, `$safeNavigationMigration` cleanup, `Eager` review) | Listed as future opportunities, not blocking                  |

## Current stack

Angular 22.2 · TypeScript 6.0 · RxJS 7 · rx-angular 22 · zoneless change detection · `@angular/build` (esbuild `application` builder) · Vitest (jsdom) · Playwright (one E2E flow, mocked API).

## Getting started

Requires Node 24 (see `.nvmrc`) and npm.

```bash
nvm use
npm ci
npm start        # dev server at http://localhost:4200
npm test         # Vitest unit tests (CI: npx ng test --watch=false --coverage)
npm run build    # production build into dist/
npm run e2e      # Playwright E2E flow against a mocked API (starts ng serve)
```

The first E2E run needs the browser: `npx playwright install chromium`.

> **Note:** the public RealWorld API and theme stylesheet the app depends on are no longer available (see [Limitations](#limitations)). `npm start` serves the app, but it cannot load data; it is validated through its specs and the mocked E2E flow.

## About the application

The app is "Conduit", a social blogging site (a Medium.com clone) that follows the [RealWorld](https://github.com/gothinkster/realworld) spec: JWT authentication, CRUD articles, comments, paginated article lists, favorites, and following other users.

## Credits and license

Based on [gothinkster/angular-realworld-example-app](https://github.com/gothinkster/angular-realworld-example-app) by Thinkster, pinned at commit `e28c896`. Distributed under the original [MIT License](LICENSE).
