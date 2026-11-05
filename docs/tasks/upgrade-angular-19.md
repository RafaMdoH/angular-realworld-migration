# Feature: upgrade-angular-19

## Objective

Upgrade from Angular 18.2 to Angular 19.2 (one major) with build and characterization tests green.

## Problem / Why

Fifth stage. Upgrade only: new v19 APIs (`provideAppInitializer`, `linkedSignal`, `resource`, incremental hydration, etc.) are modernization and go in separate features.

## Scope

- `@angular/*` 18.2 → 19.2 via `ng update` (including automatic migrations).
- TypeScript 5.4 → 5.5+ and zone.js 0.14 → 0.15 (required peers).
- `@rx-angular/cdk` 18.0 → 19.1.0, `@rx-angular/template` 18.0.3 → 19.2.2 (peer `@angular/core ^19`; template 19.2.2 requires cdk `^19.1.0`).
- Out of scope: `APP_INITIALIZER` → `provideAppInitializer()` (deprecated in v19, follow-up), new template/signal APIs, Karma → other runner, locked bug fixes, dead external deps.

## Constraints

- Angular 19.2 requires Node ^18.19.1 || ^20.11.1 || >=22 → Node 18.20.8 OK (last major that accepts Node 18); TypeScript >=5.5 <5.9; zone.js ~0.15.0.
- Node 18: every `ng update` needs `NG_DISABLE_VERSION_CHECK=true` (see stage 03).
- Behavioral change: `standalone` defaults to `true`. 20 files declare `standalone: true` (now redundant); `AppComponent` is the only NgModule-declared component and must become `standalone: false`, otherwise the build fails.

## Checklist

- [x] T1 Diagnosis: compatibility matrix + third-party peers + standalone inventory
- [x] T2 Baseline on v18: tests + build metrics
- [ ] T3 `ng update @angular/core@19 @angular/cli@19` + review automatic migrations
- [ ] T4 `@rx-angular/cdk@19.1.0` + `@rx-angular/template@19.2.2`
- [ ] T5 Verify: tests, build, metrics; compare with upstream `a6f16d0`
- [ ] T6 Migration log `docs/migration-log/{es,en}/05-*.md`
- [ ] T7 Update `PROJECT_CONTEXT.md` and README stage table; merge `--no-ff` + tag `v19-upgraded` (with user approval)

## Acceptance criteria

- 76/76 specs green with the same assertions; `ng build` green; only official-migration changes in production and test code (documented).

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- T1: Node 18.20.8 OK; TS 5.4 → must move to >=5.5 <5.9; zone.js → ~0.15.0; rx-angular 19 peers verified via `npm view`; no NgModule other than `AppModule`/`AppRoutingModule`; only `AppComponent` is non-standalone.

- T2: 76/76 green; coverage 57.41% stmts / 74% branches / 51.82% funcs / 55.36% lines; prod build 3.6 / 2.4 / 2.4 s; initial total 335.06 kB raw / 93.72 kB transfer.

## Next step

T3 `ng update`.
