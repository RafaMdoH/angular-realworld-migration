# 10 — Builder package: `@angular-devkit/build-angular` → `@angular/build` (Angular 21.2)

> Decision record: why the builder package changes before Angular 22, the difference between a builder and the package that provides it, what changed, how it was verified, and what upstream did.

**Branch:** `feature/angular-build-package` · **Commit:** `8a1f5ff`

---

## 1. Why

| Reason                                    | Detail                                                                                                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stage 03 changed the builder, not the box | Since stage 03 the app is built by the esbuild `application` builder, but it was still loaded from `@angular-devkit/build-angular`                                                            |
| The old package carries webpack           | `@angular-devkit/build-angular` also ships the webpack-based builders and their dependencies, even when none of them is used                                                                  |
| Deprecated in Angular 22                  | `npm view @angular-devkit/build-angular@latest deprecated` (22.2.6): "Angular's Webpack support is deprecated. Use the esbuild and Vite-based "@angular/build" package instead."              |
| One concept per change                    | `@angular/build` provides the same builders (`application`, `dev-server`, `extract-i18n`, `karma`) without webpack. Switching on Angular 21 keeps the Angular 22 stage a pure version upgrade |

---

## 2. Concept: builder vs package

- **In one sentence:** `angular.json` names each builder as `<package>:<builder>`; the part before the colon says where the code is loaded from, the part after it says which builder runs.
- **What stage 03 changed:** the part after the colon, `browser` → `application` (webpack → esbuild).
- **What this stage changes:** the part before the colon, `@angular-devkit/build-angular` → `@angular/build`. The same `application` builder is now loaded from a package that does not include webpack.
- **Consequence:** nothing about how the app is compiled changes, which is why the build output is identical: all seven output files keep the same content hash in their names as in stage 09 (`main-U5C3E52R.js`, `polyfills-5CFQRCPP.js`, `chunk-WTYHNFYV.js`, …). The difference shows up in what `npm ci` installs.

---

## 3. What changed

Command: `ng update @angular/cli --name use-application-builder` (the official optional migration).

| Target (`angular.json`) | Before                                       | After                         |
| ----------------------- | -------------------------------------------- | ----------------------------- |
| `build`                 | `@angular-devkit/build-angular:application`  | `@angular/build:application`  |
| `serve`                 | `@angular-devkit/build-angular:dev-server`   | `@angular/build:dev-server`   |
| `extract-i18n`          | `@angular-devkit/build-angular:extract-i18n` | `@angular/build:extract-i18n` |
| `test`                  | `@angular-devkit/build-angular:karma`        | `@angular/build:karma`        |

`package.json` dev dependency: `@angular-devkit/build-angular ^21.2.29` → `@angular/build ^21.2.29`. No other files changed; no `src/` or spec changes.

---

## 4. Verification and metrics

**Method:** clean `npm ci`, then the same checks as previous stages (tests with coverage, production build 3 runs, dev server). The baseline is stage 09's final measurement.

| Metric                                      | `@angular-devkit/build-angular` | `@angular/build`               | Change         |
| ------------------------------------------- | ------------------------------- | ------------------------------ | -------------- |
| Installed packages (`npm ci`)               | 1093                            | 710                            | −35%           |
| `node_modules` size                         | 511 MB                          | 381 MB                         | −130 MB        |
| `webpack` installed                         | Yes                             | No                             | Removed        |
| Tests                                       | 120/120                         | 120/120                        | Unchanged      |
| Coverage (stmts / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65%  | 76.92% / 74% / 68.29% / 75.65% | Unchanged      |
| Production build (3 runs)                   | 2.3 / 2.3 / 2.3 s               | 2.5 / 2.3 / 2.4 s              | Within noise   |
| Initial bundle (raw / transfer)             | 346.08 kB / 97.59 kB            | 346.08 kB / 97.59 kB           | Identical      |
| `ng serve`                                  | —                               | Serves `index.html` (HTTP 200) | Starts         |
| `npm audit` findings                        | 40                              | 35                             | Moderate 27→22 |

No compiler warnings. High findings in `npm audit` stay at 12; there are no critical findings. The "65 findings (2 critical)" recorded in stage 06 had already dropped to 40 through the Angular upgrades.

> **Lesson:** the biggest gain of this stage is in the install tree, not the bundle. The app is compiled by the same builder, so the output does not change; what changes is that a third of the installed packages, webpack among them, are no longer downloaded.

---

## 5. Upstream

Upstream already uses `@angular/build`: it switched in its Angular 20 commit [`a420aa2`](https://github.com/gothinkster/angular-realworld-example-app/commit/a420aa2), together with the version upgrade. This migration kept the two as separate changes.

---

## 6. Follow-ups

| Topic                                         | Detail                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Angular 21 → 22 + TypeScript 6.0              | Next stage, now a pure version upgrade                                      |
| `APP_INITIALIZER` → `provideAppInitializer()` | Still open; planned together with Node 24                                   |
| Karma → Vitest                                | Separate change; the `karma` builder is still available in `@angular/build` |
| Zoneless change detection                     | Separate modernization change                                               |
