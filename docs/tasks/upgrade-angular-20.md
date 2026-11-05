# Feature: upgrade-angular-20

## Objective

Upgrade from Angular 19.2 to Angular 20.3 (one major) with build and characterization tests green.

## Problem / Why

Seventh stage. Upgrade only: new v20 APIs and template syntax (control flow `@if` / `@for`, signal APIs, zoneless) are modernization and go in separate features.

## Scope

- `@angular/*` 19.2 → 20.3 via `ng update` (including automatic migrations).
- `@rx-angular/cdk` 19.1.0 → 20.1.1, `@rx-angular/template` 19.2.2 → 20.1.0 (peer `@angular/core ^20`; template 20.1.0 requires cdk `^20.1.0`). Not 22.0.0, which `ng update` suggests but requires `@angular/core >=22`.
- Out of scope: `*ngIf` / `*ngFor` → built-in control flow (deprecated in v20, still supported), `APP_INITIALIZER` → `provideAppInitializer()`, unused `AsyncPipe` imports, Node 24, locked bug fixes, dead external deps.

## Constraints

- Angular 20.3 requires Node `^20.19.0 || ^22.12.0 || >=24.0.0` → Node 22.23.4 OK (stage 06); TypeScript `>=5.8 <6.0` → 5.8.3 OK; zone.js `~0.15.0` → 0.15.1 OK.
- Deprecated structural directives used in 10 templates (`*ngIf`, `*ngFor`); no `@if` / `@for` yet.
- `tsconfig.json` uses `moduleResolution: "node"`; review what the v20 migration does with it.
- No usage of APIs removed in v20 (`TestBed.get`, `InjectFlags`, `ng-reflect-*` attributes).

## Checklist

- [x] T1 Diagnosis: compatibility matrix + third-party peers + usage of removed/deprecated APIs
- [x] T2 `ng update @angular/core@20 @angular/cli@20` + review automatic migrations
- [x] T3 `@rx-angular/cdk@20.1.1` + `@rx-angular/template@20.1.0`
- [x] T4 Verify: tests, build, metrics; compare with upstream (if an Angular 20 commit exists)
- [ ] T5 Migration log `docs/migration-log/{es,en}/07-*.md`, README, `PROJECT_CONTEXT.md`
- [ ] T6 Merge `--no-ff` + tag `v20-upgraded` (with user approval); CI green on GitHub

## Acceptance criteria

- 76/76 specs green with the same assertions; `ng build` green; only official-migration changes in production and test code (documented).

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- T1 (inline): peers verified with `npm view`; deprecated directives in 10 templates; `APP_INITIALIZER` still in `app.module.ts`. Baseline on v19 + Node 22 = stage 06 T3 (same tree): 76/76, coverage 57.41 / 74 / 51.82 / 55.36, build 2.8 / 2.4 / 2.4 s, initial 333.23 kB raw / 94.20 kB transfer.
- T2 (`abd10b3`): Angular 20.3.35 / CLI 20.3.42; TypeScript 5.8.3 and zone.js 0.15.1 unchanged. Migrations applied: workspace generation defaults (`angular.json` `schematics` block keeps the pre-v20 file-naming style: `type: component|directive|service`, `typeSeparator: "."`), `moduleResolution` `node` → `bundler` (`tsconfig.json`). No-op: `provideServerRendering` imports/routes, default karma config removal, `DOCUMENT` import move, `InjectFlags`, `TestBed.get`, `BootstrapContext`. Optional migrations not run: `control-flow-migration` (modernization), `router-current-navigation` (no `getCurrentNavigation` usage), `use-application-builder`. No changes under `src/`. Unused-imports diagnostic is renamed `NG8113` (was TS-998113 in v19), same two `AsyncPipe` imports.
- T3 (`c5389c3`): `@rx-angular/cdk@20.1.1`, `@rx-angular/template@20.1.0` (caret ranges, as before). No `EBADENGINE`, no `ERESOLVE`.
- T4: 76/76 green, coverage unchanged (57.41 / 74 / 51.82 / 55.36). Prod build 2.3 / 2.4 / 2.4 s. Initial total 341.45 kB raw / 96.52 kB transfer (v19: 333.23 / 94.20, +8.22 kB raw / +2.32 kB transfer). `main` (8.68 kB) and `polyfills` (34.59 kB, same hash) unchanged, so the growth is in the shared framework chunk (`chunk-*`, 294.87 kB raw on v20; the v19 chunk size was not recorded). Cause not investigated.
- Upstream `a420aa2` ("chore: angular 20 update", 2025-05-29) comparison: Angular 20.0.0, `moduleResolution` → `bundler` (same). Differences: upstream switched the builder package from `@angular-devkit/build-angular` to `@angular/build` (builders `@angular/build:*`); kept `@rx-angular/*` 18.0.0 (peer `@angular/core ^18`, unsupported on 20); hand-converted one `*ngIf` to `@if` in the header, removed `NgIf` and other unused imports. This stage keeps `@angular-devkit/build-angular`, moves rx-angular to 20, and keeps template/import cleanup out of scope.

## Follow-ups (out of scope)

- Builder package `@angular-devkit/build-angular` → `@angular/build` (optional migration `use-application-builder`; upstream did it in the v20 commit).
- `*ngIf` / `*ngFor` → built-in control flow (`control-flow-migration`).
- `APP_INITIALIZER` → `provideAppInitializer()`; unused `AsyncPipe` imports (NG8113).
- Node 24 (now officially supported).

## Next step

T5 docs.
