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
- [x] T3 Step 1: `migrate-karma-to-vitest` (configuration)
- [x] T4 Step 2: `refactor-jasmine-vitest` + manual fixes; suite green
- [x] T5 Safety-net equivalence: title diff, mutation sample, coverage comparison
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

- T3 (`cce577a`): `ng update @angular/cli --name migrate-karma-to-vitest`: test target `@angular/build:karma` → `@angular/build:unit-test` with `runner: "vitest"` and `buildTarget: ":build:testing"`; new `testing` build configuration (no AOT, no optimization, `zone.js` + `zone.js/testing` polyfills, assets); `tsconfig.spec.json` types `jasmine` → `vitest/globals`; `vitest ^5.0.0` added. The migration left all Karma / Jasmine dependencies in place, added no DOM environment and no coverage provider, and only recommended `refactor-jasmine-vitest`.
- T4 (`394050f`): `ng g @schematics/angular:refactor-jasmine-vitest --project=angular-conduit`: 19 files scanned, 12 transformed, 7 unchanged, 0 TODOs (report: `docs/tasks/evidence/jasmine-vitest-*.md`). Patterns: `jasmine.createSpyObj` → object of `vi.fn().mockName(...)`, `jasmine.SpyObj<T>` → `MockedObject<T>`, `.and.returnValue` → `.mockReturnValue`, `.and.resolveTo` → `.mockResolvedValue`, `toBeTrue/False()` → `toBe(true/false)`, `toHaveBeenCalledOnceWith(x)` → `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(x)`, `calls.mostRecent().args` → `vi.mocked(fn).mock.lastCall`.
  - Then the test build failed with 16 TypeScript errors, all type-only; fixed manually (15 edits, script-applied, listed): 12 mock object literals assigned to `MockedObject<T>` got `as unknown as MockedObject<T>` (Jasmine's `createSpyObj<T>` was typed as the full `T`; the literal only has the mocked methods) in `app.module.spec.ts` (4), `auth.component.spec.ts` (1), `user.service.spec.ts` (1), `article.component.spec.ts` (2), `editor.component.spec.ts` (3), `profile.component.spec.ts` (1), `article-list.component.spec.ts` (1); 3 `mock.lastCall[0]` → `mock.lastCall![0]` (`editor.component.spec.ts` 2, `article-list.component.spec.ts` 1); without a call the test still fails at runtime, as `calls.mostRecent()` did.
  - `jsdom ^31.0.0` added (the builder requires a DOM environment in Node). Removed `karma`, `karma-chrome-launcher`, `karma-coverage`, `karma-jasmine`, `karma-jasmine-html-reporter`, `jasmine-core`, `@types/jasmine`, `istanbul-lib-instrument` (167 packages). Added `@vitest/coverage-istanbul ^5.1.0` (istanbul, the same instrumenter family Karma used, to keep coverage comparable).
  - Result: 19 files, 122/122 passed in 1.44 s (about 3 s wall clock including the build). Coverage 80.55 / 71.18 / 68.48 / 78.78 (Karma: 76.98 / 74 / 68.48 / 75.72): functions identical; the other three differ, which points to a different instrumentation of the same code rather than to different tests; documented, not adjusted. `ng build` unchanged (357.58 kB).
- T5: test titles extracted again (`docs/tasks/evidence/karma-to-vitest-titles-after.txt`): identical to the baseline file (`diff` empty; 122 `it`, 29 `describe`); Vitest verbose reporter lists 122 passed tests. Mutation sample on the Vitest suite (each applied, suite run, file restored; failing-test counts):

  | ID  | Origin       | Mutation                                            | Karma        | Vitest |
  | --- | ------------ | --------------------------------------------------- | ------------ | ------ |
  | V1  | stage 08 M03 | `@if (article)` → `@if (!article)`                  | 11           | 11     |
  | V2  | stage 08 M07 | `track trackById($index, comment)` → `track $index` | 2            | 2      |
  | V3  | stage 08 M08 | comments iterated in reverse                        | 5            | 5      |
  | V4  | stage 08 M02 | header avatar condition inverted                    | 3            | 3      |
  | V5  | stage 08 M20 | `@if (errorList)` → `@if (errorList.length)`        | 2            | 2      |
  | V6  | stage 08 M12 | profile follow button condition inverted            | 3            | 3      |
  | V7  | stage 12     | `provideAppInitializer(...)` removed                | 2            | 2      |
  | V8  | stage 00     | Token / Error interceptor order swapped             | not recorded | 1      |
  | V9  | stage 00     | logout without `destroyToken()`                     | not recorded | 3      |

## Next step

T6: CI command updated (`npx ng test --watch=false --coverage`); docs.
