# 08 — Built-in control flow (Angular 20.3)

> Decision record: why the conversion runs before the Angular 21 upgrade, how the safety net was extended to the affected templates, the concept behind the change, what the migration did, verification, metrics, and comparison with the maintainers' approach.

**Branch:** `feature/migrate-control-flow` · **Commits:** `a2826c7` (characterization specs), `59ae6a4` (migration)

---

## 1. Why now, and why as a separate stage

| Question                                | How it was answered                           | Result                                                                                                                                                                               |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Does Angular 21 force this conversion?  | `migrations.json` of `@angular/core@21`       | `control-flow-migration` has no `optional` flag: `ng update` to v21 runs it as a mandatory migration                                                                                 |
| How much code does it touch?            | Inventory of structural directives in `src/`  | 27 occurrences of `*ngIf` / `*ngFor` in 10 templates (auth 3, header 2, article-comment 2, article 7, editor 1, home 1, profile 3, article-list 5, article-preview 1, list-errors 2) |
| Is that code protected by tests?        | Specs that render each template               | Only 3 of 10 (auth, editor, home)                                                                                                                                                    |
| What else does the v21 upgrade require? | Angular 21.2 `peerDependencies` and `engines` | TypeScript `>=5.9 <6.1` (current 5.8.3), zone.js `~0.15.0 \|\| ~0.16.0`, Node `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`                                                                 |

Running the conversion inside the v21 upgrade would mix a framework version change, a TypeScript bump, and 10 rewritten templates in one diff. Running it first, on Angular 20, keeps one concept per change: when `ng update` to v21 runs `control-flow-migration`, there is nothing left to convert.

> **Lesson:** a migration that is optional in one major can become mandatory in the next. Reading `migrations.json` of the target version before upgrading shows which changes will be forced, and lets them be done earlier, on their own, under controlled conditions.

---

## 2. Closing the safety-net gap

The migration rewrites templates. A rewritten template can render something different and still compile, so the specs that matter here are the ones that render the template and check the DOM. Seven of the ten affected templates had none.

### Characterization specs added (`a2826c7`)

44 specs in 7 files, written before any production change. Each one locks the current rendering of a `*ngIf` / `*ngFor` branch through the DOM, including the `as` aliases.

| Template          | Specs | What is locked                                   |
| ----------------- | ----- | ------------------------------------------------ |
| `header`          | 5     | All branches, including the `async as` alias     |
| `article`         | 12    | All branches, including `trackBy` DOM identity   |
| `article-comment` | 7     | All branches                                     |
| `profile`         | 5     | All branches                                     |
| `article-list`    | 7     | All branches                                     |
| `article-preview` | 4     | All branches                                     |
| `list-errors`     | 4     | All branches, including one locked bug (2 specs) |

### Locking `trackBy` through the DOM

The comments list in `article.component.html` used `*ngFor ... trackBy: trackById`. `trackBy` does not change what is rendered; it changes **which DOM elements are reused**. A spec that only checks text would pass with or without it.

The spec therefore checks element identity: it keeps a reference to the rendered comment elements, replaces the list with **new objects that have the same ids** (and, separately, reorders it), and asserts that the same DOM elements are still there. Without `trackBy`, new objects mean new elements, and the spec fails.

### A bug found and locked, not fixed

`ListErrorsComponent` always renders an empty `ul.error-messages`: `errorList` is always an array, and `[]` is truthy, so the `*ngIf` guarding the list is always true. Two specs lock this as `KNOWN BUG (locked)`. The migration must preserve it; fixing it is a separate change.

### Mutation checks

Each new spec was proven useful by breaking the template on purpose and confirming the expected specs failed, then restoring it.

| Mutation type                            | Result                       |
| ---------------------------------------- | ---------------------------- |
| Template branch inverted                 | Expected specs fail          |
| Template branch removed                  | Expected specs fail          |
| Rendered list sliced                     | Expected specs fail          |
| `trackBy` removed from the comments list | Expected specs fail          |
| **Total**                                | **21 mutations, all caught** |

After the checks, `git diff -- '*.html'` was empty: no template was left modified.

| Metric                                      | Before the new specs           | After the new specs            |
| ------------------------------------------- | ------------------------------ | ------------------------------ |
| Tests                                       | 76/76                          | 120/120                        |
| Coverage (stmts / branches / funcs / lines) | 57.41% / 74% / 51.82% / 55.36% | 76.92% / 74% / 68.29% / 75.65% |

> **Lesson:** statements rose by almost 20 points, but Branches stayed at 74%. Template branches (`*ngIf`, `*ngFor`) are not counted in the Branches metric, so a coverage report can look healthy while most template branches are untested. Whether a template is protected is answered by specs that render it, not by the percentage.

### Honest limits

| Not covered                                        | Why                                                    |
| -------------------------------------------------- | ------------------------------------------------------ |
| `article-list` `RangeError` when `limit` is unset  | Component code, not a template branch; not locked here |
| `catchError` navigation paths in article / profile | No template branch involved                            |

---

## 3. The concept: structural directives vs built-in control flow

**Before:** `*ngIf` and `*ngFor` are **directives** (`NgIf`, `NgForOf`) from `@angular/common`. The `*` is shorthand for an `<ng-template>` that the directive creates or removes at runtime. Like any directive in a standalone component, they must be listed in `imports`.

**After:** `@if` and `@for` are **template syntax**, handled by the template compiler. They are not directives, so there is nothing to import.

| Aspect                | Structural directive                           | Built-in control flow                    |
| --------------------- | ---------------------------------------------- | ---------------------------------------- |
| Condition             | `<li *ngIf="cond">`                            | `@if (cond) { <li> }`                    |
| Alias of an `async`   | `*ngIf="user$ \| async as user"`               | `@if (user$ \| async; as user) { … }`    |
| Loop                  | `*ngFor="let item of items"`                   | `@for (item of items; track item) { … }` |
| Tracking              | Optional `trackBy`; default is object identity | `track` is **mandatory**                 |
| Custom tracking       | `trackBy: trackById`                           | `track trackById($index, item)`          |
| Imports in components | `NgIf`, `NgForOf` in `imports`                 | None                                     |

**Why `track` is mandatory:** how a list reuses DOM elements is a choice with performance and state consequences. With `*ngFor`, omitting `trackBy` silently meant "track by object identity". `@for` makes the choice explicit in every loop.

**What that means for this migration:** a loop without `trackBy` becomes `track <item>`, which is object identity, the same as the `*ngFor` default. A loop with `trackBy` becomes a call to the same function with the same arguments. In both cases the tracking behavior is the same as before; the template just states it.

---

## 4. What the migration did (`59ae6a4`)

```bash
npx ng g @angular/core:control-flow --path=src --format=true
```

Run on Angular 20.3.35. It updated 10 templates and the 10 matching component `.ts` files; no spec was touched.

| Before                                                 | After                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `*ngIf="cond"`                                         | `@if (cond) { … }`                                                   |
| `*ngIf="x \| async as y"`                              | `@if (x \| async; as y) { … }`                                       |
| `*ngFor="let item of items"`                           | `@for (item of items; track item) { … }`                             |
| `*ngFor="let comment of comments; trackBy: trackById"` | `@for (comment of comments; track trackById($index, comment)) { … }` |
| `NgIf` / `NgForOf` in `imports` and TS imports         | Removed                                                              |

Two real excerpts. The header, with the `async as` alias and a nested condition:

```diff
// header.component.html (59ae6a4)
-      <li class="nav-item" *ngIf="currentUser$ | async as currentUser">
+      @if (currentUser$ | async; as currentUser) {
+      <li class="nav-item">
 ...
-          <img
-            [src]="currentUser.image"
-            *ngIf="currentUser.image"
-            class="user-pic"
-          />
+          @if (currentUser.image) {
+          <img [src]="currentUser.image" class="user-pic" />
+          }
```

The comments list, the only loop with custom tracking:

```diff
// article.component.html (59ae6a4)
+        @for (comment of comments; track trackById($index, comment)) {
         <app-article-comment
-          *ngFor="let comment of comments; trackBy: trackById"
           [comment]="comment"
```

The migration's own output formatting was normalized with Prettier, so the diff follows the project's style. Final diff: 20 files, +84 / −99. No `*ngIf` / `*ngFor` remains in `src/`.

> **Lesson:** the only conversion that needed a judgment call was `trackBy`, and it was locked by a DOM-identity spec before the migration ran. The review then had a concrete question to answer (same function, same arguments?) instead of a general one.

---

## 5. Verification and metrics

| Check                                   | Result                                                |
| --------------------------------------- | ----------------------------------------------------- |
| Spec files touched by the migration     | None (assertions identical before and after)          |
| Full suite                              | 120/120 ✅, including both `KNOWN BUG (locked)` specs |
| `grep -rnE '\*ng(If\|For\|Switch)' src` | No matches                                            |
| Compiler warnings                       | None                                                  |

**Method:** production build, 3 runs. The "before" column is stage 07's final measurement (Angular 20.3, structural directives), plus the new specs for tests and coverage.

| Metric                                      | Before (directives)            | After (control flow)           | Change              |
| ------------------------------------------- | ------------------------------ | ------------------------------ | ------------------- |
| Tests                                       | 120/120                        | 120/120                        | Unchanged           |
| Coverage (stmts / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65% | 76.92% / 74% / 68.29% / 75.65% | Unchanged           |
| Production build (3 runs)                   | 2.3 / 2.4 / 2.4 s              | 2.4 / 1.7 / 1.7 s              | No conclusion drawn |
| Initial bundle (raw)                        | 341.45 kB                      | 337.58 kB                      | −3.87 kB            |
| Initial bundle (transfer)                   | 96.52 kB                       | 96.02 kB                       | −0.50 kB            |
| `main`                                      | 8.68 kB                        | 8.47 kB                        | −0.21 kB            |
| Shared framework chunk                      | 294.87 kB                      | 291.21 kB                      | −3.66 kB            |
| `polyfills`                                 | 34.59 kB                       | 34.59 kB                       | Unchanged           |

> **Honesty about the numbers:** build times vary between runs and are not used as evidence. The bundle reduction is small but consistent with the change: the `NgIf` / `NgForOf` directives are no longer imported anywhere, so they no longer ship.

---

## 6. Findings

### a) The bundle shrank

- **Observation:** initial total −3.87 kB raw / −0.50 kB transfer; the reduction is in `main` and in the shared framework chunk.
- **Cause:** the `NgIf` / `NgForOf` directives no longer ship, because no component imports them.
- **Context:** stage 07 added +8.22 kB raw; this stage gives back part of it, for an unrelated reason.

### b) Behavior is identical, as far as the specs can see

- **Observation:** the same 120 specs, with unchanged assertions, pass before and after, including the DOM-identity spec for `trackBy` and the two locked-bug specs.
- **Limit:** this covers what the specs observe. The items in "Honest limits" (section 2) are not locked, and there is no manual runtime validation (the public API is unavailable).

---

## 7. Comparison with the "answer key" (upstream)

|                     | Maintainers                                                                                                                                 | This migration                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Control flow in v20 | [`a420aa2`](https://github.com/gothinkster/angular-realworld-example-app/commit/a420aa2): one `*ngIf` hand-converted to `@if` in the header | All 27 occurrences converted with the official migration          |
| v21 upgrade         | [`33bf8c3`](https://github.com/gothinkster/angular-realworld-example-app/commit/33bf8c3): only `package.json` and the lockfile changed      | Next stage; the control flow conversion is already done before it |
| Safety net          | —                                                                                                                                           | 44 characterization specs + 21 mutation checks before converting  |

> **Lesson:** in the two upstream commits compared here, control flow appears only as one hand-converted condition. Here it is a stage of its own, protected by specs first, so the v21 upgrade diff can stay about the framework version.

---

## 8. Follow-ups

| Topic                                                              | Detail                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Angular 20 → 21                                                    | Next stage; requires TypeScript 5.8 → 5.9                      |
| `ListErrorsComponent` renders an empty `ul.error-messages`         | Locked as `KNOWN BUG`; fix in its own `fix(...)` change        |
| `article-list` `RangeError` when `limit` is unset                  | Identified while writing the specs; component code, not locked |
| Builder package `@angular-devkit/build-angular` → `@angular/build` | Still open from stage 07 (`use-application-builder`)           |
| `APP_INITIALIZER` → `provideAppInitializer()`                      | Still open from stage 05                                       |
| Node 24                                                            | Still open from stage 07                                       |
