# Feature: angular-build-package

## Objective

Move the build tooling from `@angular-devkit/build-angular` to `@angular/build` on Angular 21.2, with build and characterization tests green, before the Angular 21 → 22 upgrade.

## Problem / Why

Tenth stage. Since stage 03 the app is built by the esbuild `application` builder, but it is still loaded from `@angular-devkit/build-angular`, the package that also carries webpack. In Angular 22 that package is deprecated (`npm view @angular-devkit/build-angular@latest deprecated`: "Angular's Webpack support is deprecated. Use the esbuild and Vite-based "@angular/build" package instead."). `@angular/build` provides the same builders (`application`, `dev-server`, `extract-i18n`, `karma`) without webpack. Doing it now keeps the Angular 22 stage a pure version upgrade.

## Scope

- Run the official optional migration `ng update @angular/cli --name use-application-builder` (or the equivalent manual change if it does not apply).
- `angular.json` builders `@angular-devkit/build-angular:*` → `@angular/build:*` (4 targets: build, serve, extract-i18n, test).
- `package.json`: replace the dev dependency.
- Out of scope: Karma → Vitest (the `karma` builder exists in `@angular/build`), Angular 22, other follow-ups.

## Constraints

- No source or spec changes expected.
- The lockfile will change (webpack and its loaders leave the tree); record the installed package count before and after.

## Checklist

- [x] T1 Diagnosis: current builders, deprecation evidence, builders available in `@angular/build`
- [ ] T2 Migration: builders + dependency; clean install
- [ ] T3 Verify: tests, build, dev server starts, metrics; install size / package count
- [ ] T4 Migration log `docs/migration-log/{es,en}/10-*.md`, README, `PROJECT_CONTEXT.md`
- [ ] T5 Merge `--no-ff` + tag (with user approval); CI green on GitHub

## Acceptance criteria

- 120/120 specs green; `ng build` green with the same initial bundle; `ng serve` starts; no `@angular-devkit/build-angular` left in `package.json` / `angular.json`.

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`
- `npx ng serve` (starts and compiles)

## Progress

- T1 (inline): `angular.json` uses `@angular-devkit/build-angular:{application,dev-server,extract-i18n,karma}`; `package.json` has `@angular-devkit/build-angular ^21.2.29`. `@angular/build@22` builders: `application`, `dev-server`, `extract-i18n`, `karma`, `ng-packagr`, `unit-test`. Deprecation confirmed on `@angular-devkit/build-angular@latest` (22.2.6). Baseline (stage 09 T4): 120/120, coverage 76.92 / 74 / 68.29 / 75.65, build 2.3 / 2.3 / 2.3 s, initial 346.08 kB raw / 97.59 kB transfer.

## Next step

T2.
