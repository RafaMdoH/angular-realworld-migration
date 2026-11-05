# Feature: upgrade-angular-21

## Objective

Upgrade from Angular 20.3 to Angular 21.2 (one major) with build and characterization tests green.

## Problem / Why

Ninth stage. Upgrade only: zoneless change detection, signal forms, Vitest and other v21 features are modernization and go in separate features. Built-in control flow was already migrated in stage 08, so v21's mandatory `control-flow-migration` should find nothing to convert.

## Scope

- `@angular/*` 20.3 → 21.2 via `ng update` (including automatic migrations).
- TypeScript 5.8 → 5.9 (required peer `>=5.9 <6.1`).
- `@rx-angular/cdk` 20.1.1 → 21.1.1, `@rx-angular/template` 20.1.0 → 21.2.1 (peer `@angular/core ^21`; template 21.2.1 pins cdk to exactly `21.1.1`).
- Out of scope: zoneless, Vitest, signal forms, builder package switch, `APP_INITIALIZER` → `provideAppInitializer()`, Node 24, locked bug fixes.

## Constraints

- Angular 21.2 requires Node `^20.19.0 || ^22.12.0 || >=24.0.0` → Node 22.23.4 OK; zone.js `~0.15.0 || ~0.16.0` → 0.15.1 OK.
- The app bootstraps with `platformBrowserDynamic().bootstrapModule(AppModule)` and loads `zone.js` as a polyfill; check what `bootstrap-options-migration` does with change detection.

## Checklist

- [x] T1 Diagnosis (stage 08 T1 + rx-angular 21 peers)
- [x] T2 `ng update @angular/core@21 @angular/cli@21` + review automatic migrations
- [x] T3 `@rx-angular/cdk@21.1.1` + `@rx-angular/template@21.2.1`
- [x] T4 Verify: tests, build, metrics; compare with upstream `33bf8c3`
- [x] T5 Migration log `docs/migration-log/{es,en}/09-*.md`, README, `PROJECT_CONTEXT.md`
- [x] T6 Merge `--no-ff` + tag `v21-upgraded` (with user approval); CI green on GitHub

## Acceptance criteria

- 120/120 specs green with the same assertions; `ng build` green; only official-migration changes in production and test code (documented).

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- T1 (inline): requirements and v21 migration list recorded in `docs/tasks/migrate-control-flow.md` (T1). rx-angular 21: `cdk@21.1.1` (peer `@angular/core ^21.0.0`), `template@21.2.1` (peer `@angular/core ^21.0.0`, `@rx-angular/cdk` exactly `21.1.1`). Latest: `@angular/core` 21.2.26, `@angular/cli` 21.2.29, `typescript` 5.9.3. Baseline (v20 + control flow, stage 08 T4): 120/120, coverage 76.92 / 74 / 68.29 / 75.65, build 2.4 / 1.7 / 1.7 s, initial 337.58 kB raw / 96.02 kB transfer.

- T2 (`0ca3bc5`): Angular 21.2.26 / CLI 21.2.29, TypeScript 5.8.3 → 5.9.3 (set by `ng update`), zone.js 0.15.1 unchanged. Migrations with changes: `bootstrap-options-migration` → `src/main.ts` now passes `applicationProviders: [provideZoneChangeDetection()]` to `bootstrapModule` (v21 defaults to zoneless change detection; the provider keeps the app on zone.js-based change detection, so behavior is unchanged); `update-typescript-lib` → removed `"lib": ["ES2022", "dom"]` from `tsconfig.json` (with `target: ES2022` the default lib is the same). No-op: `control-flow-migration` (already done in stage 08), `remove-default-karma-config`, `update-module-resolution`, `add-bootstrap-context-to-server-main`, `application-config-core`, `router-last-successful-navigation`. Optional not run: `use-application-builder`, `router-current-navigation`.
- T3 (`9e50562`): `@rx-angular/cdk@21.1.1`, `@rx-angular/template@21.2.1` (caret ranges, as before). No `EBADENGINE` / `ERESOLVE`. Note: template 21.2.1 pins cdk to exactly `21.1.1` while `package.json` declares `^21.1.1`; a future cdk 21.1.x would conflict on `npm install` (the lockfile protects `npm ci`).
- T4: 120/120 green, no spec changed; coverage unchanged (76.92 / 74 / 68.29 / 75.65). No compiler warnings. Prod build 2.3 / 2.3 / 2.3 s (first run after `ng update`: 2.6 s). Initial total 346.08 kB raw / 97.59 kB transfer (v20: 337.58 / 96.02, +8.50 kB raw / +1.57 kB transfer); `main` 8.47 → 8.51 kB, shared framework chunk 291.21 → 299.67 kB, `polyfills` unchanged. Cause of growth not investigated.
- Upstream `33bf8c3` ("chore: upgrade to Angular 21 and latest dependencies", 2026-01-26; only `package.json` and lockfile changed): Angular 21.1.1, TypeScript ~5.9.3 (same). Differences: rx-angular 21.0.0 (peers matching this time), zone.js ~0.16.0, `@angular/build` 21.1.1, Vitest (`"test": "vitest"`) instead of Karma. Upstream's app at that commit bootstraps with `bootstrapApplication` + `app.config.ts`, uses `provideAppInitializer`, and `app.config.ts` has no `provideZoneChangeDetection`. These are earlier architectural changes upstream, not part of its v21 commit.

- T5 (delegated writer; trigger: 2+ non-trivial docs): `docs/migration-log/en/09-upgrade-angular-21.md`, `docs/migration-log/es/09-upgrade-angular-21.md`, `README.md` (stage 09 row, current stack), `PROJECT_CONTEXT.md` (versions, tags, stage 09 row, zone.js decision, follow-ups, next step).

## Follow-ups (out of scope)

- Zoneless change detection (v21 default; this app opts into zone.js via `provideZoneChangeDetection()`).
- Karma → Vitest (upstream already uses Vitest).
- Builder package `@angular-devkit/build-angular` → `@angular/build`.
- `APP_INITIALIZER` → `provideAppInitializer()`.
- Pin `@rx-angular/cdk` to exactly `21.1.1` or wait for a matching template release.
- Node 24.

## Next step

Done. Merged into `main` (`9a07f8c`), tagged `v21-upgraded`; CI green on GitHub (120/120).
