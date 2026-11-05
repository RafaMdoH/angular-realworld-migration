# 01 — Upgrade Angular 15.2 → 16.2

> Decision record: decisions, errors, validation, and comparison with the maintainers' real migration.

**Branch:** `feature/upgrade-angular-16` · **Commits:** `dad1951`, `6a52335`, `1b12adb`, `0dc3c0f`

---

## 1. Diagnosis before upgrading

| Question                                      | How it was answered                  | Result                                                                   |
| --------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| Is my Node still valid?                       | Angular 16 compatibility matrix      | Node ^16.14 \|\| ^18.10 → Node 18 is still valid                         |
| Which TypeScript is required?                 | Compatibility matrix                 | >=4.9.3 <5.2 → must move off 4.8 (`ng update` does it)                   |
| Which packages are tied to the Angular major? | `ng update` (no args) + `npm ls`     | `@rx-angular/cdk` and `@rx-angular/template` (v15 = Angular 15)          |
| Are they covered by tests?                    | CodeGraph: where is rx-angular used? | **Only in `HomeComponent`, which had no tests** → hole in the safety net |

### Decision: close the gap BEFORE upgrading

`*rxLet` (rx-angular) is only used in the Home tag list, and Home was not part of the stage-00 characterization tests. Upgrading rx-angular without a test watching that template would let a break go unnoticed. So **T2 ran before the upgrade**: 5 new specs plus a validating mutation.

> **Lesson:** the safety net is not designed once. Before every step ask: "is what I'm about to touch covered?"

---

## 2. Error 1 — `ng update` fails before starting

```
✖ Migration failed: ... "packageManager":"bun" ...
Data path "/packageManager" must be equal to one of the allowed values: "npm", "yarn", "cnpm", "pnpm".
```

|               |                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cause**     | `~/.angular-config.json` (**global** CLI config) had `packageManager: "bun"`, left over from another bun project. Angular 15 CLI does not support bun.    |
| **Diagnosis** | The message said `"packageManager":"bun"`, but the repo has `package-lock.json` (npm). If the value isn't from the repo, it's from global config.         |
| **Fix**       | `ng config cli.packageManager npm` → stored in the **repo's** `angular.json`. Global config untouched to avoid affecting other projects.                  |
| **Lesson**    | Migration errors don't always come from code — also from the **machine environment**. Pinning config in the repo makes the build reproducible for anyone. |

---

## 3. Error 2 — `ng update` suggests the wrong versions

```
@rx-angular/cdk        15.0.0 -> 21.1.1     ng update @rx-angular/cdk
@rx-angular/template   15.1.0 -> 21.2.1     ng update @rx-angular/template
```

`ng update` suggests the **latest** version (21), not the one matching Angular 16. Installing 21 on Angular 16 would break everything.

**How the right version was chosen:** look up the version whose `peerDependencies` require `@angular/core ^16`:

```bash
npm view @rx-angular/template@16 version          # → 16.1.2
npm view @rx-angular/template@16.1.2 peerDependencies
# { "@angular/core": "^16.0.0", "@rx-angular/cdk": "^16.0.0", ... }
```

> **Lesson:** libraries coupled to the Angular major are upgraded **to the same major**, not to latest. `peerDependencies` are the source of truth.

---

## 4. What `ng update @angular/core@16 @angular/cli@16` did

| Change                         | Before | After   |
| ------------------------------ | ------ | ------- |
| `@angular/*`                   | 15.2.3 | 16.2.12 |
| `@angular/cli` / build-angular | 15.2   | 16.2.16 |
| `typescript`                   | 4.8    | **5.1** |
| `zone.js`                      | 0.12   | 0.13.3  |

Automatic migrations (remove `defaultProject`, deprecated guard interfaces, `moduleId`…) reported **"No changes made"**: the code was already modern (standalone, functional guards). In a "real" legacy app these migrations do change files, and each diff must be reviewed.

> **Note:** `ng update` does NOT commit by default. The commit was made manually after verification.

---

## 5. Observation — "works" ≠ "supported"

With Angular 16 and **rx-angular 15**, the build and all 72 tests passed. rx-angular was upgraded anyway. Why?

- rx-angular 15 declares support for Angular 15, not 16. Working today is **luck**, not a contract.
- That debt explodes in a later major, mixed with other errors, and is much harder to diagnose.

---

## 6. Error 3 — rx-angular 16 breaking change

```
error TS2305: Module '"@rx-angular/template/let"' has no exported member 'LetDirective'.
export 'LetDirective' was not found ... (possible exports: RxLet)
error NG1010: 'imports' must be an array of components, directives, pipes, or NgModules.
```

|                            |                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cause**                  | rx-angular 16 renamed the public export `LetDirective` → `RxLet`.                                                                                                        |
| **Diagnosis**              | Webpack's own error says `possible exports: RxLet`. `NG1010` is a **consequence** of the first error: with the import missing, the `imports` array contains `undefined`. |
| **Verified before fixing** | In `node_modules/@rx-angular/template/fesm2022/template-let.mjs` the selector is still `[rxLet]` → the template does **not** change, only the import.                    |
| **Fix**                    | 2 lines in `home.component.ts`: `import { RxLet }` and `imports: [..., RxLet]`.                                                                                          |
| **Lesson**                 | When several errors appear together, find the **first one in the chain**; the rest are usually side effects.                                                             |

---

## 7. Validation

| #   | Validation                                 | Result                                            |
| --- | ------------------------------------------ | ------------------------------------------------- |
| 1   | Mutation on the new Home spec              | Fixing the bug makes the `KNOWN BUG` spec fail ✅ |
| 2   | `ng build` after every step                | ✅ (failed at T4 → fixed → ✅)                    |
| 3   | 72 characterization specs                  | 72/72 ✅ at every step                            |
| 4   | Comparison with the maintainers' migration | See section 9                                     |

---

## 8. New locked finding

| #   | Behavior                                                                                                                                                                                          | Status            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 7   | `HomeComponent`: an **authenticated** user is redirected to `/login` on entry. `tap()` calls `setListTo("feed")` **before** `subscribe()` assigns `this.isAuthenticated`, which is still `false`. | KNOWN BUG, locked |

A classic **RxJS execution-order** bug: `tap` runs before the `subscribe` callback.

---

## 9. Comparison with the "answer key" (upstream)

|                | Maintainers                                 | This migration              |
| -------------- | ------------------------------------------- | --------------------------- |
| Upgrade to 16  | `0d28f5c` (2023-10-30): `package.json` only | Same for Angular/TS/zone.js |
| rx-angular     | **Not upgraded** in that commit             | Upgraded in the same step   |
| `RxLet` rename | `bd914dc` (2023-12-18), **7 weeks later**   | Detected and fixed in T4    |
| Tests          | None                                        | 72 characterization specs   |

> **Observation:** even the maintainers left a misaligned dependency. Checking third-party `peerDependencies` on every major is exactly the "human" work the automatic tool doesn't do.

---

## 10. Metrics

| Metric          | v15 (base) | v16        | Note                                          |
| --------------- | ---------- | ---------- | --------------------------------------------- |
| Specs           | 67         | 72         | +5 for Home                                   |
| Statements      | 44.78%     | 57.41%     | Rises due to new specs, not the upgrade       |
| Branches        | 56%        | 74%        | Same                                          |
| Build           | ~6.4 s     | ~3.6–5.4 s | Varies with cache; not a rigorous measurement |
| Bundle (`dist`) | 508 KB     | 516 KB     | +8 KB                                         |
