# Feature: esbuild-application-builder

## Objective

Switch the build from the webpack `browser` builder to the esbuild-based `application` builder while staying on Angular 17.3, measuring build time and bundle size before and after.

## Problem / Why

First modernization step (separate from version upgrades). Changing the builder in isolation on a known-good version means any regression is attributable to the builder alone. Upstream did the same before v18 (`00a5b80`, on 17.0.7, but with the drop-in `browser-esbuild`); we target `application`, the builder new projects use since v17.

## Scope

- `angular.json` build/serve config via the official migration `ng update @angular/cli --name use-application-builder` (shipped in `@schematics/angular` 17.3.17, registered as optional for 18.0.0).
- Out of scope: Angular version changes, Karma builder (stays on webpack in v17), control flow, locked bug fixes, dead external deps.

## Constraints

- Node 18.20.8 (`.nvmrc`), Angular 17.3.12 — unchanged.
- `application` builder changes the output layout (`browser/` subfolder) unless the migration preserves it; `_redirects` asset must still land at the deploy root.

## Checklist

- [x] T1 Baseline: webpack prod build time (3 runs), initial bundle sizes, test run
- [x] T2 Run `use-application-builder` migration + review diff
- [x] T3 Verify: tests, build, output layout (`index.html`, `_redirects`), dev-server smoke; metrics after; compare with upstream `00a5b80`
- [x] T4 Migration log `docs/migration-log/{es,en}/03-*.md`
- [x] T5 Update `PROJECT_CONTEXT.md`; merge `--no-ff` + tag (with user approval)

## Acceptance criteria

- 72/72 specs green; `ng build` green; production code untouched; output layout documented; before/after metrics recorded.

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- Branch `feature/esbuild-application-builder` created from `main-v15` @ `88e07fb`.
- T1 baseline (webpack `browser`, Node 18.20.8, cold: `dist/` and `.angular/cache` removed before each run, 3 runs):
  - Production `ng build`: wall 6.36 / 6.41 / 6.44 s; Angular-reported 5.41–5.88 s.
  - Development `ng build --configuration development`: wall 4.88 / 4.83 / 4.85 s.
  - Initial bundle: 332.17 kB raw / 92.64 kB transfer (main 295.29 kB, polyfills 34.00 kB, runtime 2.88 kB); `dist/angular-conduit` 532K, `_redirects` at root.
  - Tests: 72/72 SUCCESS, statements 57.41% (209/364).
- Finding: `ng update` refuses to run on a dirty tree, so the task doc is committed before T2.
- T2 (`2fab99f`): plain `ng update @angular/cli --name use-application-builder` aborted — the CLI version check installs a temporary latest CLI (22.2.5) that requires Node >=22. `@angular/cli@17.3.17` as specifier fails too ("Package is not installed": with `--name` it is migrate-only and the specifier is treated as part of the name). Working command: `NG_DISABLE_VERSION_CHECK=true npx ng update @angular/cli --name use-application-builder`. Changes: `angular.json` (builder `application`, `main` → `browser`, `outputPath` → `{ base }`, removed webpack-only `buildOptimizer`/`vendorChunk`), `tsconfig.json` (`+esModuleInterop`, `-downlevelIteration`). Output moves to `dist/angular-conduit/browser/` — kept as the migration default (no deploy pipeline in repo; `_redirects` lands next to `index.html`).
- T3 (`9d978af`): esbuild surfaced a warning webpack hid — stray root-level `"useDefineForClassFields"` in `tsconfig.json` (duplicate of the `compilerOptions` entry, ignored by tsc since the v15 baseline, removed upstream). Removed in a separate commit; 0 warnings in build and serve afterwards.
- T3 metrics after (same method as T1):
  - Production: wall 3.33 / 3.20 / 3.20 s (≈ −50% vs 6.4 s); Angular-reported 2.59 s.
  - Development: wall 2.47 / 2.42 / 2.43 s (≈ −50% vs 4.85 s).
  - Initial bundle: 318.19 kB raw / 89.36 kB transfer (−14 kB vs 332.17 kB); `main` is now 8.53 kB because esbuild splits shared code into initial `chunk-*.js` files.
  - Tests: 72/72 SUCCESS, statements 57.41% (unchanged — Karma still uses webpack in v17).
  - Dev-server smoke: `ng serve` (Vite) serves `index.html` with `<app-root>`, `main.js` 200.
- Upstream comparison (`00a5b80`, Angular 17.0.7): one-line switch to `browser-esbuild` (drop-in, keeps output layout and `main`). We used `application`, the target builder for new projects and for SSR; the trade-off is the `browser/` output folder.

- T4: migration logs `docs/migration-log/{es,en}/03-*.md` drafted by an AI agent; re-verified independently against git (diffs, metrics), with the `esModuleInterop` rationale marked as interpretation (migration code sets it without stating why).

## Next step

Feature complete. Merged into `main-v15` as `37fc041`, tag `v17-esbuild`; build + 72/72 tests re-verified on `main-v15`.
