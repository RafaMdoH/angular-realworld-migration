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

## Current stack

Angular 22.2 · TypeScript 6.0 · RxJS 7 · rx-angular 22 · zoneless change detection · `@angular/build` (esbuild `application` builder) · Vitest (jsdom).

## Getting started

Requires Node 24 (see `.nvmrc`) and npm.

```bash
nvm use
npm ci
npm start        # dev server at http://localhost:4200
npm test         # Vitest unit tests
npm run build    # production build into dist/
```

> **Note:** the public RealWorld API and theme stylesheet the app depends on are no longer available. Restoring them is out of scope for this project (maintenance, not migration), so the app is validated through its test suite rather than against a live backend.

## About the application

The app is "Conduit", a social blogging site (a Medium.com clone) that follows the [RealWorld](https://github.com/gothinkster/realworld) spec: JWT authentication, CRUD articles, comments, paginated article lists, favorites, and following other users.

## Credits and license

Based on [gothinkster/angular-realworld-example-app](https://github.com/gothinkster/angular-realworld-example-app) by Thinkster, pinned at commit `e28c896`. Distributed under the original [MIT License](LICENSE).
