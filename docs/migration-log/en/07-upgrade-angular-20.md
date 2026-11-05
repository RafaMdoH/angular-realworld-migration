# 07 — Upgrade Angular 19.2 → 20.3

> Decision record: diagnosis, automatic migrations (with the concept behind the two configuration changes), how the safety net was checked, findings, metrics, and comparison with the maintainers' migration.

**Branch:** `feature/upgrade-angular-20` · **Commits:** `abd10b3` (Angular 20), `c5389c3` (rx-angular 20)

---

## 1. Diagnosis before upgrading

| Question                             | How it was answered                                       | Result                                                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is my Node still valid?              | `engines` of Angular 20.3                                 | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0` → Node 22.23.4 ✅ (stage 06)                                                                                                       |
| Which TypeScript?                    | Compiler `peerDependencies`                               | `>=5.8 <6.0` → current 5.8.3 ✅, no bump needed                                                                                                                           |
| Which zone.js?                       | `@angular/core@20` peerDependencies                       | `~0.15.0` → current 0.15.1 ✅                                                                                                                                             |
| Third parties tied to the major?     | `npm view @rx-angular/{template,cdk}@20 peerDependencies` | `cdk@20.1.1` and `template@20.1.0` → `@angular/core ^20`; `template@20.1.0` also requires `cdk ^20.1.0`. `ng update` suggests 22.0.0, which requires `@angular/core >=22` |
| APIs removed in v20 in use?          | Search for `TestBed.get`, `InjectFlags`, `ng-reflect-*`   | None                                                                                                                                                                      |
| What is deprecated and still in use? | Template inventory + `app.module.ts`                      | `*ngIf` / `*ngFor` in 10 templates (no `@if` / `@for` yet); `APP_INITIALIZER` still in `app.module.ts`                                                                    |
| What does the config look like?      | `tsconfig.json`                                           | `moduleResolution: "node"`: to review what the v20 migration does with it                                                                                                 |

> **Lesson:** Node, TypeScript, and zone.js already matched before running `ng update`. Moving the runtime in its own stage (06) left only the framework and its peers for this one.

---

## 2. What `ng update @angular/core@20 @angular/cli@20` did

```bash
npx ng update @angular/core@20 @angular/cli@20
```

No `NG_DISABLE_VERSION_CHECK` is needed anymore (retired in stage 06).

| Change                         | Before  | After     |
| ------------------------------ | ------- | --------- |
| `@angular/*`                   | 19.2.25 | 20.3.35   |
| `@angular/cli` / build-angular | 19.2.27 | 20.3.42   |
| `typescript`                   | 5.8.3   | Unchanged |
| `zone.js`                      | 0.15.1  | Unchanged |
| `@rx-angular/cdk`              | 19.1.0  | 20.1.1    |
| `@rx-angular/template`         | 19.2.2  | 20.1.0    |

rx-angular was installed separately (`c5389c3`), with caret ranges as before. No `EBADENGINE` and no `ERESOLVE`.

### Automatic migrations

| Migration                                        | Result                                                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Workspace generation defaults**                | `angular.json` gets a `schematics` block that keeps the pre-v20 file naming (`type: component\|directive\|service`, `typeSeparator: "."`) |
| **`moduleResolution`**                           | `tsconfig.json`: `node` → `bundler`                                                                                                       |
| `provideServerRendering` imports/routes          | No changes                                                                                                                                |
| Default karma config removal                     | No changes                                                                                                                                |
| `DOCUMENT` import move                           | No changes                                                                                                                                |
| `InjectFlags`, `TestBed.get`, `BootstrapContext` | No changes                                                                                                                                |

### Optional migrations not run

| Migration                   | Reason                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `control-flow-migration`    | `*ngIf` / `*ngFor` → `@if` / `@for` is modernization, not an upgrade requirement (directives are only deprecated) |
| `router-current-navigation` | No usage of `getCurrentNavigation`                                                                                |
| `use-application-builder`   | Would switch the builder package to `@angular/build`; deferred to its own change (see follow-ups)                 |

---

## 3. The two configuration migrations

### `moduleResolution: "bundler"`

**What it controls:** how TypeScript finds the file behind an `import` of a package.

**Why it changes:** since stage 03 the app is built by the esbuild `application` builder, so a bundler is what actually resolves imports. `bundler` mode models how bundlers resolve modules, including the `exports` field of `package.json`. With `node`, type checking followed a different resolution model from the one the build uses; with `bundler`, both read packages the same way.

```diff
// tsconfig.json (abd10b3)
-    "moduleResolution": "node",
+    "moduleResolution": "bundler",
```

### Generation defaults that preserve the old file naming

**What changes in v20:** the updated style guide drops type suffixes from the names of newly generated files.

**What the migration does:** it pins the previous style in `angular.json`, so files generated from now on match the ones that already exist. It does not rename anything.

```diff
// angular.json (abd10b3) — excerpt
+  "schematics": {
+    "@schematics/angular:component": {
+      "type": "component"
+    },
+    "@schematics/angular:guard": {
+      "typeSeparator": "."
+    },
```

The full block covers `component`, `directive`, and `service` (`type`) and `guard`, `interceptor`, `module`, `pipe`, and `resolver` (`typeSeparator`).

> **Lesson:** neither migration touches application code. They align configuration with how the project is built today (bundler) and with how it was written so far (file naming), so the upgrade does not change conventions by accident.

---

## 4. How the safety net was checked

| Check                                            | Result                                      |
| ------------------------------------------------ | ------------------------------------------- |
| Files under `src/` touched by the upgrade        | None (production code and specs unchanged)  |
| Full suite                                       | 76/76 ✅                                    |
| Coverage (statements / branches / funcs / lines) | 57.41% / 74% / 51.82% / 55.36%, same as v19 |

> **Lesson:** with no changes under `src/`, the specs are the same ones that passed on v19, assertions included. The green result says the framework change is invisible to the behavior they lock.

---

## 5. Findings

### a) The unused-imports diagnostic changed its code: TS-998113 → NG8113

- **Observation:** the warning about unused standalone imports is now reported as `NG8113` (it was TS-998113 in v19).
- **Scope:** the same two `AsyncPipe` imports as in stage 05.
- **Decision:** still a warning, still a follow-up. When searching logs or docs, both codes refer to the same pending cleanup.

### b) Deprecated structural directives in 10 templates

- **Observation:** `*ngIf` and `*ngFor` are deprecated in v20; 10 templates use them and none use `@if` / `@for` yet.
- **Status:** they remain supported; nothing fails.
- **Decision:** converting them is modernization, not an upgrade requirement. It goes in its own change with the optional `control-flow-migration`.

### c) Initial bundle grows by +8.22 kB raw / +2.32 kB transfer

- **Observation:** initial total goes from 333.23 kB to 341.45 kB raw (94.20 → 96.52 kB transfer).
- **Where:** `main` (8.68 kB) and `polyfills` (34.59 kB, same hash) are unchanged, so the growth is in the shared framework chunk (`chunk-*`, 294.87 kB raw on v20).
- **Limit of the evidence:** the size of that chunk on v19 was not recorded, so the growth cannot be broken down further.
- **Cause:** not investigated. It is not attributed to any specific feature.

---

## 6. Metrics: v19 vs v20

**Method:** same as previous stages (production build, 3 runs). The v19 baseline is stage 06's final measurement on the same tree (v19 + Node 22).

| Metric                                      | v19                            | v20                            | Change               |
| ------------------------------------------- | ------------------------------ | ------------------------------ | -------------------- |
| Tests                                       | 76/76                          | 76/76                          | Unchanged            |
| Coverage (stmts / branches / funcs / lines) | 57.41% / 74% / 51.82% / 55.36% | 57.41% / 74% / 51.82% / 55.36% | Unchanged            |
| Production build (3 runs)                   | 2.8 / 2.4 / 2.4 s              | 2.3 / 2.4 / 2.4 s              | No noticeable change |
| Initial bundle (raw)                        | 333.23 kB                      | 341.45 kB                      | +8.22 kB             |
| Initial bundle (transfer)                   | 94.20 kB                       | 96.52 kB                       | +2.32 kB             |
| `polyfills`                                 | 34.59 kB                       | 34.59 kB (same hash)           | Unchanged            |
| `main`                                      | 8.68 kB                        | 8.68 kB                        | Unchanged            |

> **Honesty about the numbers:** build-time differences are within run-to-run noise. The bundle growth is real but small, it sits entirely in the shared framework chunk, and its cause was not investigated.

---

## 7. Comparison with the "answer key" (upstream [`a420aa2`](https://github.com/gothinkster/angular-realworld-example-app/commit/a420aa2))

|                       | Maintainers (`a420aa2`)                                                                    | This migration                       |
| --------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| Angular               | 20.0.0                                                                                     | 20.3.35                              |
| `moduleResolution`    | `bundler`                                                                                  | `bundler` (same)                     |
| Builder package       | Switched to `@angular/build` (builders `@angular/build:*`)                                 | Kept `@angular-devkit/build-angular` |
| rx-angular            | 18.0.0 (peer `@angular/core ^18`: unsupported combination on 20)                           | 20 (`cdk@20.1.1`, `template@20.1.0`) |
| Templates and imports | One `*ngIf` hand-converted to `@if` in the header; `NgIf` and other unused imports removed | Out of scope; separate follow-ups    |

> **Lesson:** the configuration result for Angular is the same. The differences are about criteria again: peers must match, and the builder package switch and template modernization are separate concepts, so each gets its own change.

---

## 8. Follow-ups

| Topic                                                              | Detail                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Builder package `@angular-devkit/build-angular` → `@angular/build` | Optional migration `use-application-builder`; upstream did it in its v20 commit |
| `*ngIf` / `*ngFor` → built-in control flow                         | Optional migration `control-flow-migration`; 10 templates                       |
| `APP_INITIALIZER` → `provideAppInitializer()`                      | Still open from stage 05. Used in `app.module.ts`                               |
| Unused standalone imports                                          | Still open from stage 05: `AsyncPipe` (now reported as NG8113)                  |
| Node 24                                                            | Now officially supported by Angular 20                                          |
