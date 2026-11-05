# Feature: zoneless

## Objective

Run the app without zone.js (zoneless change detection) on Angular 22.2, with every view still updating after asynchronous work, proven by zoneless-specific regression tests.

## Problem / Why

Fifteenth stage. Since Angular 21 zoneless is the default; stage 09's migration opted the app back into zone.js with `provideZoneChangeDetection()`. Without zone.js, Angular no longer runs change detection after every async callback: a view refreshes only when it is notified (template event, `AsyncPipe`, signal read in the template, `markForCheck()`, input change, view attach).

Diagnosis (inline): 11 of 18 components assign state inside `subscribe` with no notification: auth, article, editor, home, profile, profile-articles, profile-favorites, settings, article-list, favorite-button, follow-button. Already notifying: header and article-comment (`| async`), home also uses `rxLet`; footer and article-meta are `OnPush` with no subscriptions. The `ShowAuthedDirective` subscribes to shared auth state and creates or clears views.

Existing specs call `fixture.detectChanges()` manually after each change, which refreshes the view even without a notification, so they cannot detect this class of bug.

## Scope

- Audit every subscription in the 11 components and `ShowAuthedDirective`: which assigned fields the template reads, and whether another mechanism already notifies.
- Zoneless regression specs: `provideZonelessChangeDetection()` in `TestBed`, async source emits after the first render, `await fixture.whenStable()` without `detectChanges()`, assert the DOM. Expected RED on the current code.
- Fix: `ChangeDetectorRef.markForCheck()` only where the audit and the RED spec show it is needed (user decision: selective `markForCheck()`, no signals in this stage).
- Switch the app: `provideZoneChangeDetection()` → `provideZonelessChangeDetection()`; remove `zone.js` from build and test polyfills and from dependencies.
- Out of scope: signals / `toSignal()` (separate modernization stage), OnPush conversion, `Eager` review, `$safeNavigationMigration` cleanup.

## Constraints

- `provideZonelessChangeDetection()` is `@publicApi 20.2` in `@angular/core@22.2.4`. `provideCheckNoChangesConfig({ exhaustive: true })` is `@developerPreview 20.0` and does not help here (manual `detectChanges()` refreshes `Eager` views anyway), so it is not used.
- No template changes; existing spec assertions unchanged.
- Decision record (ADR) in the migration log: zoneless compatibility without a simultaneous state refactor.

## Checklist

- [x] T1 Diagnosis: inventory, API stability, test-design limitation
- [x] T2 Subscription audit (11 components + `ShowAuthedDirective`)
- [x] T3 Zoneless regression specs (RED on current code)
- [x] T4 Selective `markForCheck()` (GREEN)
- [x] T5 App switch: zoneless provider, remove zone.js (polyfills, dependency)
- [x] T6 Verify: full suite under zoneless, build, bundle (`polyfills`), `ng serve` smoke
- [x] T7 Migration log `docs/migration-log/{es,en}/15-*.md` (with ADR), README, `PROJECT_CONTEXT.md`
- [x] T8 Merge `--no-ff` + tag (with user approval); CI green on GitHub

## Acceptance criteria

- Every RED regression spec turns GREEN only after its fix; full suite green with zone.js removed; `ng build` green with no `zone.js` in the output; no template changes.

## Checks

- `npx ng test --watch=false --coverage`
- `npx ng build`

## Progress

- Carried over from stage 14: T7 done (merged `c1cc12f`, tag `v22-vitest`, CI green: 19 files, 122/122). Finding: CI coverage 80.32 / 71.18 / 68.48 / 78.53 vs local 80.55 / 71.18 / 68.48 / 78.78; the only per-file difference (clover) is `markdown.pipe.ts` (3/3 statements local, 2/3 CI): `transform` awaits `import("marked")` and no spec awaits the pipe, so whether line 10 runs before teardown depends on timing. Follow-up: a spec that awaits `MarkdownPipe.transform`.
- T1 (inline): component inventory above; API tags read from `node_modules/@angular/core/types/core.d.ts`.

- T2 (read-only explorer; trigger: 12 files + framework internals): 20 subscriptions / async continuations audited. **13 sites need `markForCheck()`**: auth `:95` (error branch), article `:81` (load), `:126` (add comment, both branches), `:143` (delete comment), editor `:60` (edit-mode load, `tagList`), `:104` (create error), profile `:52`, profile-articles `:35`, profile-favorites `:35`, settings `:77` (update error), article-list `:67`, favorite-button `:60` (error branch), follow-button `:59` (error branch).

  - Already notified: child `(toggle)` outputs (template listeners call `markViewDirty` on the child view and its ancestors, so the buttons' success branches are covered because every usage binds `(toggle)`); `ShowAuthedDirective` (`createEmbeddedView` / `clear` notify the zoneless scheduler on view attach / detach); home tags via `rxLet`; `| async` in header, article-comment and the markdown body (Promise).
  - Not template state: subscriptions that only navigate (article delete, success branches of auth / editor / settings).
  - Auth state is synchronous at first render (`currentUser` is a `BehaviorSubject`; `provideAppInitializer` resolves before bootstrap).
  - New finding (pre-existing defect, to be locked, not fixed): `settings.component.ts:57` passes the Observable returned by `getCurrentUser()` to `patchValue` (hidden by `as Partial<User>`), so the settings form is never filled and the request is never sent. Verified in code.
  - Spec gaps: no specs for profile-articles, profile-favorites, settings; buttons only indirectly.

- T3 (delegated writer; trigger: 13 new spec files): `*.zoneless.spec.ts` next to each component, `TestBed` with `provideZonelessChangeDetection()`, async sources as `Subject`s emitted after the first render, `await fixture.whenStable()`, never `detectChanges()`. Harness facts: zoneless fixtures auto-detect by default (first render needs no `detectChanges()`); an unflushed `HttpClient` request blocks `whenStable()`, so services are stubbed with `Subject`s; finishing an `HttpClient` request removes a pending task but marks no view dirty; `rxLet` rendering and an `AsyncPipe` Promise are not tracked by `whenStable()`, so those two controls poll with `vi.waitFor`; the directive control renders a binding (`{{ label }}`), not static text, so it proves a refresh.

  - Result: 143 tests, **14 RED** (all stale DOM: e.g. `expected undefined to be 'My title'`, button class still `disabled`), 5 controls GREEN (show-authed show / hide, home tags via `rxLet`, favorite success via `(toggle)`, markdown `| async`), KNOWN BUG (locked) settings form spec GREEN (new `settings.component.spec.ts`), 122 existing specs GREEN.
  - Audit refinement: the add-comment success branch (`article.component.ts:126`) passed when the user typed first, because `commentControl.reset("")` flips pristine / dirty, and those form-state classes are signal-backed, which schedules a refresh. That is incidental, so a second spec sets the value programmatically (control stays pristine): RED (`expected [ 'comment 1' ] to deeply equal [ 'new one', 'comment 1' ]`). Decision: `markForCheck()` on both branches, as the audit said.
  - Expected warning while zone.js is still loaded: `NG0914: The application is using zoneless change detection, but is still loading Zone.js`.
  - This commit intentionally contains failing specs (RED evidence); T4 turns them GREEN.

- T4 (`35e9874`, delegated writer; trigger: 10 component files): `ChangeDetectorRef` added as a constructor parameter (all 10 components use constructor injection) and `this.cdr.markForCheck()` at the 14 audited call sites (auth 1, article 4, editor 2, profile 1, profile-articles 1, profile-favorites 1, settings 1, article-list 1, favorite-button 1, follow-button 1); 10 files, +52 / −12; no template or spec change. 143/143 green. Parent mutation check: removing the `markForCheck()` in `profile.component.ts` makes exactly "renders the profile after it emits asynchronously" fail; restored.
- T5 (`990252d`): `src/main.ts` `provideZoneChangeDetection()` → `provideZonelessChangeDetection()`; `angular.json` `polyfills` removed from the build options and the `testing` configuration; `zone.js` uninstalled. With zone.js gone, `TestBed` runs zoneless for every spec, and 3 existing characterization specs failed with `NG0100 ExpressionChangedAfterItHasBeenChecked`: they write a field directly (`component.comments = ...` twice in `article.component.spec.ts`, `value.tagList = ...` in `article-preview.component.spec.ts`) and then call `fixture.detectChanges()` without notifying Angular. In the app those writes happen inside notified subscriptions or event handlers. Harness fix (test-only, assertions unchanged): `fixture.componentRef.changeDetectorRef.markForCheck()` before `fixture.detectChanges()` in those 3 specs. Checks after the fix: stage 14 mutation V2 (`track $index`) still fails 2 specs; setting the same `tagList` instead of a new one makes the preview spec fail.
  - Process note: while restoring a temporary mutation, `git checkout` on `article-preview.component.spec.ts` also reverted the uncommitted harness fix; it was reapplied and re-verified before committing.
- T6: 32 files, 143/143 green with no `NG0914` warning; coverage 87.17 / 79.66 / 77.45 / 85.82 (stage 14: 80.55 / 71.18 / 68.48 / 78.78; the increase comes from the 21 new specs). Prod build 1.6 / 1.5 / 1.5 s, no warnings. Initial total 319.70 kB raw / 87.46 kB transfer (before: 357.68 / 99.63, −37.98 kB raw / −12.17 kB transfer); no `polyfills` chunk any more; no `__Zone_` symbol anywhere in `dist/`. `ng serve` (HTTP 200) and headless Chrome `--dump-dom`: the app bootstraps zoneless (`ng-version="22.2.4"`) and renders the header (`conduit`, `Sign in`, `Sign up` via `ShowAuthedDirective`), `Global Feed` and `Popular Tags`; feed data does not load because the public API is gone (documented since stage 00).
- T7 (delegated writer; trigger: 5 documentation files): `docs/migration-log/en/15-zoneless.md` and `docs/migration-log/es/15-zoneless.md` (with ADR: zoneless compatibility without a simultaneous state refactor), `README.md` (stage 15 row, current stack), `PROJECT_CONTEXT.md` (state, tests, tags, decisions, locked finding 10, next step), this task doc.

- T8: merged into `main` with `--no-ff` (`86a71e0`) and tagged `v22-zoneless` (tag pushed); GitHub Actions CI on `86a71e0`: success (run 42100224253). Ticked during the migration closure stage.

## Next step

None: stage closed. Project closure continues in `docs/tasks/migration-closure.md`.
