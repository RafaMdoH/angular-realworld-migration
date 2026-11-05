# 03 — Builder webpack → esbuild `application` (Angular 17.3)

> Decision record: concept, diagnosis, metrics, real failures, and comparison with the maintainers' migration.

**Branch:** `feature/esbuild-application-builder` · **Commits:** `2fab99f` (migration), `9d978af` (`tsconfig.json` cleanup)

---

## 1. Concept (recap)

- **In one sentence:** the _builder_ is the tool that turns TypeScript, templates, and styles into the files the browser downloads; changing it changes build speed and output shape, not the app's logic.
- **Common misconception:** _"I upgraded to v17, so I'm on esbuild."_ **No.** `ng update` to v17 leaves `angular.json` pointing at webpack (`browser`). Switching builders is an optional, separate migration.
- **Why webpack was slow and fragile here:** it is written in JavaScript and does much of its work on a single thread; its real fragility is accumulated configuration (plugins, builder-specific options such as `buildOptimizer` or `vendorChunk`) that few people understand.
- **Why esbuild + Vite is better:** esbuild is written in Go and compiles in parallel; Vite speeds up `ng serve`; `application` is a single builder for browser and SSR, with fewer builder-specific options.
- **When NOT to do it (yet):** if the project relies on custom webpack plugins or config (`@angular-builders/custom-webpack`, custom loaders), because esbuild does not support them. In that case, use `browser-esbuild` or stay on webpack until they are replaced.

---

## 2. Diagnosis before migrating

| Question                               | How it was answered                                   | Result                                                 |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| Does my Node still work?               | `.nvmrc` and requirements already checked in stage 02 | Node 18.20.8 ✅ (unchanged)                            |
| Does the Angular version change?       | `package.json`                                        | No: 17.3.12 (one concept per PR)                       |
| Is there custom webpack config?        | Review of `angular.json`                              | None ✅                                                |
| Does any deploy depend on output path? | Search in the repo                                    | None; only the `_redirects` asset (Netlify convention) |
| Is what I'm touching covered?          | Existing tests                                        | Karma is unaffected: it still uses webpack in v17      |
| Clean working tree?                    | Required by `ng update`                               | The task doc was committed before migrating            |

---

## 3. Metrics: before (T1) vs after (T3)

**Method:** Node 18, cold cache (`dist/` and `.angular/cache` removed before each run), 3 runs, wall time measured with `/usr/bin/time`.

| Metric                    | webpack (`browser`) | esbuild (`application`) | Change                      |
| ------------------------- | ------------------- | ----------------------- | --------------------------- |
| Production build (wall)   | 6.4 s               | 3.2 s                   | ≈ −50%                      |
| Development build (wall)  | 4.85 s              | 2.44 s                  | ≈ −50%                      |
| Initial bundle (raw)      | 332.17 kB           | 318.19 kB               | −14 kB                      |
| Initial bundle (transfer) | 92.64 kB            | 89.36 kB                | −3.28 kB                    |
| `main`                    | 295.29 kB           | 8.53 kB                 | See note                    |
| Tests                     | 72/72               | 72/72                   | Unchanged                   |
| Statement coverage        | 57.41%              | 57.41%                  | Unchanged (Karma = webpack) |

**Note on `main`:** the code did not disappear. esbuild splits shared code into `chunk-*.js` files that are also initial; that is why the initial total barely changes even though `main` is much smaller.

> **Honesty about the numbers:** the app is small, so the absolute gain is **seconds**. What scales is the **percentage**: on a project with multi-minute builds, −50% does change how the team works and what CI costs.

---

## 4. What the migration changed and why

```diff
// angular.json
- "builder": "@angular-devkit/build-angular:browser",
+ "builder": "@angular-devkit/build-angular:application",
- "outputPath": "dist/angular-conduit",
+ "outputPath": { "base": "dist/angular-conduit" },
- "main": "src/main.ts",
+ "browser": "src/main.ts"
  // development configuration
- "buildOptimizer": false,
- "vendorChunk": true,
```

```diff
// tsconfig.json
+ "esModuleInterop": true,
- "downlevelIteration": true,
```

| Change                              | Why it exists                                                                                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser` → `application`           | The new builder, the same one `ng new` uses since v17, for browser and SSR.                                                                                                                               |
| `main` → `browser`                  | `application` can have several entry points (`browser`, `server`); the name says which environment it targets.                                                                                            |
| `outputPath` → `{ base }`           | Output is split into subfolders (`browser/`, plus `server/` with SSR) under `base`.                                                                                                                       |
| No `buildOptimizer` / `vendorChunk` | They were webpack-only options; esbuild optimizes and splits chunks on its own.                                                                                                                           |
| `+esModuleInterop`                  | esbuild handles default imports from CommonJS modules the way modern bundlers do; this flag makes `tsc` type-check with the same semantics (our reading: the migration code sets it without stating why). |
| `-downlevelIteration`               | Only matters when compiling to ES5/ES3; with `target: ES2022` it had no effect.                                                                                                                           |

**Output:** now in `dist/angular-conduit/browser/` (with `index.html` and `_redirects` side by side). The alternative `outputPath.browser: ""` keeps the old layout; **we kept the default** because there is no deploy pipeline in the repo that depends on the path.

---

## 5. Real failures found

### 5a. `ng update` installed a CLI 22 that requires Node 22

| Step      | Detail                                                                                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Symptom   | `ng update @angular/cli --name use-application-builder` installed a temporary CLI 22.2.5 that requires Node >=22, and aborted.                                                          |
| Cause     | `ng update`'s version check always runs the **latest** CLI.                                                                                                                             |
| Attempt   | Pinning `@angular/cli@17.3.17` failed with _"Package is not installed"_: with `--name` the command is migrate-only, and the specifier is treated as part of the package name.           |
| Fix       | `NG_DISABLE_VERSION_CHECK=true npx ng update @angular/cli --name use-application-builder`                                                                                               |
| How found | The CLI itself sets that variable when it spawns its temporary binary (`node_modules/@angular/cli/src/commands/update/cli.js`).                                                         |
| Lesson    | The migration ships in `@schematics/angular` 17.3.17 but is registered as optional for **18.0.0**: it only shows up on its own when updating to v18. On v17 you must invoke it by name. |

### 5b. esbuild surfaced a warning webpack hid

- **Symptom:** a warning about a stray root-level `"useDefineForClassFields"` in `tsconfig.json`.
- **Cause:** a duplicate of the entry already inside `compilerOptions`; `tsc` had ignored it since the v15 baseline (upstream removed it later).
- **Fix:** removed in a separate commit (`9d978af`); 0 warnings in build and serve afterwards.
- **Lesson:** stricter tooling exposes **latent configuration debt**. It is fixed separately so the history distinguishes "migration" from "cleanup".

---

## 6. Comparison with the "answer key" (upstream `00a5b80`)

The maintainers (Angular 17.0.7) changed a single line: `browser` → `browser-esbuild`.

|                          | `browser-esbuild` (upstream) | `application` (this migration)       |
| ------------------------ | ---------------------------- | ------------------------------------ |
| Change in `angular.json` | One line                     | Several options (official migration) |
| Output layout            | Same as webpack              | `browser/` subfolder                 |
| Entry point              | Keeps `main`                 | `browser`                            |
| Vite in `ng serve`       | Yes                          | Yes                                  |
| Unified SSR              | No                           | Yes                                  |
| Going forward            | Transitional                 | Default builder for new projects     |

**Why we chose `application`:** it is the end state (what new projects and SSR use); doing it now avoids a second builder migration. Its cost, the `browser/` folder, affects nothing in this repo.

---

## 7. Verification commands

```bash
rm -rf dist .angular/cache && /usr/bin/time npx ng build                              # 3 runs
rm -rf dist .angular/cache && /usr/bin/time npx ng build --configuration development  # 3 runs
npx ng test --watch=false --browsers=ChromeHeadless --code-coverage                   # 72/72, 57.41%
ls dist/angular-conduit/browser                                                        # index.html + _redirects
npx ng serve                                                                           # smoke: index.html with <app-root>, main.js 200
```
