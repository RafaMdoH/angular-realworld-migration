# Feature: karma-to-vitest

## Objective

Replace Karma + Jasmine with Vitest (`@angular/build:unit-test`) on Angular 22.2, keeping the characterization safety net equivalent: same tests, same assertions, still able to catch the regressions it caught before.

## Problem / Why

Fourteenth stage. Karma is a deprecated project; Angular's `@angular/build` ships the `unit-test` builder with Vitest as the default runner, and Angular 22 provides the optional `migrate-karma-to-vitest` migration. Upstream already uses Vitest.

This stage rewrites the safety net itself (122 specs use Jasmine APIs), so it carries more risk than the earlier upgrades: while the specs are being converted, no unchanged test guards them.

## Scope

- Step 1, configuration: `ng update @angular/cli --name migrate-karma-to-vitest` (test target → `@angular/build:unit-test`, dependencies, coverage provider).
- Step 2, spec code: `ng g @schematics/angular:refactor-jasmine-vitest` (Jasmine APIs → Vitest equivalents), plus manual fixes for anything it cannot convert.
- Test environment: Node + jsdom (user decision; builder default when no `browsers` are configured).
- CI: test command and coverage artifact path updated as needed.
- Out of scope: zoneless (next stage), new tests, fixing locked bugs.

## Constraints

- The test titles (`describe` / `it`) must be identical before and after; the count must stay 122.
- Assertions must keep their meaning; every manual edit is listed.
- A sample of earlier mutations must still be caught by the Vitest suite.
- Coverage numbers are recorded, but a different coverage provider may count differently; differences are documented, not "fixed".

## Checklist

- [x] T1 Diagnosis: migrations, Jasmine API usage, environment decision
- [x] T2 Baseline: test-title inventory and coverage on Karma
- [ ] T3 Step 1: `migrate-karma-to-vitest` (configuration)
- [ ] T4 Step 2: `refactor-jasmine-vitest` + manual fixes; suite green
- [ ] T5 Safety-net equivalence: title diff, mutation sample, coverage comparison
- [ ] T6 CI update; migration log `docs/migration-log/{es,en}/14-*.md`, README, `PROJECT_CONTEXT.md`
- [ ] T7 Merge `--no-ff` + tag (with user approval); CI green on GitHub

## Acceptance criteria

- 122/122 green on Vitest with identical titles; mutation sample caught; `ng build` unchanged; no production code changes.

## Checks

- `npx ng test --watch=false` (Vitest)
- `npx ng build`

## Progress

- T1 (inline): `migrate-karma-to-vitest` (v22.0.0, optional) requires the `@angular/build:application` builder (done in stage 10), switches the test target to `@angular/build:unit-test`, adds `vitest` and a coverage provider, and only recommends `refactor-jasmine-vitest` for the spec code. Jasmine API usage across 19 spec files: `jasmine.createSpyObj` 13, `jasmine.SpyObj` 13, `.and.returnValue` 28, `spyOn(` 3, `.calls.` 3, `toHaveBeenCalled*` 31; no `fakeAsync`, `waitForAsync`, `done` callbacks or `jasmine.clock`. The `unit-test` builder runs Vitest in Node unless `browsers` is set. Decision (user): Node + jsdom.

- T2 (inline): static inventory of test titles saved to `docs/tasks/evidence/karma-to-vitest-titles-before.txt` (file | kind | title): 122 `it`, 29 `describe`, matching the Karma count (122/122). Karma baseline (stage 13): coverage 76.98 / 74 / 68.48 / 75.72 (istanbul via Karma).

## Next step

T3.
