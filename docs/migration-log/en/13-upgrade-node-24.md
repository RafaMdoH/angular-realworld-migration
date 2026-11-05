# 13 — Runtime upgrade Node 22 → Node 24 (Angular 22.2)

> Decision record: why the runtime moves now, how this stage closes the Node 24 attempt discarded in stage 06, what changed, how it was verified, and which npm 11 side effects appeared.

**Branch:** `feature/upgrade-node-24` · **Commit:** `027f333`

---

## 1. Diagnosis

### Why move now

| Reason                        | Detail                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Support window                | Node 22 is in maintenance LTS until April 2027; Node 24 is supported until April 2028                                         |
| Angular 22.2 declares Node 24 | `engines` of `@angular/core@22.2.4` and `@angular/build@22.2.6`: `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`                       |
| The stage 06 reason is gone   | Node 24 was rejected in stage 06 only because Angular CLI 19 did not list it as supported. The project is now on Angular 22.2 |
| One concept per change        | Runtime only. Out of scope: Vitest, zoneless change detection and dependency upgrades                                         |

### Stage 06 vs now

| Stage           | Angular / CLI | Node 24 build and tests | Official support for Node 24                                         | Decision        |
| --------------- | ------------- | ----------------------- | -------------------------------------------------------------------- | --------------- |
| 06              | 19.2 / 19     | Green, identical bundle | No: `ng version` showed `Node: 24.19.0 (Unsupported)`                | Stay on Node 22 |
| 13 (this stage) | 22.2 / 22     | Green, identical bundle | Yes: declared in `engines`; `ng version` shows no unsupported marker | Move to Node 24 |

The same Node 24.19.0 that was rejected in stage 06 is now officially supported. Nothing in the runtime changed; the framework's support matrix did.

### What depends on the Node version

| Item                     | State before this stage                                        |
| ------------------------ | -------------------------------------------------------------- |
| `.nvmrc`                 | `22`                                                           |
| `package.json` `engines` | `^22.12.0`                                                     |
| CI                       | Reads `.nvmrc` through `setup-node`: no workflow change needed |
| Installed runtime        | Node 24.19.0 via nvm                                           |

> **Finding:** the old `^22.12.0` was already below Angular 22's own Node 22 floor (`^22.22.3`). It was chosen in stage 06 as the minimum Node 22 for Angular 20, and nothing flagged it after later Angular upgrades raised the floor.

---

## 2. Changes (`027f333`)

| File                          | Before     | After      |
| ----------------------------- | ---------- | ---------- |
| `.nvmrc`                      | `22`       | `24`       |
| `package.json` `engines.node` | `^22.12.0` | `^24.15.0` |
| `package-lock.json`           | —          | Unchanged  |
| `src/`                        | —          | No changes |

**Why `^24.15.0`:** it is the Node 24 floor declared by Angular 22.2 (`@angular/core` and `@angular/build`), so `engines` now describes the range the framework actually supports.

`npm ci` on Node 24.19.0 / npm 11.17.0 was clean: no `EBADENGINE`, no `ERESOLVE`, and the lockfile was not rewritten.

---

## 3. Verification and metrics

**Method:** same as previous stages. The Node 22 baseline is stage 12's final measurement (Node 22.23.4) on the same tree.

| Metric                                      | Node 22                        | Node 24                        | Change    |
| ------------------------------------------- | ------------------------------ | ------------------------------ | --------- |
| Tests                                       | 122/122                        | 122/122                        | Unchanged |
| Coverage (stmts / branches / funcs / lines) | 76.98% / 74% / 68.48% / 75.72% | 76.98% / 74% / 68.48% / 75.72% | Unchanged |
| Initial bundle (raw)                        | 357.58 kB                      | 357.58 kB                      | Unchanged |
| Initial bundle (transfer)                   | 99.59 kB                       | 99.59 kB                       | Unchanged |
| Production build (3 runs)                   | Not recorded                   | 2.8 / 1.4 / 1.5 s              | —         |
| Compiler warnings                           | None                           | None                           | Unchanged |
| `npm audit`                                 | 20                             | 20                             | Unchanged |
| Packages installed by `npm ci`              | 595 (npm 10)                   | 586 (npm 11)                   | See §4    |

### Identical output across runtimes

Building with Node 22 and with Node 24 on the same `node_modules` produces the same 16 JavaScript output files with identical content hashes (`main-FIQHQIDM.js`, `polyfills-5CFQRCPP.js`, `chunk-DvJnFojZ.js`, …). The runtime change is invisible to the application.

### Support check with `ng version`

In stage 06 the support check relied on the `SUPPORTED_NODE_MAJORS` constant in the CLI sources. That constant was not found in the `@angular/cli@22` sources, so this stage uses the observable result instead: `ng version` reports `Node.js: 24.19.0` with no unsupported marker.

---

## 4. npm 11 side effects

Node 24 ships npm 11, which brings two differences unrelated to the application.

| Effect                   | Detail                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allow-scripts` warnings | npm 11 warns about 5 packages with install scripts: `@parcel/watcher`, `esbuild`, `fsevents`, `lmdb`, `msgpackr-extract`. Build and tests are unaffected |
| Package count            | `npm ci` installs 586 packages with npm 11 versus 595 with npm 10 on Node 22, from the same unchanged lockfile                                           |

> **Lesson:** a version rejected for a documented reason should be re-evaluated when that reason changes, not remembered as "doesn't work". Stage 06 recorded _why_ Node 24 was rejected (the CLI 19 support list), which made it possible to see exactly when the rejection stopped applying.

---

## 5. Follow-ups

| Topic                              | Detail                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| Karma → Vitest                     | Next stage (14)                                                                       |
| Zoneless change detection          | After Vitest, as its own modernization change                                         |
| `$safeNavigationMigration` cleanup | Still open from stage 11: adopt v22 template `?.` semantics and remove the wrapper    |
| `ChangeDetectionStrategy.Eager`    | Still open from stage 11: review those components when moving to OnPush / zoneless    |
| `allow-scripts` configuration      | Investigate only if npm starts blocking install scripts; today they are warnings only |
