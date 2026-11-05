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
- [ ] T2 Subscription audit (11 components + `ShowAuthedDirective`)
- [ ] T3 Zoneless regression specs (RED on current code)
- [ ] T4 Selective `markForCheck()` (GREEN)
- [ ] T5 App switch: zoneless provider, remove zone.js (polyfills, dependency)
- [ ] T6 Verify: full suite under zoneless, build, bundle (`polyfills`), `ng serve` smoke
- [ ] T7 Migration log `docs/migration-log/{es,en}/15-*.md` (with ADR), README, `PROJECT_CONTEXT.md`
- [ ] T8 Merge `--no-ff` + tag (with user approval); CI green on GitHub

## Acceptance criteria

- Every RED regression spec turns GREEN only after its fix; full suite green with zone.js removed; `ng build` green with no `zone.js` in the output; no template changes.

## Checks

- `npx ng test --watch=false --coverage`
- `npx ng build`

## Progress

- Carried over from stage 14: T7 done (merged `c1cc12f`, tag `v22-vitest`, CI green: 19 files, 122/122). Finding: CI coverage 80.32 / 71.18 / 68.48 / 78.53 vs local 80.55 / 71.18 / 68.48 / 78.78; the only per-file difference (clover) is `markdown.pipe.ts` (3/3 statements local, 2/3 CI): `transform` awaits `import("marked")` and no spec awaits the pipe, so whether line 10 runs before teardown depends on timing. Follow-up: a spec that awaits `MarkdownPipe.transform`.
- T1 (inline): component inventory above; API tags read from `node_modules/@angular/core/types/core.d.ts`.

## Next step

T2 (read-only explorer).
