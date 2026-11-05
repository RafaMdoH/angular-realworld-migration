# 15 — Zoneless change detection (Angular 22.2)

> Decision record: why zone.js goes now, the decision to make the app zoneless-compatible without refactoring its state, the subscription audit, why the existing specs could not see the problem and how the zoneless regression specs were built, RED → GREEN evidence, the switch itself, verification, metrics, findings, and follow-ups.

**Branch:** `feature/zoneless` · **Commits:** `7faa49e` (RED specs + locked settings bug), `35e9874` (selective `markForCheck()`), `990252d` (zoneless switch, zone.js removed)

---

## 1. Why

Since Angular 21, zoneless change detection is the default. Stage 09 ([section 3](09-upgrade-angular-21.md#3-zoneless-by-default-and-why-the-migration-added-providezonechangedetection)) recorded that the official `bootstrap-options-migration` added `provideZoneChangeDetection()` to `src/main.ts`, so the app kept running on zone.js exactly as before, and deferred going zoneless to its own change because it carries its own risks and verification. This is that change.

**What zone.js did:** it patched the browser's async APIs, so Angular ran change detection after every async callback. A component could assign a field inside `subscribe` and the view would refresh without the component doing anything else.

**What notifies Angular without zone.js:** a view refreshes only when Angular is notified. The notifications are:

- a template event listener;
- `AsyncPipe`;
- a signal read in the template;
- `ChangeDetectorRef.markForCheck()`;
- an input change;
- a view being attached.

An assignment inside `subscribe` is none of these. Under zoneless, that field changes and the DOM stays stale.

Diagnosis before any change: 11 of 18 components assign state inside `subscribe` with no notification (auth, article, editor, home, profile, profile-articles, profile-favorites, settings, article-list, favorite-button, follow-button). Already notifying: header and article-comment (`| async`); home also uses `rxLet`; footer and article-meta are `OnPush` with no subscriptions. `ShowAuthedDirective` subscribes to shared auth state and creates or clears views.

API stability, read from `@angular/core@22.2.4` type definitions: `provideZonelessChangeDetection()` is `@publicApi` since 20.2.

---

## 2. ADR: zoneless compatibility without a simultaneous state refactor

**Status:** Accepted.

**Context.** Going zoneless requires every view that changes after async work to notify Angular. Two kinds of change can deliver that: keep the current state model (plain fields assigned in `subscribe`) and add explicit notifications where they are missing, or move the state to signals, which notify by themselves when read in the template. The project's rule is one concept per change, and the existing templates and spec assertions are the safety net for this stage.

**Decision.** The decision was made to add `ChangeDetectorRef.markForCheck()` only at the call sites where the audit (section 3) and a failing zoneless spec (section 5) show a notification is missing. No signals and no `toSignal()` in this stage; moving the state to signals is a separate modernization stage. No template changes; existing spec assertions unchanged.

**Alternatives considered.**

| Alternative                                         | Why it was not chosen                                                                                                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convert component state to signals / `toSignal()`   | Larger diff; templates change (fields become signal reads); mixes two goals (removing zone.js and modernizing state) in one change, so a regression could come from either                               |
| Add `markForCheck()` mechanically after every write | Rejected in favor of audit-driven placement: each call answers a specific missing notification, proven by a spec, instead of covering sites that are already notified or that never touch template state |

**Consequences.**

- Positive: small, reviewable diff (10 files, +52 / −12); no template change; easy rollback, since the change is a provider switch plus isolated calls.
- Negative: the components carry imperative notification code that will be removed when the state moves to signals.
- Negative: any new asynchronous state written outside a notified path must remember to call `markForCheck()`; nothing in the template makes the omission visible.

---

## 3. The audit

20 subscriptions and async continuations were audited in the 11 components and `ShowAuthedDirective`: which assigned fields the template reads, and whether another mechanism already notifies.

| Category                        | Sites                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Needs `markForCheck()`** (13) | auth `:95` (error branch); article `:81` (load), `:126` (add comment, both branches), `:143` (delete comment); editor `:60` (edit-mode load, `tagList`), `:104` (create error); profile `:52`; profile-articles `:35`; profile-favorites `:35`; settings `:77` (update error); article-list `:67`; favorite-button `:60` (error branch); follow-button `:59` (error branch)          |
| Already notified                | Child `(toggle)` outputs: template listeners mark the child view and its ancestors dirty, and every usage of the buttons binds `(toggle)`, so their success branches are covered. `ShowAuthedDirective`: `createEmbeddedView` / `clear` notify the scheduler on view attach / detach. Home tags via `rxLet`. `\| async` in header, article-comment and the markdown body (a Promise) |
| Not template state              | Subscriptions that only navigate (article delete; success branches of auth, editor and settings)                                                                                                                                                                                                                                                                                     |
| Synchronous at first render     | Auth state: `currentUser` is a `BehaviorSubject` and `provideAppInitializer` resolves before bootstrap                                                                                                                                                                                                                                                                               |

The 13 sites become 14 calls, because the add-comment site needs one on each branch.

### An incidental case: add comment

The first spec for the add-comment success branch (`article.component.ts:126`) passed without a fix when the user typed the comment first. `commentControl.reset("")` flips the control between pristine and dirty, and those form-state classes are signal-backed, so Angular is notified and the view refreshes. That notification is a side effect of the form state, not of the comment list. A second spec sets the value programmatically, so the control stays pristine: it failed (`expected [ 'comment 1' ] to deeply equal [ 'new one', 'comment 1' ]`). A defensive `markForCheck()` was kept on both branches, as the audit said, so the list does not depend on the form state happening to change.

> **Lesson:** a passing zoneless spec can be passing because of an unrelated notification. Varying how the input arrives exposed it.

---

## 4. Why the existing specs could not see the problem

The existing specs call `fixture.detectChanges()` after each change. For components with `ChangeDetectionStrategy.Eager`, that call refreshes the view whether or not Angular was notified. A component that would stay stale in a zoneless app looks correct in those specs. Turning on `provideCheckNoChangesConfig({ exhaustive: true })` does not change that (section 8).

### How the zoneless regression specs are built (`7faa49e`)

Rules, applied in 13 new spec files (`*.zoneless.spec.ts` next to each component, plus `settings.component.spec.ts`):

- `TestBed` with `provideZonelessChangeDetection()`;
- async sources are `Subject`s that emit after the first render;
- `await fixture.whenStable()`, never `detectChanges()`;
- the assertion reads the DOM.

```ts
fixture = TestBed.createComponent(ProfileComponent);
await fixture.whenStable();
expect(el().querySelector(".profile-page")).toBeNull();

response.next(bob);
await fixture.whenStable();

expect(el().querySelector(".user-info h4")?.textContent?.trim()).toBe("bob");
```

Facts about the harness, found while writing them:

| Fact                                                                                 | Consequence                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Zoneless fixtures auto-detect by default                                             | The first render needs no `detectChanges()`                                                 |
| An unflushed `HttpClient` request blocks `whenStable()`                              | Services are stubbed with `Subject`s                                                        |
| Finishing an `HttpClient` request removes a pending task but marks no view dirty     | An HTTP response alone does not refresh a view                                              |
| `rxLet` rendering and an `AsyncPipe` Promise are not tracked by `whenStable()`       | Those two controls poll with `vi.waitFor`                                                   |
| A static text in a directive's view would render the same before and after a refresh | The `ShowAuthedDirective` control renders a binding (`{{ label }}`), which proves a refresh |

> **Lesson:** a test that forces the refresh it is supposed to observe cannot detect a missing refresh. The regression specs remove the forced refresh and let Angular's own scheduling decide what the DOM shows.

---

## 5. RED → GREEN evidence

### RED (`7faa49e`, before any fix)

This commit intentionally contains failing specs.

| Group                                | Result                                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Zoneless regression specs            | **14 RED**, all stale DOM, e.g. `expected undefined to be 'My title'`, a button class still `disabled`, and the add-comment case in section 3 |
| Controls (already notified)          | 5 GREEN: `ShowAuthedDirective` show / hide, home tags via `rxLet`, favorite success via `(toggle)`, markdown `\| async`                       |
| Settings form (`KNOWN BUG (locked)`) | GREEN (section 8)                                                                                                                             |
| Existing specs                       | 122 GREEN                                                                                                                                     |

Total: 143 tests. While zone.js was still loaded, the expected warning was `NG0914: The application is using zoneless change detection, but is still loading Zone.js`.

### GREEN (`35e9874`)

`ChangeDetectorRef` added as a constructor parameter (all 10 components already use constructor injection) and `this.cdr.markForCheck()` at the 14 audited call sites: auth 1, article 4, editor 2, profile 1, profile-articles 1, profile-favorites 1, settings 1, article-list 1, favorite-button 1, follow-button 1. 10 files, +52 / −12; no template or spec change. Result: 143/143 green.

```diff
       .subscribe(([profile, user]) => {
         this.profile = profile;
         this.isUser = profile.username === user?.username;
+        this.cdr.markForCheck();
       });
```

**Mutation check:** removing the `markForCheck()` in `profile.component.ts` makes exactly one spec fail, "renders the profile after it emits asynchronously"; restored afterwards.

---

## 6. Switching the app (`990252d`)

```diff
-import { provideZoneChangeDetection } from "@angular/core";
+import { provideZonelessChangeDetection } from "@angular/core";
 ...
   .bootstrapModule(AppModule, {
-    applicationProviders: [provideZoneChangeDetection()],
+    applicationProviders: [provideZonelessChangeDetection()],
   })
```

- `angular.json`: `polyfills` removed from the build options and from the `testing` configuration.
- `zone.js` uninstalled (removed from `package.json` and `package-lock.json`).

### Three existing specs fixed in the harness

With zone.js gone, `TestBed` runs zoneless for every spec, not only the new ones. 3 existing characterization specs failed with `NG0100 ExpressionChangedAfterItHasBeenChecked`:

| Spec file                                    | What it does                      |
| -------------------------------------------- | --------------------------------- |
| `article.component.spec.ts` (2 specs)        | Writes `component.comments = ...` |
| `article-preview.component.spec.ts` (1 spec) | Writes `value.tagList = ...`      |

**Why:** each spec writes a field directly and then calls `fixture.detectChanges()` without notifying Angular. In the app, those writes happen inside notified subscriptions or event handlers, so this is a property of the test setup, not of the app.

**Fix (test-only, assertions unchanged):** `fixture.componentRef.changeDetectorRef.markForCheck()` before `fixture.detectChanges()` in those 3 specs.

**Re-verification:** the stage 14 mutation V2 (`track $index`) still fails 2 specs; setting the same `tagList` instead of a new one makes the preview spec fail. The specs still detect what they detected before.

**Process note:** while restoring a temporary mutation, `git checkout` on `article-preview.component.spec.ts` also reverted the uncommitted harness fix in that file. It was reapplied and re-verified before committing.

---

## 7. Verification and metrics

| Metric                                      | Before (stage 14)                 | After                                                                                                               |
| ------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Tests                                       | 122/122 (19 files)                | 143/143 (32 files), no `NG0914` warning                                                                             |
| Coverage (stmts / branches / funcs / lines) | 80.55% / 71.18% / 68.48% / 78.78% | 87.17% / 79.66% / 77.45% / 85.82%                                                                                   |
| Initial bundle (raw / transfer)             | 357.58 kB / 99.59 kB              | 319.70 kB / 87.46 kB (−37.88 kB raw / −12.13 kB transfer; the `markForCheck()` commit alone added +0.10 / +0.04 kB) |
| `polyfills` chunk                           | Present                           | Gone                                                                                                                |
| `__Zone_` symbol in `dist/`                 | —                                 | None                                                                                                                |
| Production build                            | —                                 | 1.6 / 1.5 / 1.5 s, no warnings                                                                                      |

> **Honesty about the numbers:** the coverage increase comes from the 21 new specs, not from the switch. It also inherits a known source of nondeterminism from stage 14: `MarkdownPipe.transform` awaits `import("marked")` and no spec awaits the pipe, so whether one of its lines runs before teardown depends on timing (follow-ups).

**Smoke test:** `ng serve` returned HTTP 200. Headless Chrome (`--dump-dom`) showed the app bootstrapping zoneless (`ng-version="22.2.4"`) and rendering the header (`conduit`, `Sign in`, `Sign up` via `ShowAuthedDirective`), `Global Feed` and `Popular Tags`. Feed data does not load because the public API is gone (documented since stage 00).

---

## 8. Findings

### a) Settings form never filled (locked, not fixed)

`settings.component.ts:57` passes the Observable returned by `getCurrentUser()` to `patchValue`, and the `as Partial<User>` cast hides the type mismatch. The settings form is never filled and the update request is never sent. This is a pre-existing defect, unrelated to zone.js. Following "migrating ≠ fixing", it is locked with a `KNOWN BUG (locked)` spec in the new `settings.component.spec.ts` and not fixed in this stage.

### b) `provideCheckNoChangesConfig` considered, not used

`provideCheckNoChangesConfig({ exhaustive: true })` is `@developerPreview` since 20.0. It does not help here: the existing specs call `detectChanges()` manually, which refreshes `Eager` views anyway, so the missing notifications would still be hidden. The zoneless regression specs (section 4) cover the gap instead.

---

## 9. Follow-ups

| Topic                                                  | Detail                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Signals modernization                                  | Separate stage; move component state to signals and remove the `markForCheck()` calls added here (section 2) |
| Spec that awaits `MarkdownPipe.transform`              | Removes the coverage nondeterminism carried over from stage 14                                               |
| Adopt v22 template `?.` semantics                      | Remove the `$safeNavigationMigration` wrapper in `article.component.html`                                    |
| Review components with `ChangeDetectionStrategy.Eager` | Now that notification is explicit, they are candidates for `OnPush`                                          |
