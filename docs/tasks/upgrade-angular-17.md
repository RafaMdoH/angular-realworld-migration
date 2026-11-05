# Feature: upgrade-angular-17

## Objective

Upgrade from Angular 16.2 to Angular 17.3 (one major) with build and characterization tests green.

## Problem / Why

Second major step. Upgrade only — the esbuild `application` builder switch and control flow are modernization and go in separate features.

## Scope

- `@angular/*` 16.2 → 17.3 via `ng update` (including automatic migrations).
- `@rx-angular/cdk` 16.0 → 17.1.0, `@rx-angular/template` 16.1 → 17.3.1 (peer `@angular/core ^17`).
- Out of scope: builder switch (`use-application-builder`), control flow (`@if/@for`), locked bug fixes, dead external deps (see 00 §1.1).

## Constraints

- Angular 17 requires Node ^18.13 || >=20.9 → Node 18.20.8 OK; TypeScript >=5.2 <5.5; zone.js ~0.14.
- `ng update` again suggests `@rx-angular/*@21` — choose by peerDependencies (17.x).

## Checklist

- [x] T1 Diagnosis: compatibility matrix + third-party peers
- [x] T2 `ng update @angular/core@17 @angular/cli@17` + review automatic migrations
- [x] T3 `@rx-angular/cdk@17.1.0` + `@rx-angular/template@17.3.1`
- [x] T4 Verify: tests, build, metrics; compare with upstream commit `6d97f15`
- [x] T5 Migration log `docs/migration-log/{es,en}/02-*.md`

## Acceptance criteria

- All characterization specs green; `ng build` green; only official-migration changes in production code (documented).

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- Branch: `feature/upgrade-angular-17` (from `main-v15` @ 1b60e5b, tag `v16-upgraded`)

## Next step

Feature complete. Next: merge to main-v15; then decide: modernization (builder/control flow) or Angular 18.
