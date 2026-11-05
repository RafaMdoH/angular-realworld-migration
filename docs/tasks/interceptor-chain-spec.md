# Feature: interceptor-chain-spec

## Objective

Add an integration spec that boots the real `AppModule` provider graph and proves the HTTP interceptor chain (Api → Token → Error) still applies to real requests.

## Problem / Why

Follow-up from the stage 04 independent AI review: interceptor chain coverage. Each interceptor spec registers only its own interceptor, and `app.module.spec.ts` covers only `initAuth`. Nothing fails if `AppModule` drops an interceptor, reorders it, or loses `withInterceptorsFromDi()` (the v18 migration rewrote exactly that wiring). This net must exist before the 18 → 19 upgrade touches it again.

## Scope

- New `src/app/app.module.interceptors.spec.ts`: `TestBed` imports `AppModule` + `provideHttpClientTesting()`.
- Out of scope: production code changes; fixing locked bugs (#3 absolute URL prefix, #4 null error body) — they stay locked in the unit specs.

## Constraints

- Characterization: assert current behavior, no production edits.
- Test-first exception: behavior already exists, so RED is shown by mutation (temporarily removing wiring in `AppModule`, then reverting).

## Checklist

- [x] T1 Write integration spec (URL prefix, `Authorization` header with/without token, error body unwrapped, registration order)
- [x] T2 Mutation check: remove `withInterceptorsFromDi()` and one interceptor in `AppModule` → spec fails; revert → green
- [x] T3 Docs: interceptor chain coverage closure note in `docs/migration-log/{es,en}/04-*.md`, `PROJECT_CONTEXT.md`

## Acceptance criteria

- New spec green; total specs 72 + new; mutations detected; no production diff.

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`

## Progress

- Branch `feature/interceptor-chain-spec` from `main-v15` @ `bf3bd96`.

- T1 (`8b57920`): `src/app/app.module.interceptors.spec.ts`, 4 specs (registration order, URL prefix + `Token` header, no header without token, error body unwrapped). `TestBed` imports the real `AppModule` + `provideHttpClientTesting()`. Suite 76/76, statements 57.41% (unchanged: `AppModule` lines were already counted).
- T2 mutation check (each reverted with `git checkout`, no production diff): no `withInterceptorsFromDi()` → 3 failures; `TokenInterceptor` removed → 2; `ApiInterceptor` moved last → 1. All failures in the new spec only; the 72 existing specs stayed green in every mutation, confirming the gap.
- T3: section 8 (originally appended as section 9, renumbered in the public docs cleanup) added to `docs/migration-log/{es,en}/04-*.md`; `PROJECT_CONTEXT.md` updated.

## Next step

Feature complete. Merged into `main-v15` as `758f757` (no tag: test-only PR); build + 76/76 tests re-verified on `main-v15`.
