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
- [x] T2 `ng update @angular/core@22 @angular/cli@22` + review automatic migrations and TypeScript 6.0 diagnostics
- [x] T3 `@rx-angular/cdk@22` + `@rx-angular/template@22`
- [x] T4 Verify: tests, build, metrics; compare with upstream (if an Angular 22 commit exists)
- [x] T5 Migration log `docs/migration-log/{es,en}/11-*.md`, README, `PROJECT_CONTEXT.md`
- [ ] T6 Merge `--no-ff` + tag `v22-upgraded` (with user approval); CI green on GitHub

## Acceptance criteria

- 120/120 specs green with the same assertions; `ng build` green; only official-migration changes in production and test code (documented).

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- T1 (inline): `ChangeDetectionStrategy` in `@angular/core@22`: `OnPush = 0`, `Eager = 1`, `Default = 1` (`Eager` is the new name for the old default value). v22 optional migrations: `use-application-builder` (done in stage 10), `migrate-karma-to-vitest`. rx-angular 22.0.0: cdk peer `@angular/core >=22.0.0`. Baseline (stage 10): 120/120, coverage 76.92 / 74 / 68.29 / 75.65, build 2.5 / 2.3 / 2.4 s, initial 346.08 kB raw / 97.59 kB transfer.

- T2 (`978e3f5`): Angular 22.2.4 / CLI and `@angular/build` 22.2.6; TypeScript 5.9.3 → 6.0.3 (set by `ng update`); zone.js 0.15.1 unchanged. Migrations with changes:
  - `change-detection-eager`: `changeDetection: ChangeDetectionStrategy.Eager` added to the 16 components that had no strategy (the 2 `OnPush` components unchanged) and to the test host component in `show-authed.directive.spec.ts`. `Eager` has the same value as the old `Default`, so change detection is unchanged.
  - `http-xhr-backend`: `provideHttpClient(withXhr(), withInterceptorsFromDi())` in `app.module.ts` and in the `TestBed` providers of 6 specs, keeping the XHR backend.
  - `safe-optional-chaining`: `article.component.html` comment-form avatar `currentUser?.image` wrapped in `$safeNavigationMigration(...)` (twice), keeping the pre-v22 result of `?.` in templates. The wrapped expression only differs from plain `?.` when `currentUser` is null; the block is inside `*appShowAuthed="true"`, so that case is not reached in normal use and is not covered by a spec.
  - `strict-safe-navigation-narrow`: `tsconfig.app.json` and `tsconfig.spec.json` suppress the `nullishCoalescingNotNullable` and `optionalChainNotNullable` extended diagnostics.
  - `add-istanbul-instrumenter`: `istanbul-lib-instrument ^6.0.3` added to `devDependencies` (Karma coverage).
  - No-op: `can-match-snapshot-required`, `incremental-hydration`, `model-output`, `strict-templates-default` (already `strictTemplates: true`), `trust-proxy-headers`, `update-workspace-config`. Optional not run: `migrate-karma-to-vitest`, `use-application-builder` (done in stage 10).
  - Spec changes are provider configuration only (`withXhr()`, `Eager` on a test host); no assertion changed.
  - TypeScript 6.0: the build failed with `TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`. No import relies on `baseUrl` (all imports are relative or package names; no `paths`), so `"baseUrl": "./"` was removed from `tsconfig.json` instead of adding `ignoreDeprecations: "6.0"`. Not done by any migration.
- T3 (`bd17f0e`): `@rx-angular/cdk@22.0.0`, `@rx-angular/template@22.0.0` (caret ranges). Template's cdk peer is now `^22.0.0`, so the exact-pin issue from stage 09 is gone. No `EBADENGINE` / `ERESOLVE`.
- T4: 120/120 green with no assertion changed; coverage unchanged (76.92 / 74 / 68.29 / 75.65). No compiler warnings. Prod build 1.7 / 1.7 / 1.7 s (first run after `ng update`: 2.8 s). Initial total 357.60 kB raw / 99.56 kB transfer (v21: 346.08 / 97.59, +11.52 kB raw / +1.97 kB transfer); `main` 8.51 → 10.92 kB, shared framework chunk 299.67 → 311.42 kB, `polyfills` unchanged (same hash). Output layout changed: 3 initial JS chunks instead of 7, and chunk hashes now use mixed case (`chunk-DhfQOmZR.js`). Cause of growth not investigated. Installed packages 710 → 595; `npm audit` 35 → 20 (no critical).
- Upstream: no Angular 22 commit to compare; upstream `main` is still on Angular 21.2.12 with TypeScript ~5.9.3 (and no `baseUrl` in its `tsconfig.json`).
- T5 (delegated writer; trigger: 2+ non-trivial docs): `docs/migration-log/en/11-upgrade-angular-22.md`, `docs/migration-log/es/11-upgrade-angular-22.md`, `README.md` (stage 11 row, current stack), `PROJECT_CONTEXT.md` (versions, tags, stage 11 row, decisions, follow-ups, next step, `npm audit` count).

## Follow-ups (out of scope)

- Adopt v22 template `?.` semantics and remove the `$safeNavigationMigration` wrapper.
- Review `ChangeDetectionStrategy.Eager` components when moving to OnPush / zoneless.
- Karma → Vitest (`migrate-karma-to-vitest`), zoneless, `provideAppInitializer()`, Node 24.

## Next step

T6 merge + tag `v22-upgraded` (with user approval).
