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
- [x] T2 Migration: builders + dependency; clean install
- [x] T3 Verify: tests, build, dev server starts, metrics; install size / package count
- [x] T4 Migration log `docs/migration-log/{es,en}/10-*.md`, README, `PROJECT_CONTEXT.md`
- [x] T5 Merge `--no-ff` + tag (with user approval); CI green on GitHub

## Acceptance criteria

- 120/120 specs green; `ng build` green with the same initial bundle; `ng serve` starts; no `@angular-devkit/build-angular` left in `package.json` / `angular.json`.

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`
- `npx ng serve` (starts and compiles)

## Progress

- T1 (inline): `angular.json` uses `@angular-devkit/build-angular:{application,dev-server,extract-i18n,karma}`; `package.json` has `@angular-devkit/build-angular ^21.2.29`. `@angular/build@22` builders: `application`, `dev-server`, `extract-i18n`, `karma`, `ng-packagr`, `unit-test`. Deprecation confirmed on `@angular-devkit/build-angular@latest` (22.2.6). Baseline (stage 09 T4): 120/120, coverage 76.92 / 74 / 68.29 / 75.65, build 2.3 / 2.3 / 2.3 s, initial 346.08 kB raw / 97.59 kB transfer.
- T2 (`8a1f5ff`): `ng update @angular/cli --name use-application-builder` (official optional migration). `angular.json`: `@angular-devkit/build-angular:{application,dev-server,extract-i18n,karma}` → `@angular/build:*`. `package.json`: `@angular-devkit/build-angular ^21.2.29` → `@angular/build ^21.2.29`. No other files changed; no `src/` changes.
- T3: clean `npm ci`: 1093 → 710 installed packages (−35%), `node_modules` 511 MB → 381 MB; `webpack` no longer installed. 120/120 green, coverage unchanged. No compiler warnings. Prod build 2.5 / 2.3 / 2.4 s; initial total 346.08 kB raw / 97.59 kB transfer; all 7 output files keep the stage 09 content hashes (`main-U5C3E52R`, `polyfills-5CFQRCPP`, `chunk-WTYHNFYV`, `chunk-2VMXMS7J`, `chunk-TPA577M5`, `chunk-ENI4ZRH6`, `chunk-FXMRX7MQ`), so the output is identical. `ng serve` starts and serves `index.html` (HTTP 200, `<app-root>`). `npm audit`: 40 → 35 findings (moderate 27 → 22; high 12 unchanged; no critical). The "65 findings (2 critical)" recorded in stage 06 had already dropped to 40 through the Angular upgrades.
- T4: migration log `docs/migration-log/en/10-angular-build-package.md` and `docs/migration-log/es/10-paquete-angular-build.md`; `README.md` (stage row, current stack); `PROJECT_CONTEXT.md` (stage row, builder, tags, next step).

## Next step

Done. Merged into `main` (`2329703`), tagged `v21-angular-build`; CI green on GitHub (120/120).
