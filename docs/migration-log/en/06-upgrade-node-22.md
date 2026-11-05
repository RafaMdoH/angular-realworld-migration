# 06 — Runtime upgrade Node 18 → Node 22 (Angular 19.2)

> Decision record: why the runtime moves before the framework, how the target version was chosen (including a discarded Node 24 attempt), what changed, how it was verified, and what the change unlocked.

**Branch:** `feature/upgrade-node-22` · **Commit:** `0294218`

---

## 1. Diagnosis

### Why move now

| Reason                        | Detail                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Node 18 and Node 20 are EOL   | Both majors are end-of-life (Node 20 since April 2026)                                                                        |
| Angular 20 drops Node 18      | Angular 20 `engines`: `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`                                                                  |
| Tooling already asks for more | Stage 05 left an `EBADENGINE` warning: rx-angular 19 tooling (`ng-morph@4.9.1` → `minimatch@10`) declares Node `20 \|\| >=22` |
| One concept per change        | Changing the runtime on its own, before Angular 20, keeps the framework upgrade free of runtime noise                         |

### What depends on the Node version

| Item                       | State before this stage                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `.nvmrc`                   | `18`                                                                                                 |
| `package.json` `engines`   | Still the upstream Angular 15 range (`^14.20.0 \|\| ^16.13.0 \|\| ^18.10.0`), which excludes Node 22 |
| CI                         | Reads `.nvmrc` through `setup-node` (`node-version-file: .nvmrc`): no workflow change needed         |
| `.npmrc` / `engine-strict` | Not present                                                                                          |
| Docs                       | README and `PROJECT_CONTEXT.md` mention Node 18 and `NG_DISABLE_VERSION_CHECK`                       |

> **Lesson:** `engines` had not been touched since the upstream baseline (`e28c896`). Five Angular majors went by with a range that no longer described the project; nothing enforced it because there is no `engine-strict`.

---

## 2. Choosing the target version

| Node | Angular 19 (CLI 19)             | Angular 20 (CLI 20) | Notes                                 |
| ---- | ------------------------------- | ------------------- | ------------------------------------- |
| 20   | Supported                       | Supported           | End-of-life since April 2026          |
| 22   | Supported                       | Supported           | Only active major in both             |
| 24   | `(Unsupported)` in `ng version` | Supported           | Accepted by `engines`, not by the CLI |

### The Node 24 attempt (discarded)

On Node 24.19 / npm 11.17, build and tests were green and the bundle was byte-identical. But `ng version` reported:

```text
Node: 24.19.0 (Unsupported)
```

The reason is a mismatch inside Angular CLI 19 itself:

| Source                                                                         | What it accepts             |
| ------------------------------------------------------------------------------ | --------------------------- |
| `engines` of CLI 19                                                            | `>=22.0.0` (Node 24 passes) |
| `SUPPORTED_NODE_MAJORS` in `@angular/cli/src/commands/version/cli.js` (CLI 19) | `[18, 20, 22]`              |
| `SUPPORTED_NODE_MAJORS` in CLI 20                                              | `[20, 22, 24]`              |

**Decision:** Node 22 now; Node 24 in a later stage, on Angular 20+. This applies the same criterion as stage 05 ("peers must match"): a combination that works but is not officially supported is not accepted, even when every check is green.

> **Lesson:** `engines` is the floor npm checks, not the official support matrix. The CLI's own list of supported majors is stricter, and a green build does not reveal the difference.

---

## 3. Changes

| File                          | Before                                 | After      |
| ----------------------------- | -------------------------------------- | ---------- |
| `.nvmrc`                      | `18`                                   | `22`       |
| `package.json` `engines.node` | `^14.20.0 \|\| ^16.13.0 \|\| ^18.10.0` | `^22.12.0` |
| `package-lock.json`           | —                                      | Unchanged  |
| `src/`                        | —                                      | No changes |

**Why `^22.12.0`:** it is the minimum Node 22 accepted by Angular 20, so the range stays valid through the next stage without another edit.

`npm ci` on Node 22.23.4 / npm 10.9.9 was clean and did not rewrite the lockfile.

---

## 4. Verification and metrics

**Method:** same as previous stages (production build, 3 runs). The Node 18 baseline is stage 05's final measurement on the same tree.

| Metric                                         | Node 18                        | Node 22                                                  | Change               |
| ---------------------------------------------- | ------------------------------ | -------------------------------------------------------- | -------------------- |
| Tests                                          | 76/76                          | 76/76                                                    | Unchanged            |
| Coverage (stmts / branches / funcs / lines)    | 57.41% / 74% / 51.82% / 55.36% | 57.41% / 74% / 51.82% / 55.36%                           | Unchanged            |
| Production build (3 runs)                      | 2.9 / 2.5 / 2.4 s              | 2.8 / 2.4 / 2.4 s                                        | No noticeable change |
| Initial bundle (raw)                           | 333.23 kB                      | 333.23 kB                                                | Unchanged            |
| Initial bundle (transfer)                      | 94.20 kB                       | 94.20 kB                                                 | Unchanged            |
| `ng update` without `NG_DISABLE_VERSION_CHECK` | Workaround required (stage 03) | Runs; `ng version` shows `Node: 22.23.4` without warning | Workaround retired   |

The output is byte-identical: `main` and `polyfills` keep the same hashes on both runtimes.

> **Honesty about the numbers:** build-time differences are a tenth of a second and within run-to-run noise; they are not attributed to Node 22. The meaningful result is the identical bundle: the runtime change is invisible to the app.

---

## 5. Side effects

| Effect                             | Detail                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `EBADENGINE` gone                  | The rx-angular tooling warning (`minimatch@10`) from stage 05 no longer appears on `npm ci` |
| `NG_DISABLE_VERSION_CHECK` retired | The workaround needed for every `ng update` since stage 03 is no longer required            |
| `ng update` sees the next majors   | It now runs without the workaround and lists Angular 20.3.9 and rx-angular 22.0.0           |

---

## 6. Follow-ups

| Topic                                         | Detail                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Node 24                                       | Once on Angular 20+ (CLI 20 supports it). Node 22 maintenance LTS ends April 2027           |
| `npm audit`                                   | 65 findings (2 critical) in the dependency tree; pre-existing, not caused by this stage     |
| `APP_INITIALIZER` → `provideAppInitializer()` | Still open from stage 05. Used in `app.module.ts` (`initAuth`)                              |
| Unused standalone imports                     | Still open from stage 05: `AsyncPipe` in `HomeComponent` and `ProfileComponent` (TS-998113) |
