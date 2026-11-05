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
- [x] T3 `ng update @angular/core@19 @angular/cli@19` + review automatic migrations
- [x] T4 `@rx-angular/cdk@19.1.0` + `@rx-angular/template@19.2.2`
- [x] T5 Verify: tests, build, metrics; compare with upstream `a6f16d0`
- [x] T6 Migration log `docs/migration-log/{es,en}/05-*.md`
- [x] T7 Update `PROJECT_CONTEXT.md` and README stage table; merge `--no-ff` + tag `v19-upgraded` (with user approval)

## Acceptance criteria

- 76/76 specs green with the same assertions; `ng build` green; only official-migration changes in production and test code (documented).

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- T1: Node 18.20.8 OK; TS 5.4 → must move to >=5.5 <5.9; zone.js → ~0.15.0; rx-angular 19 peers verified via `npm view`; no NgModule other than `AppModule`/`AppRoutingModule`; only `AppComponent` is non-standalone.

- T2: 76/76 green; coverage 57.41% stmts / 74% branches / 51.82% funcs / 55.36% lines; prod build 3.6 / 2.4 / 2.4 s; initial total 335.06 kB raw / 93.72 kB transfer.

- T3 (`50343a8`): Angular 19.2.25 / CLI 19.2.27, TypeScript 5.8.3, zone.js ~0.15.1. `standalone` migration: 18 × `standalone: true` removed, `AppComponent` → `standalone: false` (after Prettier: 1 insertion, 18 deletions in `src`). One spec touched (`show-authed.directive.spec.ts` host component): only `standalone: true` removed, assertions unchanged. Migration left `standalone: true` in `ShowAuthedDirective` and `MarkdownPipe` (redundant, harmless; upstream `a6f16d0` shows the same result) — left as is. Optional migrations not run: `provide-initializer`, `use-application-builder` (already on the application builder).
- T4 (`05ba2dc`): `@rx-angular/cdk@19.1.0`, `@rx-angular/template@19.2.2`. Transitive `ng-morph@4.9.1` → `minimatch@10` declares Node `20 || >=22` (npm `EBADENGINE` warning on Node 18); tooling-only (schematics), not in the bundle.
- T5: 76/76 green, coverage unchanged (57.41% stmts / 74% branches / 51.82% funcs / 55.36% lines). Prod build 2.9 / 2.5 / 2.4 s. Initial total 333.23 kB raw / 94.20 kB transfer (v18: 335.06 / 93.72). New v19 diagnostic TS-998113 (unused standalone imports): `AsyncPipe` in `HomeComponent` and `ProfileComponent` — warnings only, left as follow-up.
- Upstream `a6f16d0` comparison: same Angular 19.2 line (19.2.14), TS ~5.8.3, zone.js ~0.15.1, same `standalone` result. Differences: upstream kept `@rx-angular/*` 18.0.0 (peer `@angular/core ^18`, unsupported on 19) and removed unused imports in the same commit; this stage moved rx-angular to 19 and kept the import cleanup out of scope.
- T7: `PROJECT_CONTEXT.md` and README stage table updated; merged `--no-ff` into `main` (`8a9c687`), tagged `v19-upgraded`. First CI run on GitHub green (build + 76/76, same coverage).

## Follow-ups (out of scope)

- `APP_INITIALIZER` → `provideAppInitializer()` (deprecated in v19; optional migration `provide-initializer`).
- Remove unused `AsyncPipe` imports flagged by TS-998113.
- Node 20+ required by the next major (Angular 20) and already by rx-angular 19 tooling.

## Next step

Done. Next stage: Node 18 → 20, then Angular 19 → 20.
