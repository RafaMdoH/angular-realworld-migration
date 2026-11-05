# Feature: upgrade-angular-18

## Objective

Upgrade from Angular 17.3 to Angular 18.2 (one major) with build and characterization tests green.

## Problem / Why

Third major step, after the builder modernization (stage 03). Upgrade only: new v18 APIs (zoneless, `@let`, fallback content, etc.) are modernization and go in separate features.

## Scope

- `@angular/*` 17.3 → 18.2 via `ng update` (including automatic migrations).
- `@rx-angular/cdk` 17.1 → 18.0.0, `@rx-angular/template` 17.3 → 18.0.3 (peer `@angular/core ^18`).
- Out of scope: zoneless, new template syntax, Karma → other runner, locked bug fixes, dead external deps.

## Constraints

- Angular 18.2.14 requires Node ^18.19.1 || ^20.11.1 || >=22 → Node 18.20.8 OK; TypeScript >=5.4 <5.6 (current 5.4 OK); zone.js ~0.14.10 (current OK).
- Node 18: every `ng update` needs `NG_DISABLE_VERSION_CHECK=true` (see stage 03).
- Risk: the v18 HTTP providers migration rewrites specs using `HttpClientTestingModule` — the safety net itself changes, so its diff must be reviewed line by line.

## Checklist

- [x] T1 Diagnosis: compatibility matrix + third-party peers
- [x] T2 `ng update @angular/core@18 @angular/cli@18` + review automatic migrations
- [x] T3 `@rx-angular/cdk@18.0.0` + `@rx-angular/template@18.0.3`
- [x] T4 Verify: tests, build, metrics, serve smoke; compare with upstream `932dff0`
- [x] T5 Migration log `docs/migration-log/{es,en}/04-*.md`
- [x] T6 Update `PROJECT_CONTEXT.md`; merge `--no-ff` + tag (with user approval)

## Acceptance criteria

- 72/72 specs green with the same assertions; `ng build` green; only official-migration changes in production and test code (documented).

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- Branch `feature/upgrade-angular-18` from `main-v15` @ `37fc041`.
- T1: matrix above; peers `@rx-angular/template@18.0.3` → `@angular/core ^18`, `@rx-angular/cdk ^18`; `@rx-angular/cdk@18.0.0` → `@angular/core ^18`. Specs using `HttpClientTestingModule`: home, user.service, token/error/api interceptors (+ `RouterTestingModule` in auth). Upstream `932dff0`: Angular 18.0.0, TS 5.4.5.

- T2 (`6eaa247`): `NG_DISABLE_VERSION_CHECK=true npx ng update @angular/core@18 @angular/cli@18` → Angular 18.2.14, CLI/build-angular 18.2.21; TypeScript left at 5.4 (within `>=5.4 <5.6`). Migrations: two-way binding (no changes), afterRender phase (no changes), BootstrapContext (no changes), **HTTP providers** (10 files): `app.module.ts` `HttpClientModule` → `provideHttpClient(withInterceptorsFromDi())` (equivalent: keeps class interceptors from `HTTP_INTERCEPTORS`, same order); 6 specs `HttpClientTestingModule` → `provideHttpClient(withInterceptorsFromDi())` + `provideHttpClientTesting()`; 3 interceptors only reformatted (reverted by Prettier). Verified: `it`/`expect` counts unchanged in all 6 specs (34/7/6/6/46/15), no assertion line touched, and `provideHttpClient` precedes `provideHttpClientTesting` in every spec (otherwise the real backend would override the mock). 72/72, 57.41%.
- Finding: `ng update` and npm installed Angular 18 alongside rx-angular 17 (peer `@angular/core ^17.0.0`) without any error — green tests did not mean a supported combination.
- T3 (`b3a85c0`): `@rx-angular/cdk@18.0.0`, `@rx-angular/template@18.0.3` (peers `@angular/core ^18`). 72/72, 57.41%. `npm audit` reports issues — pre-existing dependency maintenance, out of scope.
- T4 metrics (Node 18, cold cache, 3 runs): production wall 3.21 / 3.27 / 3.19 s (v17 esbuild: ~3.2 s); development 2.70 / 2.72 / 2.67 s (v17: ~2.44 s); initial 335.06 kB raw / 93.72 kB transfer (v17: 318.19 / 89.36; +16.9 kB, main 8.75 kB, polyfills 34.52 kB). Serve smoke: `<app-root>`, `main.js` 200, 0 warnings.
- T4 upstream comparison (`932dff0`, Angular 18.0.0): upstream applied the optional `use-application-builder` migration inside the v18 commit (`browser-esbuild` → `application`, `outputPath.base`, `browser`, `esModuleInterop`, `-downlevelIteration`) — the exact changes of our stage 03, but mixed with the version bump. No `src/` changes upstream (already on `provideHttpClient`). Same end state; our history separates upgrade from modernization.

- Independent AI review (test reliability): approved; one non-blocking finding → interceptor chain coverage (closed by `interceptor-chain-spec.md`).
- T5: migration logs `docs/migration-log/{es,en}/04-*.md` drafted by an AI agent; re-verified independently against git (repo citations, metrics, commits).

## Next step

Feature complete. Merged into `main-v15` as `bf3bd96`, tag `v18-upgraded`; build + 72/72 tests (57.41%) re-verified on `main-v15`. Open follow-up: interceptor chain coverage (integration spec).
