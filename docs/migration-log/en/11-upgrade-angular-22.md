# 11 — Upgrade Angular 21.2 → 22.2 (+ TypeScript 6.0)

> Decision record: diagnosis, what `ng update` changed (with the concept behind the migrations that keep the previous behavior when a default changes), the TypeScript 6.0 `baseUrl` deprecation, how the safety net was checked, metrics, and the upstream situation.

**Branch:** `feature/upgrade-angular-22` · **Commits:** `978e3f5` (Angular 22 + TypeScript 6.0), `bd17f0e` (rx-angular 22)

---

## 1. Diagnosis before upgrading

Angular 22 is the current `latest` line (22.2.4; 22.0.0 was released on 2026-06-03). The project's plan was corrected to include this stage after checking npm at the close of stage 09; stage 10 moved the builder package first so that this stage could stay a pure version upgrade.

| Question                               | How it was answered                                       | Result                                                                                                                                                                                                                                              |
| -------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is my Node still valid?                | `engines` of Angular 22.2                                 | `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` → Node 22.23.4 ✅                                                                                                                                                                                            |
| Which TypeScript?                      | Compiler `peerDependencies`                               | `>=6.0 <6.1` → current 5.9.3 ❌, a TypeScript major is required                                                                                                                                                                                     |
| Which zone.js?                         | `@angular/core@22` peerDependencies                       | `~0.15.0 \|\| ~0.16.0` → current 0.15.1 ✅                                                                                                                                                                                                          |
| Third parties tied to the major?       | `npm view @rx-angular/{template,cdk}@22 peerDependencies` | `cdk@22.0.0` → `@angular/core >=22.0.0`; `template@22.0.0` requires cdk `^22.0.0` (no longer an exact version)                                                                                                                                      |
| Which migrations will `ng update` run? | v22 migration catalog                                     | Candidates for this app: `change-detection-eager` (18 components, 2 already `OnPush`), `safe-optional-chaining` (2 occurrences of `?.` in 1 template), `strict-safe-navigation-narrow`, `http-xhr-backend`, `add-istanbul-instrumenter`, and others |
| What does `Eager` mean?                | `ChangeDetectionStrategy` enum in `@angular/core@22`      | `OnPush = 0`, `Eager = 1`, `Default = 1`: `Eager` is the new name for the old default value                                                                                                                                                         |
| Will TypeScript 6.0 complain?          | `tsconfig.json`                                           | It still sets `baseUrl`, a candidate for a deprecation error                                                                                                                                                                                        |

> **Lesson:** this major brings several new defaults at once. Reading the migration catalog and the enum values before running `ng update` turned a large diff into a list of expected changes to tick off.

---

## 2. What `ng update @angular/core@22 @angular/cli@22` did

```bash
npx ng update @angular/core@22 @angular/cli@22
```

| Change                               | Before  | After                      |
| ------------------------------------ | ------- | -------------------------- |
| `@angular/*`                         | 21.2.26 | 22.2.4                     |
| `@angular/cli` / `@angular/build`    | 21.2.29 | 22.2.6                     |
| `typescript`                         | 5.9.3   | 6.0.3 (set by `ng update`) |
| `zone.js`                            | 0.15.1  | Unchanged                  |
| `@rx-angular/cdk`                    | 21.1.1  | 22.0.0                     |
| `@rx-angular/template`               | 21.2.1  | 22.0.0                     |
| `istanbul-lib-instrument` (dev, new) | —       | `^6.0.3`                   |

rx-angular was installed separately (`bd17f0e`), with caret ranges as before. No `EBADENGINE` and no `ERESOLVE`.

### Automatic migrations with changes

| Migration                           | Result                                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **`change-detection-eager`**        | `changeDetection: ChangeDetectionStrategy.Eager` added to the 16 components with no strategy and to one test host component                  |
| **`http-xhr-backend`**              | `provideHttpClient(withXhr(), withInterceptorsFromDi())` in `app.module.ts` and in the `TestBed` providers of 6 specs                        |
| **`safe-optional-chaining`**        | `currentUser?.image` in `article.component.html` wrapped in `$safeNavigationMigration(...)` (twice)                                          |
| **`strict-safe-navigation-narrow`** | `tsconfig.app.json` and `tsconfig.spec.json` suppress the `nullishCoalescingNotNullable` and `optionalChainNotNullable` extended diagnostics |
| **`add-istanbul-instrumenter`**     | `istanbul-lib-instrument` added to `devDependencies` (Karma coverage)                                                                        |

### Automatic migrations with no changes

| Migration                     | Result                          |
| ----------------------------- | ------------------------------- |
| `can-match-snapshot-required` | No changes                      |
| `incremental-hydration`       | No changes                      |
| `model-output`                | No changes                      |
| `strict-templates-default`    | Already `strictTemplates: true` |
| `trust-proxy-headers`         | No changes                      |
| `update-workspace-config`     | No changes                      |

### Optional migrations not run

| Migration                 | Reason                                 |
| ------------------------- | -------------------------------------- |
| `migrate-karma-to-vitest` | Karma → Vitest stays a separate change |
| `use-application-builder` | Already done in stage 10               |

---

## 3. Concept: new defaults, old behavior preserved

The v22 migrations that touched this app share one pattern: where v22 changes a default, the migration writes the previous behavior explicitly into the code. Each one is reviewed below.

### a) `ChangeDetectionStrategy.Eager`

```diff
// src/app/core/layout/header.component.ts (978e3f5)
-import { Component, inject } from "@angular/core";
+import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
 ...
+  changeDetection: ChangeDetectionStrategy.Eager,
```

- **What the migration does:** it adds `ChangeDetectionStrategy.Eager` to every component that did not declare a strategy (16 components plus the test host in `show-authed.directive.spec.ts`).
- **Why behavior is unchanged:** in the v22 enum `Eager` and the old `Default` have the same value (`1`). The migration makes the previous behavior explicit, so existing components keep their change detection.
- **What it leaves alone:** the 2 components already marked `OnPush` are untouched.

### b) `withXhr()`

```diff
// src/app/app.module.ts (978e3f5)
-    provideHttpClient(withInterceptorsFromDi()),
+    provideHttpClient(withXhr(), withInterceptorsFromDi()),
```

The migration adds `withXhr()` so the app keeps the XHR backend for `HttpClient`. The same line was added to the `TestBed` providers of 6 specs, so the specs keep running against the same backend as the app.

### c) `$safeNavigationMigration` in a template

```diff
// src/app/features/article/article.component.html (978e3f5)
-                  [src]="currentUser?.image === null ? '' : currentUser?.image"
+                  [src]="
+                    $safeNavigationMigration(currentUser?.image) === null
+                      ? ''
+                      : $safeNavigationMigration(currentUser?.image)
+                  "
```

- **What the migration does:** it wraps the two `?.` expressions of the comment-form avatar so they keep the pre-v22 result of `?.` in templates.
- **Why it matters here:** the expression compares the result against `null`, so the value `?.` produces when `currentUser` is null decides which branch is taken. The wrapper keeps that value as it was before v22.
- **Honest note:** the wrapped expression only differs from plain `?.` when `currentUser` is null. The block sits inside `*appShowAuthed="true"`, so that case is not reached in normal use, and it is not covered by a spec. Adopting the v22 semantics and removing the wrapper is a follow-up.

### d) Suppressed extended diagnostics

```diff
// tsconfig.app.json (978e3f5); same change in tsconfig.spec.json
-  "include": ["src/**/*.d.ts"]
+  "include": ["src/**/*.d.ts"],
+  "angularCompilerOptions": {
+    "extendedDiagnostics": {
+      "checks": {
+        "nullishCoalescingNotNullable": "suppress",
+        "optionalChainNotNullable": "suppress"
+      }
+    }
+  }
```

`strict-safe-navigation-narrow` suppresses two extended diagnostics about `??` and `?.` on values the compiler considers non-nullable. The build reports no compiler warnings.

> **Lesson:** in this major the migrations touched more than 25 files without changing behavior. A big diff is not necessarily a risky diff, but each kind of change must be reviewed: here there were four kinds, and each one was checked against the behavior it preserves.

---

## 4. TypeScript 6.0 and `baseUrl`

After `ng update`, the build failed:

```text
TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0
```

No migration handled it. The fix was a one-line manual change in `978e3f5`:

```diff
// tsconfig.json (978e3f5)
-    "baseUrl": "./",
```

- **Why removing it is safe here:** no import relies on `baseUrl`. All imports are relative paths or package names, and there is no `paths` mapping.
- **Why not `ignoreDeprecations: "6.0"`:** that option only silences the error, and the setting would stop working in TypeScript 7.0 anyway. Removing an unused option fixes the cause instead of postponing it.
- **Upstream:** upstream's `tsconfig.json` has no `baseUrl` either.

> **Lesson:** a deprecation error is a dated warning about the next major. When the deprecated option is unused, removing it is cheaper than silencing it and carrying the problem into the next upgrade.

---

## 5. How the safety net was checked

| Check                                            | Result                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| Spec changes                                     | Provider configuration only (`withXhr()`, `Eager` on a test host) |
| Assertions changed                               | None                                                              |
| Full suite                                       | 120/120 ✅                                                        |
| Coverage (statements / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65%, same as v21                       |
| Compiler warnings                                | None                                                              |

> **Lesson:** specs were touched, but only in how the test module is configured, mirroring the production change. The assertions are the same ones that passed on v21, so the green result still says the upgrade is invisible to the behavior they lock.

---

## 6. Metrics: v21 vs v22

**Method:** same as previous stages (production build, 3 runs). The v21 baseline is stage 10's final measurement (Angular 21.2 + `@angular/build`).

| Metric                                      | v21 (stage 10)                 | v22                            | Change              |
| ------------------------------------------- | ------------------------------ | ------------------------------ | ------------------- |
| Tests                                       | 120/120                        | 120/120                        | Unchanged           |
| Coverage (stmts / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65% | 76.92% / 74% / 68.29% / 75.65% | Unchanged           |
| Production build (3 runs)                   | 2.5 / 2.3 / 2.4 s              | 1.7 / 1.7 / 1.7 s              | No conclusion drawn |
| Initial bundle (raw)                        | 346.08 kB                      | 357.60 kB                      | +11.52 kB           |
| Initial bundle (transfer)                   | 97.59 kB                       | 99.56 kB                       | +1.97 kB            |
| `main`                                      | 8.51 kB                        | 10.92 kB                       | +2.41 kB            |
| Shared framework chunk                      | 299.67 kB                      | 311.42 kB                      | +11.75 kB           |
| `polyfills`                                 | Same hash                      | Same hash                      | Unchanged           |
| Initial JS chunks                           | 7                              | 3                              | Layout changed      |
| Installed packages                          | 710                            | 595                            | −115                |
| `npm audit` findings                        | 35                             | 20 (no critical)               | −15                 |

The output layout also changed: chunk hashes now use mixed case (for example `chunk-DhfQOmZR.js`).

> **Honesty about the numbers:** build times vary between runs and are not used as evidence (the first build after `ng update` took 2.8 s). The bundle growth is real but small, and its cause was not investigated. Fewer installed packages and fewer audit findings come with the new versions; they are reported, not attributed to any specific change.

---

## 7. Upstream: no answer key for this stage

There is no Angular 22 commit upstream to compare with. Upstream `main` is still on Angular 21.2.12 with TypeScript ~5.9.3.

|            | Upstream `main`        | This migration        |
| ---------- | ---------------------- | --------------------- |
| Angular    | 21.2.12                | 22.2.4                |
| TypeScript | ~5.9.3                 | 6.0.3                 |
| `baseUrl`  | Not in `tsconfig.json` | Removed in this stage |

> **Lesson:** this project is now ahead of its answer key. From here on, each stage has to be justified by its own diagnosis, migrations and safety net, without a reference commit to compare against.

---

## 8. Follow-ups

| Topic                                                  | Detail                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Adopt v22 template `?.` semantics                      | Remove the `$safeNavigationMigration` wrapper in `article.component.html` |
| Review `ChangeDetectionStrategy.Eager` components      | When moving to `OnPush` / zoneless                                        |
| `APP_INITIALIZER` → `provideAppInitializer()`, Node 24 | Next planned stage                                                        |
| Karma → Vitest                                         | `migrate-karma-to-vitest` is available as an optional migration           |
| Zoneless change detection                              | After Vitest                                                              |
