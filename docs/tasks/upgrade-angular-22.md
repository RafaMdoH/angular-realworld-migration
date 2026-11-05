# Feature: upgrade-angular-22

## Objective

Upgrade from Angular 21.2 to Angular 22.2 (one major) together with its required TypeScript 6.0, with build and characterization tests green.

## Problem / Why

Eleventh stage. Angular 22 is the current `latest` line (22.2.4; 22.0.0 released 2026-06-03). Upgrade only: new v22 APIs and the new defaults it introduces are adopted only as far as the official migrations preserve the previous behavior.

## Scope

- `@angular/*` 21.2 → 22.2 via `ng update` (including automatic migrations).
- TypeScript 5.9 → 6.0 (required peer `>=6.0 <6.1`; a TypeScript major).
- `@rx-angular/cdk` 21.1.1 → 22.0.0, `@rx-angular/template` 21.2.1 → 22.0.0 (peer `@angular/core >=22.0.0`; template requires cdk `^22.0.0`, which also removes the exact cdk pin noted in stage 09).
- Out of scope: Karma → Vitest (`migrate-karma-to-vitest` is optional), zoneless, OnPush refactors, `provideAppInitializer`, Node 24.

## Constraints

- Angular 22.2 requires Node `^22.22.3 || ^24.15.0 || >=26.0.0` → Node 22.23.4 OK; zone.js `~0.15.0 || ~0.16.0` → 0.15.1 OK.
- v22 non-optional migrations that may touch this app: `change-detection-eager` (adds `ChangeDetectionStrategy.Eager` to components; 18 components, 2 already `OnPush`), `safe-optional-chaining` (`?.` in templates: 2 occurrences in 1 file), `strict-safe-navigation-narrow`, `strict-templates-default` (already `strictTemplates: true`), `http-xhr-backend` (app uses `provideHttpClient(withInterceptorsFromDi())`), `add-istanbul-instrumenter` (Karma coverage), `update-workspace-config`.
- TypeScript 6.0 may flag deprecated compiler options; `tsconfig.json` still sets `baseUrl`.

## Checklist

- [x] T1 Diagnosis: requirements, v22 migration catalog, affected code
- [ ] T2 `ng update @angular/core@22 @angular/cli@22` + review automatic migrations and TypeScript 6.0 diagnostics
- [ ] T3 `@rx-angular/cdk@22` + `@rx-angular/template@22`
- [ ] T4 Verify: tests, build, metrics; compare with upstream (if an Angular 22 commit exists)
- [ ] T5 Migration log `docs/migration-log/{es,en}/11-*.md`, README, `PROJECT_CONTEXT.md`
- [ ] T6 Merge `--no-ff` + tag `v22-upgraded` (with user approval); CI green on GitHub

## Acceptance criteria

- 120/120 specs green with the same assertions; `ng build` green; only official-migration changes in production and test code (documented).

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- T1 (inline): `ChangeDetectionStrategy` in `@angular/core@22`: `OnPush = 0`, `Eager = 1`, `Default = 1` (`Eager` is the new name for the old default value). v22 optional migrations: `use-application-builder` (done in stage 10), `migrate-karma-to-vitest`. rx-angular 22.0.0: cdk peer `@angular/core >=22.0.0`. Baseline (stage 10): 120/120, coverage 76.92 / 74 / 68.29 / 75.65, build 2.5 / 2.3 / 2.4 s, initial 346.08 kB raw / 97.59 kB transfer.

## Next step

T2.
