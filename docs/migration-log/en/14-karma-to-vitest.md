# 14 — Tests: Karma + Jasmine → Vitest (Angular 22.2)

> Decision record: why the test runner changes, why this stage is riskier than the upgrades before it (it rewrites the safety net itself), the test-environment decision, the two official steps and the manual fixes, the dependency changes, how the new suite was proven to be the same safety net, metrics, and the situation upstream.

**Branch:** `feature/karma-to-vitest` · **Commits:** `cce577a` (configuration), `394050f` (spec refactor + dependencies), `c23271b` (CI + equivalence evidence)

---

## 1. Why, and why this stage is different

Karma is a deprecated project. Angular's `@angular/build` package ships the `unit-test` builder, with Vitest as its default runner, and Angular 22 provides `migrate-karma-to-vitest` as an optional migration.

Every earlier stage changed production code or tooling, and the 122 specs stayed unchanged to judge the result. This stage is the opposite: production code does not change, and the specs do. All of them use Jasmine APIs, so the safety net built in stage 00 has to be rewritten. While the specs are being converted, no unchanged test guards them.

Jasmine API usage before the change, across 19 spec files:

| API                                                            | Occurrences |
| -------------------------------------------------------------- | ----------- |
| `jasmine.createSpyObj`                                         | 13          |
| `jasmine.SpyObj`                                               | 13          |
| `.and.returnValue`                                             | 28          |
| `spyOn(`                                                       | 3           |
| `.calls.`                                                      | 3           |
| `toHaveBeenCalled*`                                            | 31          |
| `fakeAsync`, `waitForAsync`, `done` callbacks, `jasmine.clock` | 0           |

The constraints were set before starting:

- The test titles (`describe` / `it`) must be identical before and after, and the count must stay at 122.
- Assertions must keep their meaning; every manual edit is listed.
- A sample of earlier mutations must still be caught by the Vitest suite.
- No production code changes; no new tests; locked bugs stay locked.

> **Lesson:** a characterization suite proves its value by catching mutations (stage 00). When the suite itself is what changes, a green run proves only that the new suite agrees with itself. The proof has to come from outside it (section 6).

---

## 2. Decision: Node + jsdom vs a real browser

The `unit-test` builder runs Vitest in Node unless `browsers` is configured. Karma ran the specs in a real browser (CI used `--browsers=ChromeHeadless`).

| Option                    | What it requires                                                                |
| ------------------------- | ------------------------------------------------------------------------------- |
| **Node + jsdom** (chosen) | Builder default when no `browsers` are set; a DOM environment package (`jsdom`) |
| Real browser              | `browsers` configured in the test target                                        |

**Decision (user): Node + jsdom.** The suite's DOM assertions now run against jsdom instead of Chrome. Whether that environment is sufficient for these specs is not assumed: section 6 checks it with the same mutations that Karma caught.

---

## 3. Two official steps

The work uses two separate official tools, and they do different things.

### Step 1 — configuration (`cce577a`)

```bash
npx ng update @angular/cli --name migrate-karma-to-vitest
```

| Did                                                                                                                  | Did not do                                  |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Test target `@angular/build:karma` → `@angular/build:unit-test`, `runner: "vitest"`, `buildTarget: ":build:testing"` | Remove any Karma / Jasmine dependency       |
| New `testing` build configuration (no AOT, no optimization, `zone.js` + `zone.js/testing` polyfills, assets)         | Add a DOM environment                       |
| `tsconfig.spec.json` types `jasmine` → `vitest/globals`                                                              | Add a coverage provider                     |
| Added `vitest ^5.0.0`                                                                                                | Touch spec code (it only recommends step 2) |

The migration requires the `@angular/build:application` builder, done in stage 10.

### Step 2 — spec code (`394050f`)

```bash
npx ng g @schematics/angular:refactor-jasmine-vitest --project=angular-conduit
```

19 files scanned, 12 transformed, 7 unchanged, 0 TODOs (report: `docs/tasks/evidence/jasmine-vitest-20261105T190035550Z.md`).

| Jasmine                       | Vitest                                                 |
| ----------------------------- | ------------------------------------------------------ |
| `jasmine.createSpyObj(...)`   | Object of `vi.fn().mockName(...)`                      |
| `jasmine.SpyObj<T>`           | `MockedObject<T>`                                      |
| `.and.returnValue(...)`       | `.mockReturnValue(...)`                                |
| `.and.resolveTo(...)`         | `.mockResolvedValue(...)`                              |
| `toBeTrue()` / `toBeFalse()`  | `toBe(true)` / `toBe(false)`                           |
| `toHaveBeenCalledOnceWith(x)` | `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(x)` |
| `calls.mostRecent().args`     | `vi.mocked(fn).mock.lastCall`                          |

Example from `editor.component.spec.ts`, before:

```ts
router = jasmine.createSpyObj<Router>("Router", ["navigate"]);
router.navigate.and.resolveTo(true);
```

After (including the manual cast from section 4):

```ts
router = {
  navigate: vi.fn().mockName("Router.navigate"),
} as unknown as MockedObject<Router>;
router.navigate.mockResolvedValue(true);
```

It did not change the environment or the dependencies: the DOM environment, the coverage provider and the removal of Karma were done by hand (section 5).

---

## 4. Manual fixes

The refactor report says no manual changes are required. The test build then failed with 16 TypeScript errors, all type-only. They were fixed with 15 edits, applied by script and listed here.

| Fix                                                                                 | Edits | Files                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mock object literal assigned to `MockedObject<T>` → `as unknown as MockedObject<T>` | 12    | `app.module.spec.ts` (4), `auth.component.spec.ts` (1), `user.service.spec.ts` (1), `article.component.spec.ts` (2), `editor.component.spec.ts` (3), `profile.component.spec.ts` (1), `article-list.component.spec.ts` (1) |
| `mock.lastCall[0]` → `mock.lastCall![0]`                                            | 3     | `editor.component.spec.ts` (2), `article-list.component.spec.ts` (1)                                                                                                                                                       |

### Why the typing differs

Jasmine's `createSpyObj<T>` was typed as the full `T`, whatever methods were listed. The converted code is an object literal that only has the mocked methods, so TypeScript rejects it as a `MockedObject<T>`. The cast restores the previous typing; it changes nothing at runtime.

### `lastCall!` and runtime equivalence

`mock.lastCall` is typed as possibly `undefined` (no call yet). The non-null assertion only satisfies the compiler:

```ts
// before
expect(articles.create.calls.mostRecent().args[0]).toEqual({
// after
expect(vi.mocked(articles.create).mock.lastCall![0]).toEqual({
```

Without a call, the test still fails at runtime, as `calls.mostRecent()` did. The assertion keeps its meaning.

---

## 5. Dependencies

| Change         | Packages                                                                                                                                                        | Why                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Removed        | `karma`, `karma-chrome-launcher`, `karma-coverage`, `karma-jasmine`, `karma-jasmine-html-reporter`, `jasmine-core`, `@types/jasmine`, `istanbul-lib-instrument` | Left in place by step 1; 167 packages removed                                           |
| Added (step 1) | `vitest ^5.0.0`                                                                                                                                                 | Test runner                                                                             |
| Added          | `jsdom ^31.0.0`                                                                                                                                                 | The builder requires a DOM environment when running in Node                             |
| Added          | `@vitest/coverage-istanbul ^5.1.0`                                                                                                                              | Istanbul is the same instrumenter family Karma used, chosen to keep coverage comparable |

---

## 6. Proving the safety net is still the same net

Three independent checks, none of which relies on the new suite simply being green.

### a) Identical titles

The test titles were inventoried statically before the change (`docs/tasks/evidence/karma-to-vitest-titles-before.txt`, format `file | kind | title`) and again after it (`docs/tasks/evidence/karma-to-vitest-titles-after.txt`).

- `diff` between the two files: empty.
- 122 `it`, 29 `describe`, before and after.
- The Vitest verbose reporter lists 122 passed tests.

No test was lost, merged, renamed or added.

### b) Mutations still caught

A sample of mutations from earlier stages was applied to production code, the Vitest suite was run, and the file was restored. The table shows the number of failing tests.

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

Every mutation with a recorded Karma count fails the same number of tests on Vitest, including V2, which depends on DOM element identity under jsdom. V8 and V9 are caught; their Karma counts were not recorded, so only detection is claimed for them.

### c) Coverage

| Metric     | Karma (istanbul) | Vitest (`@vitest/coverage-istanbul`) |
| ---------- | ---------------- | ------------------------------------ |
| Statements | 76.98%           | 80.55%                               |
| Branches   | 74%              | 71.18%                               |
| Functions  | 68.48%           | 68.48%                               |
| Lines      | 75.72%           | 78.78%                               |

> **Honesty about the numbers:** functions are identical. The other three differ, in both directions, with the same tests (section 6a) catching the same mutations (section 6b). That points to a different instrumentation of the same code, not to different tests. The difference is documented, not adjusted.

> **Lesson:** when you migrate the tool that guards you, guard the migration with evidence from outside that tool: identical titles and the same mutations caught. "All green" on the new tool alone would not show whether the net still has the same holes.

---

## 7. Metrics

| Metric                                      | Karma                                                                 | Vitest                                                            |
| ------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Tests                                       | 122/122                                                               | 122/122 (19 files)                                                |
| Test time                                   | Not recorded                                                          | 1.44 s (about 3 s wall clock including the build)                 |
| Coverage (stmts / branches / funcs / lines) | 76.98% / 74% / 68.48% / 75.72%                                        | 80.55% / 71.18% / 68.48% / 78.78%                                 |
| Production build (initial bundle, raw)      | 357.58 kB                                                             | 357.58 kB (unchanged)                                             |
| Packages                                    | —                                                                     | 167 removed; `vitest`, `jsdom`, `@vitest/coverage-istanbul` added |
| CI test command                             | `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage` | `npx ng test --watch=false --coverage` (`c23271b`)                |

The CI coverage artifact path (`coverage/`) did not need to change.

---

## 8. Upstream

Upstream already uses Vitest: its Angular 21 commit [`33bf8c3`](https://github.com/gothinkster/angular-realworld-example-app/commit/33bf8c3) has `"test": "vitest"` instead of Karma (recorded in stage 09). How upstream configured its environment or converted its specs was not compared here.

|             | Upstream | This migration                                             |
| ----------- | -------- | ---------------------------------------------------------- |
| Test runner | Vitest   | Vitest via `@angular/build:unit-test`                      |
| Safety net  | —        | Title diff, 9 mutations, coverage comparison against Karma |

---

## 9. Follow-ups

| Topic                                                  | Detail                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Zoneless change detection                              | Next stage (15)                                                           |
| Adopt v22 template `?.` semantics                      | Remove the `$safeNavigationMigration` wrapper in `article.component.html` |
| Review components with `ChangeDetectionStrategy.Eager` | When moving to `OnPush` / zoneless                                        |
