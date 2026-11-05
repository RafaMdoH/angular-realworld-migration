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
- [ ] T2 `ng update @angular/core@20 @angular/cli@20` + review automatic migrations
- [ ] T3 `@rx-angular/cdk@20.1.1` + `@rx-angular/template@20.1.0`
- [ ] T4 Verify: tests, build, metrics; compare with upstream (if an Angular 20 commit exists)
- [ ] T5 Migration log `docs/migration-log/{es,en}/07-*.md`, README, `PROJECT_CONTEXT.md`
- [ ] T6 Merge `--no-ff` + tag `v20-upgraded` (with user approval); CI green on GitHub

## Acceptance criteria

- 76/76 specs green with the same assertions; `ng build` green; only official-migration changes in production and test code (documented).

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- T1 (inline): peers verified with `npm view`; deprecated directives in 10 templates; `APP_INITIALIZER` still in `app.module.ts`. Baseline on v19 + Node 22 = stage 06 T3 (same tree): 76/76, coverage 57.41 / 74 / 51.82 / 55.36, build 2.8 / 2.4 / 2.4 s, initial 333.23 kB raw / 94.20 kB transfer.

## Next step

T2.
