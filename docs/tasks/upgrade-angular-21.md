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
- [ ] T2 `ng update @angular/core@21 @angular/cli@21` + review automatic migrations
- [ ] T3 `@rx-angular/cdk@21.1.1` + `@rx-angular/template@21.2.1`
- [ ] T4 Verify: tests, build, metrics; compare with upstream `33bf8c3`
- [ ] T5 Migration log `docs/migration-log/{es,en}/09-*.md`, README, `PROJECT_CONTEXT.md`
- [ ] T6 Merge `--no-ff` + tag `v21-upgraded` (with user approval); CI green on GitHub

## Acceptance criteria

- 120/120 specs green with the same assertions; `ng build` green; only official-migration changes in production and test code (documented).

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- T1 (inline): requirements and v21 migration list recorded in `docs/tasks/migrate-control-flow.md` (T1). rx-angular 21: `cdk@21.1.1` (peer `@angular/core ^21.0.0`), `template@21.2.1` (peer `@angular/core ^21.0.0`, `@rx-angular/cdk` exactly `21.1.1`). Latest: `@angular/core` 21.2.26, `@angular/cli` 21.2.29, `typescript` 5.9.3. Baseline (v20 + control flow, stage 08 T4): 120/120, coverage 76.92 / 74 / 68.29 / 75.65, build 2.4 / 1.7 / 1.7 s, initial 337.58 kB raw / 96.02 kB transfer.

## Next step

T2.
