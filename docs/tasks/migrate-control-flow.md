# Feature: migrate-control-flow

## Objective

Convert structural directives (`*ngIf`, `*ngFor`) to built-in control flow (`@if`, `@for`) on Angular 20.3, protected by characterization tests, before the Angular 20 → 21 upgrade.

## Problem / Why

Eighth stage. Angular 21's `ng update` runs `control-flow-migration` as a **mandatory** migration (no `optional` flag in `@angular/core@21` `migrations.json`). Running it inside the upgrade would mix a framework version change with 10 rewritten templates in one diff. Running it first, on Angular 20, keeps one concept per change: the v21 migration then has nothing left to convert.

The safety net does not cover most of the affected templates: only 3 of the 10 have a component spec that renders them (auth, editor, home).

## Scope

- Characterization specs for the 7 uncovered templates, locking the current rendering of every `*ngIf` / `*ngFor` branch: header, article, article-comment, profile, article-list, article-preview, list-errors.
- Run the official migration on Angular 20: `ng generate @angular/core:control-flow`.
- Out of scope: Angular 21 (next stage), signal or zoneless refactors, fixing locked bugs, `NgIf` / `NgForOf` import cleanup beyond what the migration does.

## Constraints

- Characterization, not correction: specs lock current behavior, including bugs (`KNOWN BUG (locked)`).
- Every new spec must be proven to fail when the guarded template branch is broken (mutation check), then restored.
- No production code changes before the migration step.
- `article.component.html:132` uses `*ngFor ... trackBy: trackById`; the `@for` `track` expression is mandatory, so this conversion needs explicit review.

## Checklist

- [x] T1 Diagnosis: Angular 21 migration list, affected templates, safety-net gaps
- [x] T2 Characterization specs for the 7 uncovered templates + mutation checks
- [ ] T3 Run `control-flow` migration; review diff per template (`track` expressions, `as` / `else` aliases)
- [ ] T4 Verify: same specs green with unchanged assertions, build, bundle metrics
- [ ] T5 Migration log `docs/migration-log/{es,en}/08-*.md`, README, `PROJECT_CONTEXT.md`
- [ ] T6 Merge `--no-ff` + tag (with user approval); CI green on GitHub

## Acceptance criteria

- All specs (existing 76 + new) green before and after the migration with identical assertions; no `*ngIf` / `*ngFor` left in `src/`; `ng build` green.

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`
- `grep -rnE '\*ng(If|For|Switch)' src` → no matches after T3

## Progress

- T1 (inline): Angular 21.2 requires TypeScript `>=5.9 <6.1`, Node `^20.19.0 || ^22.12.0 || >=24.0.0` (CLI supports 20/22/24), zone.js `~0.15.0 || ~0.16.0`. v21 migrations: `control-flow-migration` (mandatory), `router-last-successful-navigation`, `application-config-core`, `bootstrap-options-migration`, `add-bootstrap-context-to-server-main`, `update-typescript-lib`, `update-module-resolution`, `remove-default-karma-config`; optional: `router-current-navigation`, `use-application-builder`. Structural directives: 27 occurrences in 10 templates (auth 3, header 2, article-comment 2, article 7, editor 1, home 1, profile 3, article-list 5, article-preview 1, list-errors 2). Template-rendering specs exist only for auth, editor, home. Upstream `33bf8c3` (Angular 21) touched only `package.json` and the lockfile. Decisions (user): control flow as its own stage before v21; characterization specs first for the 7 uncovered templates.
- T2 (delegated writer; trigger: 7 non-trivial new files): 44 specs in 7 files (header 5, article 12, article-comment 7, profile 5, article-list 7, article-preview 4, list-errors 4). Every `*ngIf` / `*ngFor` branch of the 7 templates is locked through the DOM, including `as` aliases. Comments `trackBy: trackById`: DOM element identity is kept when the list is replaced by new objects with the same ids, and on reorder. KNOWN BUG (locked), 2 specs: `ListErrorsComponent` always renders an empty `ul.error-messages` (`errorList` is always an array, `[]` is truthy). 21 mutations (template branches inverted/removed/sliced, `trackBy` removed), each made the expected specs fail; templates restored (`git diff -- '*.html'` empty). Suite 120/120; coverage 76.92 / 74 / 68.29 / 75.65 (template branches are not counted in Branches). Not covered: `article-list` `RangeError` when `limit` is unset (component code, not template), `catchError` navigation paths in article/profile (no template branch).

## Next step

T3 migration.
