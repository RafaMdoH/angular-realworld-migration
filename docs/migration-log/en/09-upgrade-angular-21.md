# 09 — Upgrade Angular 20.3 → 21.2

> Decision record: diagnosis, what `ng update` changed (with the concept behind the change-detection provider added to `main.ts`), how the safety net was checked, findings, metrics, and comparison with the maintainers' migration.

**Branch:** `feature/upgrade-angular-21` · **Commits:** `0ca3bc5` (Angular 21), `9e50562` (rx-angular 21)

---

## 1. Diagnosis before upgrading

| Question                               | How it was answered                                       | Result                                                                                                                                                         |
| -------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is my Node still valid?                | `engines` of Angular 21.2                                 | `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0` → Node 22.23.4 ✅                                                                                                       |
| Which TypeScript?                      | Compiler `peerDependencies`                               | `>=5.9 <6.1` → current 5.8.3 ❌, bump to 5.9 required                                                                                                          |
| Which zone.js?                         | `@angular/core@21` peerDependencies                       | `~0.15.0 \|\| ~0.16.0` → current 0.15.1 ✅                                                                                                                     |
| Third parties tied to the major?       | `npm view @rx-angular/{template,cdk}@21 peerDependencies` | `cdk@21.1.1` and `template@21.2.1` → `@angular/core ^21.0.0`; `template@21.2.1` also requires `@rx-angular/cdk` exactly `21.1.1`                               |
| Which migrations will `ng update` run? | `migrations.json` of `@angular/core@21` (stage 08)        | `control-flow-migration` is mandatory; it was run on its own in stage 08, so nothing should be left to convert                                                 |
| How does the app bootstrap?            | `src/main.ts` and polyfills                               | `platformBrowserDynamic().bootstrapModule(AppModule)` with `zone.js` loaded as a polyfill: check what `bootstrap-options-migration` does with change detection |

> **Lesson:** stage 08 paid off here. The only mandatory migration that would have rewritten templates was already done, under its own safety net, so this stage only had to deal with the framework version and TypeScript.

---

## 2. What `ng update @angular/core@21 @angular/cli@21` did

```bash
npx ng update @angular/core@21 @angular/cli@21
```

| Change                 | Before  | After                      |
| ---------------------- | ------- | -------------------------- |
| `@angular/*`           | 20.3.35 | 21.2.26                    |
| `@angular/cli`         | 20.3.42 | 21.2.29                    |
| `typescript`           | 5.8.3   | 5.9.3 (set by `ng update`) |
| `zone.js`              | 0.15.1  | Unchanged                  |
| `@rx-angular/cdk`      | 20.1.1  | 21.1.1                     |
| `@rx-angular/template` | 20.1.0  | 21.2.1                     |

rx-angular was installed separately (`9e50562`), with caret ranges as before. No `EBADENGINE` and no `ERESOLVE`.

### Automatic migrations with changes

| Migration                         | Result                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **`bootstrap-options-migration`** | `src/main.ts` now passes `applicationProviders: [provideZoneChangeDetection()]` to `bootstrapModule` |
| **`update-typescript-lib`**       | `tsconfig.json`: `"lib": ["ES2022", "dom"]` removed                                                  |

### Automatic migrations with no changes

| Migration                              | Result                                                  |
| -------------------------------------- | ------------------------------------------------------- |
| `control-flow-migration`               | Already done in stage 08: no structural directives left |
| `remove-default-karma-config`          | No changes                                              |
| `update-module-resolution`             | No changes                                              |
| `add-bootstrap-context-to-server-main` | No changes                                              |
| `application-config-core`              | No changes                                              |
| `router-last-successful-navigation`    | No changes                                              |

### Optional migrations not run

| Migration                   | Reason                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `use-application-builder`   | Would switch the builder package to `@angular/build`; still deferred to its own change |
| `router-current-navigation` | Optional; not run in this stage                                                        |

---

## 3. Zoneless by default, and why the migration added `provideZoneChangeDetection()`

**What changes in v21:** zoneless change detection becomes the default. An application that relies on zone.js to trigger change detection no longer gets it implicitly; it has to opt in explicitly.

**What this app relies on:** it bootstraps an `NgModule` with `bootstrapModule(AppModule)` and loads `zone.js` as a polyfill. Its change detection has always been driven by zone.js.

**What the migration does:** it adds the zone-based change-detection provider to the bootstrap call, so the app keeps running on zone.js exactly as before. Behavior is unchanged.

```diff
// src/main.ts (0ca3bc5)
+import { provideZoneChangeDetection } from "@angular/core";
 import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

 import { AppModule } from "./app/app.module";

 platformBrowserDynamic()
-  .bootstrapModule(AppModule)
+  .bootstrapModule(AppModule, {
+    applicationProviders: [provideZoneChangeDetection()],
+  })
   .catch((err) => console.error(err));
```

**What it does not do:** it does not make the app zoneless. Removing zone.js is a modernization with its own risks and verification, so it goes in a separate change (see follow-ups).

### `lib` removed from `tsconfig.json`

```diff
// tsconfig.json (0ca3bc5)
-    "useDefineForClassFields": false,
-    "lib": ["ES2022", "dom"]
+    "useDefineForClassFields": false
```

With `target: ES2022`, the default `lib` is the same as the explicit value that was removed, so type checking sees the same set of APIs.

> **Lesson:** when a framework changes a default, the official migration preserves the old behavior explicitly instead of switching the app silently. The new default becomes visible in the diff as one line, and adopting it is left as a deliberate, separate decision.

---

## 4. How the safety net was checked

| Check                                            | Result                                      |
| ------------------------------------------------ | ------------------------------------------- |
| Spec files touched by the upgrade                | None                                        |
| Full suite                                       | 120/120 ✅                                  |
| Coverage (statements / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65%, same as v20 |
| Compiler warnings                                | None                                        |

This is the first major upgrade that runs with the template specs added in stage 08, so every template is now rendered by at least one spec while the framework changes underneath.

> **Lesson:** the only production-code changes are the two official migrations, and the specs are the same ones that passed on v20, assertions included. The green result says the version change, including the explicit zone.js opt-in, is invisible to the behavior they lock.

---

## 5. Findings

### a) The mandatory control-flow migration had nothing to do

- **Observation:** `control-flow-migration` runs as mandatory in v21 and reported no changes.
- **Why:** all 27 structural directives in 10 templates were converted in stage 08, with characterization specs written first.
- **Effect:** the v21 diff stays about the framework version and TypeScript; no template was rewritten in this stage.

> **Lesson:** reading the target version's migration list before upgrading turned a forced, mixed change into an earlier, isolated one. When the upgrade arrived, the forced migration was a no-op.

### b) rx-angular template pins cdk to an exact version

- **Observation:** `@rx-angular/template@21.2.1` requires `@rx-angular/cdk` exactly `21.1.1`, while `package.json` declares `^21.1.1`.
- **Risk:** if a cdk 21.1.x newer than 21.1.1 is published, a future `npm install` could resolve it and conflict with template's exact peer.
- **Current protection:** the lockfile pins 21.1.1, so `npm ci` (used by CI) is not affected.
- **Decision:** follow-up: pin cdk to exactly `21.1.1`, or wait for a template release with a matching peer.

### c) Initial bundle grows by +8.50 kB raw / +1.57 kB transfer

- **Observation:** initial total goes from 337.58 kB to 346.08 kB raw (96.02 → 97.59 kB transfer).
- **Where:** almost entirely in the shared framework chunk (291.21 → 299.67 kB); `main` changes by 0.04 kB and `polyfills` is unchanged.
- **Cause:** not investigated. It is not attributed to any specific feature.

---

## 6. Metrics: v20 vs v21

**Method:** same as previous stages (production build, 3 runs). The v20 baseline is stage 08's final measurement (Angular 20.3 + built-in control flow).

| Metric                                      | v20                            | v21                            | Change              |
| ------------------------------------------- | ------------------------------ | ------------------------------ | ------------------- |
| Tests                                       | 120/120                        | 120/120                        | Unchanged           |
| Coverage (stmts / branches / funcs / lines) | 76.92% / 74% / 68.29% / 75.65% | 76.92% / 74% / 68.29% / 75.65% | Unchanged           |
| Production build (3 runs)                   | 2.4 / 1.7 / 1.7 s              | 2.3 / 2.3 / 2.3 s              | No conclusion drawn |
| Initial bundle (raw)                        | 337.58 kB                      | 346.08 kB                      | +8.50 kB            |
| Initial bundle (transfer)                   | 96.02 kB                       | 97.59 kB                       | +1.57 kB            |
| `main`                                      | 8.47 kB                        | 8.51 kB                        | +0.04 kB            |
| Shared framework chunk                      | 291.21 kB                      | 299.67 kB                      | +8.46 kB            |
| `polyfills`                                 | 34.59 kB                       | 34.59 kB                       | Unchanged           |

> **Honesty about the numbers:** build times vary between runs and are not used as evidence (the first build after `ng update` took 2.6 s). The bundle growth is real but small, sits in the shared framework chunk, and its cause was not investigated.

---

## 7. Comparison with the "answer key" (upstream [`33bf8c3`](https://github.com/gothinkster/angular-realworld-example-app/commit/33bf8c3))

Upstream's v21 commit ("chore: upgrade to Angular 21 and latest dependencies") changed only `package.json` and the lockfile. The architectural differences below were already in upstream's app before that commit.

|                  | Maintainers (`33bf8c3`)                                           | This migration                                                 |
| ---------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| Angular          | 21.1.1                                                            | 21.2.26                                                        |
| TypeScript       | ~5.9.3                                                            | 5.9.3 (same)                                                   |
| rx-angular       | 21.0.0 (peers match this time)                                    | `cdk@21.1.1`, `template@21.2.1`                                |
| zone.js          | ~0.16.0                                                           | 0.15.1                                                         |
| Builder package  | `@angular/build` 21.1.1                                           | `@angular-devkit/build-angular`                                |
| Test runner      | Vitest (`"test": "vitest"`)                                       | Karma + Jasmine                                                |
| Bootstrap        | `bootstrapApplication` + `app.config.ts`, `provideAppInitializer` | `bootstrapModule(AppModule)`, `APP_INITIALIZER`                |
| Change detection | No `provideZoneChangeDetection` in `app.config.ts`                | `provideZoneChangeDetection()` added by the official migration |

> **Lesson:** on dependency versions the two projects now agree closely, including matching rx-angular peers. Architecturally they have diverged: upstream adopted standalone bootstrap, a new builder, and Vitest along the way, while this migration keeps those as separate, documented modernization changes. Comparing only the v21 commits would hide that difference.

---

## 8. Follow-ups

| Topic                                                              | Detail                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Zoneless change detection                                          | v21 default; this app opts into zone.js via `provideZoneChangeDetection()` |
| Karma → Vitest                                                     | Upstream already uses Vitest                                               |
| Builder package `@angular-devkit/build-angular` → `@angular/build` | Still open from stage 07 (`use-application-builder`)                       |
| `APP_INITIALIZER` → `provideAppInitializer()`                      | Still open from stage 05                                                   |
| Pin `@rx-angular/cdk` to exactly `21.1.1`                          | Or wait for a template release with a matching peer (finding b)            |
| Node 24                                                            | Still open from stage 07                                                   |
