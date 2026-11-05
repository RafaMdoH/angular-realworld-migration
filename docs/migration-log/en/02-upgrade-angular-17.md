# 02 — Upgrade Angular 16.2 → 17.3

> Decision record: decisions, changes, validation, and comparison with the maintainers' migration.

**Branch:** `feature/upgrade-angular-17` · **Commits:** `3f66480` (Angular 17), `1e6ad58` (rx-angular 17)

---

## 1. Diagnosis before upgrading

| Question                         | How it was answered                                                   | Result                                                                   |
| -------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Is my Node still valid?          | `npm view @angular/core@17 engines.node`                              | `^18.13.0 \|\| >=20.9.0` → Node 18.20.8 ✅                               |
| Which TypeScript?                | `npm view @angular/compiler-cli@17 peerDependencies`                  | `>=5.2 <5.5` → must move from 5.1 (`ng update` does it)                  |
| Which zone.js?                   | `@angular/core@17` peerDependencies                                   | `~0.14.0`                                                                |
| Third parties tied to the major? | `ng update` + `npm view @rx-angular/template@17.3.1 peerDependencies` | rx-angular → `17.3.1` / cdk `17.1.0` (`ng update` again suggested 21 ❌) |
| Is what I'll touch covered?      | Existing characterization specs                                       | Yes: Home (`*rxLet`) was covered in stage 01                             |
| Does the app run? (smoke test)   | Already documented in 00 §1.1                                         | External CSS and API down: accepted risk                                 |

> **Lesson:** this diagnosis took 5 minutes because it is the **same checklist** as stage 01. That repeatability is what the skill-agent will later automate.

---

## 2. What `ng update @angular/core@17 @angular/cli@17` did

| Change                         | Before  | After   |
| ------------------------------ | ------- | ------- |
| `@angular/*`                   | 16.2.12 | 17.3.12 |
| `@angular/cli` / build-angular | 16.2.16 | 17.3.17 |
| `typescript`                   | 5.1     | **5.4** |
| `zone.js`                      | 0.13    | 0.14.10 |

### First automatic migration that DID change code

```diff
- "browserTarget": "angular-conduit:build:production"
+ "buildTarget": "angular-conduit:build:production"
```

**Why:** `browserTarget` assumed the build always targets the browser. With the new `application` builder, which serves both browser and SSR, the generic `buildTarget` name is correct. The old option was deprecated.

**Other migrations** (escaping `@` and `}` in templates for the new control-flow syntax, `TransferState` imports, JIT compiler options, invalid two-way bindings) reported **"No changes made"**.

> **Worth understanding:** the `@`/`}` escaping migration exists because in v17 these characters become template **syntax** (`@if`, `@for`). Text like `contact@company.com` in a template would break unless escaped (`&#64;`).

---

## 3. What `ng update` did NOT do (on purpose)

- **Did not switch the builder to esbuild.** The project stays on `build-angular:browser` (webpack). The `application` builder is the default only for **new** projects; for existing ones it is an optional migration (`ng update @angular/cli --name use-application-builder`).
- **Did not migrate to control flow** (`@if/@for`). That is an optional schematic (`ng generate @angular/core:control-flow`).

**Decision:** both are **modernization** and go in separate features, one concept per PR. Mixing them with the upgrade would hide which change broke what.

---

## 4. rx-angular 16 → 17

- Chosen by `peerDependencies` (`@angular/core ^17`), same as stage 01.
- This time **no breaking changes**: build and 72/72 specs green on first try.

> **Lesson:** not every third-party major breaks. What matters is **proving** it with build and tests, not assuming it.

---

## 5. Validation

| #   | Validation                     | Result                                                    |
| --- | ------------------------------ | --------------------------------------------------------- |
| 1   | `ng build` after `ng update`   | ✅                                                        |
| 2   | 72 specs after `ng update`     | 72/72 ✅                                                  |
| 3   | `ng build` after rx-angular 17 | ✅                                                        |
| 4   | 72 specs + coverage            | 72/72 ✅, coverage unchanged (57.41%)                     |
| 5   | Production `git diff`          | Only `angular.json` (official migration) and dependencies |

---

## 6. Comparison with the "answer key" (upstream)

|            | Maintainers (`6d97f15`, 2024-02-19)                 | This migration                                                   |
| ---------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| Angular    | 17.0.7 → 17.2.1 (two steps within v17)              | 16.2 → 17.3, straight to the latest minor                        |
| TypeScript | 5.2                                                 | 5.4                                                              |
| rx-angular | 17.0.0 (aligned in `e0a5940`, 2023-12-18)           | 17.3.1 / cdk 17.1.0                                              |
| Builder    | **`browser-esbuild`** (already switched to esbuild) | webpack (`browser`): the switch will be a separate modernization |

> **Lesson:** `browser-esbuild` is the **transition** builder: esbuild with the same configuration as the `browser` builder, without adopting the full `application` builder (Vite, `/browser` output, unified SSR). A valid middle step when the `application` builder breaks something.

---

## 7. Metrics

| Metric          | v16        | v17        | Note                             |
| --------------- | ---------- | ---------- | -------------------------------- |
| Specs           | 72         | 72         | Unchanged                        |
| Statements      | 57.41%     | 57.41%     | Unchanged                        |
| Build           | ~3.6–5.4 s | ~4.1–5.9 s | Still webpack; varies with cache |
| Bundle (`dist`) | 516 KB     | 532 KB     | +16 KB (Angular 17 runtime)      |

---

## 7.1 v17 features

Official reference: [Angular blog](https://blog.angular.dev/) and [Angular documentation](https://angular.dev/).
