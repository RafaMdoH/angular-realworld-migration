# Feature: upgrade-angular-16

## Objective

Upgrade from Angular 15.2 to Angular 16.2 (one major) with build and characterization tests green.

## Problem / Why

First major step of the 15 → current migration. Upgrade only — no modernization (signals, control flow, etc.) in this feature.

## Scope

- `@angular/*` 15.2 → 16.2 via `ng update` (including its automatic migrations).
- Third-party packages coupled to the Angular major: `@rx-angular/cdk` 15 → 16.0.0, `@rx-angular/template` 15.1 → 16.1.2 (peer `@angular/core ^16`).
- Out of scope: fixing locked bugs, modernization, Karma replacement.

## Constraints

- Angular 16 requires Node ^16.14 || ^18.10 and TypeScript >=4.9.3 <5.2 → Node 18 stays valid.
- Global `~/.angular-config.json` sets `packageManager: bun`; pinned `npm` locally in `angular.json`.
- `ng update` suggests `@rx-angular/*@21` (latest) — wrong target; must match the Angular major (16).

## Checklist

- [x] T1 Pin npm as package manager in `angular.json`
- [x] T2 Characterization spec for `HomeComponent` tag list (`*rxLet`), the only rx-angular usage
- [x] T3 `ng update @angular/core@16 @angular/cli@16` + review automatic migrations
- [x] T4 `@rx-angular/cdk@16.0.0` + `@rx-angular/template@16.1.2`
- [x] T5 Verify: tests, build, metrics vs baseline; compare with upstream commit `0d28f5c`
- [x] T6 Migration log `docs/migration-log/{es,en}/01-*.md`

## Acceptance criteria

- All characterization specs green; `ng build` green; no production behavior change other than what the official migrations apply (documented).

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- Branch: `feature/upgrade-angular-16` (from `main-v15` @ 359584d)

## Next step

Feature complete. Next: merge to main-v15, then Angular 16 → 17 (esbuild, control flow available).
