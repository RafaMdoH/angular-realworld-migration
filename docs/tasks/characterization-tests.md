# Feature: characterization-tests

## Objective

Build a safety net of characterization tests over the Angular 15 baseline before any version upgrade.

## Problem / Why

The baseline (`v15-baseline`, commit e28c896) has 0 spec files. Every `ng update` step can silently change behavior; without tests, breakage is only detectable manually.

## Scope

- Lock CURRENT behavior (including suspicious behavior) — no production code changes.
- Priority by blast radius (CodeGraph): `UserService` (23 callers), interceptors (every HTTP call), route guards, `ShowAuthedDirective` (3 callers), auth + editor forms.

## Constraints

- Test runner: existing Karma + Jasmine (no tooling change before migrating).
- No network: use `HttpClientTestingModule` / `HttpTestingController`.
- Characterization tests pass on first run; validity is proven by a temporary mutation check (break code → test fails → revert), not by RED-before-code.

## Checklist

- [x] T1 Test infra runs headless with coverage (`ng test --watch=false --browsers=ChromeHeadless --code-coverage`)
- [x] T2 `JwtService` + `UserService` specs
- [x] T3 Interceptors (api, token, error) + `initAuth` APP_INITIALIZER specs
- [x] T4 Route guards (login/register/settings/editor) spec
- [x] T5 `ShowAuthedDirective` spec (incl. suspected re-show bug)
- [x] T6 `AuthComponent` + `EditorComponent` specs (incl. editor always calling `create`)
- [x] T7 Coverage baseline recorded + migration log entry `docs/migration-log/{en,es}/00-*.md`

## Acceptance criteria

- All specs green headless; coverage baseline recorded; suspicious behaviors documented as "locked, not fixed".

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`

## Suspicious behaviors found (to lock, not fix)

1. `ShowAuthedDirective`: after `viewContainer.clear()`, `authRef` is never reset → element may not reappear after logout → login.
2. `EditorComponent.submitForm()` always calls `articleService.create`, even when editing an existing slug.

## Progress

- Branch: `feature/characterization-tests`
- Spec files T2–T6 drafted by an AI agent; re-verified independently against git.
- T6 commit: c6e89f5 (22 specs)
- T5 commit: 91d7aef (6 specs)
- T4 commit: 970caf8 (11 specs)
- T3 commit: 867640a (12 specs)
- T2 commit: e1ebe04 (16 specs)

## Next step

Feature complete. Next: Angular 15 → 16 upgrade (separate feature).
