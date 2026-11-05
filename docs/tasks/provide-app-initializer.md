# Feature: provide-app-initializer

## Objective

Replace the deprecated `APP_INITIALIZER` token with `provideAppInitializer()` on Angular 22.2, without changing startup behavior.

## Problem / Why

Twelfth stage. `APP_INITIALIZER` has been deprecated since Angular 19. `provideAppInitializer()` takes a plain function that runs in an injection context, so dependencies come from `inject()` instead of a `deps` array. The optional `provide-initializer` migration only existed in the v19 update; `@angular/core@22` has no schematic for it, so the change is manual.

## Scope

- `src/app/app.module.ts`: `{ provide: APP_INITIALIZER, useFactory: initAuth, deps: [JwtService, UserService], multi: true }` → `provideAppInitializer(() => initAuth(inject(JwtService), inject(UserService))())`.
- Keep `initAuth` exported and unchanged (its characterization spec stays as is).
- Out of scope: moving `AppModule` to `bootstrapApplication`, Node 24 (next stage), other follow-ups.

## Constraints

- Safety-net gap: `app.module.spec.ts` tested `initAuth` in isolation, but nothing proved that it is registered and runs at app startup — exactly what this change rewires.

## Checklist

- [x] T1 Diagnosis: current wiring, available schematics, safety-net gap
- [x] T2 Wiring spec (integration) + mutation check on the old wiring
- [x] T3 Refactor to `provideAppInitializer()` + mutation check on the new wiring
- [ ] T4 Migration log `docs/migration-log/{es,en}/12-*.md`, README, `PROJECT_CONTEXT.md`
- [ ] T5 Merge `--no-ff` + tag (with user approval); CI green on GitHub

## Acceptance criteria

- The new wiring spec passes before and after the refactor and fails when the initializer is removed in either version; full suite green; no `APP_INITIALIZER` left in `src/`.

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Progress

- Note: this feature document was created after T3, not before the first write as in earlier stages; the evidence below was recorded during the work.
- T1 (inline): `@angular/core@22` schematics: no `provide-initializer` (list: `cleanup-unused-imports`, `control-flow-migration`, `inject-migration`, `output-migration`, `route-lazy-loading`, `self-closing-tags-migration`, `signal-input-migration`, `signal-queries-migration`, `standalone-migration`, and others). `app.module.spec.ts` covered `initAuth` (3 specs) but not its registration.
- T2 (`054cc02`): 2 integration specs in `app.module.spec.ts` ("AppModule app initializer wiring"): `TestBed` imports `AppModule` with `JwtService` / `UserService` spies and awaits `ApplicationInitStatus.donePromise`; with a token the current user is loaded once, without a token the API is not called. Green on the old wiring (122/122). Mutation: removing the `APP_INITIALIZER` provider made the suite fail; file restored.
- T3 (`57ee61b`): `provideAppInitializer(() => initAuth(inject(JwtService), inject(UserService))())`; `APP_INITIALIZER` import removed; 0 occurrences left in `src/`. 122/122 green; coverage 76.98 / 74 / 68.48 / 75.72 (was 76.92 / 74 / 68.29 / 75.65 with 120 specs). No compiler warnings. Initial total 357.58 kB raw / 99.59 kB transfer (v22 stage: 357.60 / 99.56). Mutation: removing the `provideAppInitializer(...)` call made both wiring specs fail (`TOTAL: 2 FAILED`); file restored.

## Next step

T4 docs.
