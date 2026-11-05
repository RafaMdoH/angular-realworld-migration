# 05 — Upgrade Angular 18.2 → 19.2

> Decision record: diagnosis, automatic migrations (with the concept behind the `standalone` change), how the safety net was checked, findings, metrics, and comparison with the maintainers' migration.

**Branch:** `feature/upgrade-angular-19` · **Commits:** `50343a8` (Angular 19), `05ba2dc` (rx-angular 19)

---

## 1. Diagnosis before upgrading

| Question                             | How it was answered                                       | Result                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Is my Node still valid?              | `engines` of Angular 19.2                                 | `^18.19.1 \|\| ^20.11.1 \|\| >=22` → Node 18.20.8 ✅. It is the **last major that accepts Node 18**                        |
| Which TypeScript?                    | Compiler `peerDependencies`                               | `>=5.5 <5.9` → current 5.4 is **not valid**, it must be bumped                                                             |
| Which zone.js?                       | `@angular/core@19` peerDependencies                       | `~0.15.0` → must move up from 0.14                                                                                         |
| Third parties tied to the major?     | `npm view @rx-angular/{template,cdk}@19 peerDependencies` | `cdk@19.1.0` and `template@19.2.2` → `@angular/core ^19`; `template@19.2.2` also requires `cdk ^19.1.0`                    |
| Does the CLI run on Node 18?         | Known gotcha from stage 03                                | Every `ng update` needs `NG_DISABLE_VERSION_CHECK=true`                                                                    |
| What new risk does this major bring? | v19 changelog + `standalone` inventory in the code        | `standalone` now defaults to `true`. 20 files declare `standalone: true`; `AppComponent` is the only NgModule-declared one |

> **Lesson:** the `standalone` inventory decides the real size of the change. With a single NgModule-declared component, the risk is concentrated in one file; the rest is removing a redundant flag.

---

## 2. What `ng update @angular/core@19 @angular/cli@19` did

```bash
NG_DISABLE_VERSION_CHECK=true npx ng update @angular/core@19 @angular/cli@19
```

| Change                         | Before   | After   |
| ------------------------------ | -------- | ------- |
| `@angular/*`                   | 18.2.14  | 19.2.25 |
| `@angular/cli` / build-angular | 18.2.21  | 19.2.27 |
| `typescript`                   | ~5.4.5   | ~5.8.3  |
| `zone.js`                      | ~0.14.10 | ~0.15.1 |

### Automatic migrations

| Migration                              | Result                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| **`explicit-standalone-flag`**         | **19 files**: 18 × `standalone: true` removed, `AppComponent` → `standalone: false` |
| `pending-tasks`                        | No changes (`ExperimentalPendingTasks` not used)                                    |
| `update-workspace-config`              | No changes to `angular.json`                                                        |
| `update-ssr-imports`                   | No changes (no SSR)                                                                 |
| `add-bootstrap-context-to-server-main` | No changes (no `main.server.ts`)                                                    |

### Optional migrations not run

| Migration                 | Reason                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `provide-initializer`     | `APP_INITIALIZER` → `provideAppInitializer()` is modernization, not an upgrade requirement (`APP_INITIALIZER` is only deprecated) |
| `use-application-builder` | Already done separately in stage 03                                                                                               |

---

## 3. `standalone` change: `true` becomes the default

**Why:** since v17 the documentation presents standalone components as the default model, and this repo already had 20 files declaring `standalone: true`. In v19 the compiler assumes `true` when the flag is absent, so declaring it becomes **redundant**.

**The consequence that breaks the build:** a component, directive, or pipe listed in an NgModule's `declarations` must now **opt out explicitly** with `standalone: false`. Without the flag, the compiler treats it as standalone and rejects the NgModule declaration. The `explicit-standalone-flag` migration does both: it adds `standalone: false` where needed and removes `standalone: true` where it is redundant.

```diff
// src/app/app.component.ts (50343a8)
 @Component({
   selector: "app-root",
   templateUrl: "./app.component.html",
+  standalone: false,
 })
```

```diff
// src/app/features/home/home.component.ts (50343a8) — same pattern in 16 more files
-  standalone: true,
```

The migration also reformatted some decorators; that noise was normalized with Prettier. **Final diff in `src/`: 1 insertion, 18 deletions** (17 in production code and 1 in a spec).

---

## 4. How the safety net was checked

| Check                                            | Result                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Specs touched by the migration                   | One: the host component in `show-authed.directive.spec.ts`                     |
| What changed in that spec                        | Only `standalone: true` removed; `imports`, template, and assertions identical |
| Full suite                                       | 76/76 ✅                                                                       |
| Coverage (statements / branches / funcs / lines) | 57.41% / 74% / 51.82% / 55.36%, identical to v18                               |

> **Lesson:** the migration touched a spec here, but only the test host's configuration, not what is being checked. The review is the same as in stage 04: confirm no assertion changed before trusting the green run.

---

## 5. Findings

### a) `standalone: true` the migration did not remove

- **Observation:** `ShowAuthedDirective` and `MarkdownPipe` keep `standalone: true` after the migration.
- **Contrast:** upstream `a6f16d0` shows the same result in those two files.
- **Cause:** not investigated.
- **Decision:** left as is. The flag is redundant but harmless, and removing it by hand would be a change outside the official migration.

### b) New diagnostic TS-998113: unused standalone imports

- **Observation:** the v19 compiler warns that `AsyncPipe` is in the `imports` of `HomeComponent` and `ProfileComponent` without being used in their templates.
- **Decision:** these are warnings, not errors. The cleanup is a follow-up, keeping one concept per change.

### c) Matching peers ≠ every transitive `engines` matching

- **Symptom:** installing rx-angular 19 (`05ba2dc`) makes npm print `EBADENGINE`: `ng-morph@4.9.1` depends on `minimatch@10`, which declares Node `20 || >=22`.
- **Scope:** tooling only (rx-angular schematics); not in the bundle. Build and tests pass on Node 18.
- **Lesson:** matching `peerDependencies` does not guarantee every transitive dependency accepts the installed Node. One more reason the next stage moves to Node 20.

---

## 6. Metrics: v18 vs v19

**Method:** same as previous stages (Node 18, production build, 3 runs). The v18 baseline was re-measured at the start of this stage.

| Metric                                      | v18                            | v19                            | Change               |
| ------------------------------------------- | ------------------------------ | ------------------------------ | -------------------- |
| Tests                                       | 76/76                          | 76/76                          | Unchanged            |
| Coverage (stmts / branches / funcs / lines) | 57.41% / 74% / 51.82% / 55.36% | 57.41% / 74% / 51.82% / 55.36% | Unchanged            |
| Production build (3 runs)                   | 3.6 / 2.4 / 2.4 s              | 2.9 / 2.5 / 2.4 s              | No noticeable change |
| Initial bundle (raw)                        | 335.06 kB                      | 333.23 kB                      | −1.83 kB             |
| Initial bundle (transfer)                   | 93.72 kB                       | 94.20 kB                       | +0.48 kB             |
| `polyfills`                                 | 34.52 kB                       | 34.59 kB                       | +0.07 kB             |
| `main`                                      | 8.75 kB                        | 8.68 kB                        | −0.07 kB             |

> **Honesty about the numbers:** the first run is slower in both versions (cold cache) and the rest match. Size differences are tenths of a kB; their cause was not investigated and they are not attributed to any specific feature.

---

## 7. Comparison with the "answer key" (upstream [`a6f16d0`](https://github.com/gothinkster/angular-realworld-example-app/commit/a6f16d0))

|                      | Maintainers (`a6f16d0`)                                    | This migration                       |
| -------------------- | ---------------------------------------------------------- | ------------------------------------ |
| Angular              | 19.2.14                                                    | 19.2.25                              |
| TypeScript / zone.js | ~5.8.3 / ~0.15.1                                           | ~5.8.3 / ~0.15.1                     |
| `standalone` result  | Same (including `ShowAuthedDirective` and `MarkdownPipe`)  | Same                                 |
| rx-angular           | 18.0.0 (peer `@angular/core ^18`: unsupported combination) | 19 (`cdk@19.1.0`, `template@19.2.2`) |
| Unused imports       | Removed in the same commit                                 | Out of scope; separate follow-up     |

> **Lesson:** the Angular end state is the same. The differences are about criteria: here peers must match (finding from stage 04) and each change carries one concept, even when the import cleanup is small.

---

## 7.1 v19 features

Official reference: [Angular blog](https://blog.angular.dev/) and [Angular documentation](https://angular.dev/).

---

## 8. Follow-ups

| Topic                                         | Detail                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `APP_INITIALIZER` → `provideAppInitializer()` | Deprecated in v19; optional migration `provide-initializer`. Used in `app.module.ts` (`initAuth`) |
| Unused standalone imports                     | Remove `AsyncPipe` in `HomeComponent` and `ProfileComponent` (TS-998113)                          |
| Node 20                                       | Required by Angular 20 and already by rx-angular 19 tooling                                       |
