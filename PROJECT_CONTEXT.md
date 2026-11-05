# PROJECT_CONTEXT — realworld-migration

Living state of the Angular migration showcase. Read this first in every new session.

## Goal

Documented, real Angular migration (v15 → current, one major at a time) as a reference migration and learning path. Later: (1) distill the process into a skill-agent ("auditor and planner", human approval per step, documents where the AI failed); (2) a second example migrating v15 → v22 in one effort.

## Source

- Upstream: `gothinkster/angular-realworld-example-app` (remote `upstream`), pinned at `e28c896` (Angular 15.2.3).
- Upstream's own upgrade commits are the "answer key": `0d28f5c` (v16), `bd914dc` (rx-angular rename), `e0a5940`, `6d97f15` (v17.2), `a6f16d0` (v19), `a420aa2` (v20), `2351be8` (v20.3 minor), `33bf8c3` (v21).

## Current state (2026-11-05)

| Item                 | Value                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integration branch   | `main` (formerly `main-v15`)                                                                                                                                                                  |
| Tags                 | `v15-baseline` … `v19-upgraded`, `v19-node22`, `v20-upgraded`, `v20-control-flow`, `v21-upgraded`, `v21-angular-build`, `v22-upgraded` (`v22-app-initializer` pending stage 12 merge)         |
| Angular / CLI        | 22.2.4 / 22.2.6 (`@angular/build` 22.2.6)                                                                                                                                                     |
| TypeScript / zone.js | 6.0.3 / 0.15.1 (zone.js change detection opted in via `provideZoneChangeDetection()`)                                                                                                         |
| rx-angular           | template 22.0.0, cdk 22.0.0 (template peer cdk `^22.0.0`)                                                                                                                                     |
| Builder              | `@angular/build:application` (esbuild); tests via `@angular/build:karma` (stage 10)                                                                                                           |
| Node                 | 22 (`nvm use`, per `.nvmrc`; `engines.node` `^22.12.0`). Node 24 officially supported by Angular 20+ (follow-up)                                                                              |
| Tests                | 122 specs (116 characterization + 6 integration: 4 interceptor-chain, 2 app-initializer wiring), Karma, all green; coverage 76.98% / 74% / 68.48% / 75.72% (stmts / branches / funcs / lines) |

## Completed stages

| #   | Stage                                                      | Task doc                                    | Migration log                           |
| --- | ---------------------------------------------------------- | ------------------------------------------- | --------------------------------------- |
| 00  | Characterization tests (safety net)                        | `docs/tasks/characterization-tests.md`      | `docs/migration-log/{es,en}/00-*.md`    |
| 01  | Upgrade 15 → 16                                            | `docs/tasks/upgrade-angular-16.md`          | `docs/migration-log/{es,en}/01-*.md`    |
| 02  | Upgrade 16 → 17                                            | `docs/tasks/upgrade-angular-17.md`          | `docs/migration-log/{es,en}/02-*.md`    |
| 03  | Builder webpack → esbuild `application` (on 17.3)          | `docs/tasks/esbuild-application-builder.md` | `docs/migration-log/{es,en}/03-*.md`    |
| 04  | Upgrade 17 → 18                                            | `docs/tasks/upgrade-angular-18.md`          | `docs/migration-log/{es,en}/04-*.md`    |
| 04b | Interceptor chain integration spec                         | `docs/tasks/interceptor-chain-spec.md`      | `docs/migration-log/{es,en}/04-*.md` §8 |
| 05  | Upgrade 18 → 19                                            | `docs/tasks/upgrade-angular-19.md`          | `docs/migration-log/{es,en}/05-*.md`    |
| 06  | Runtime Node 18 → 22 (on Angular 19.2)                     | `docs/tasks/upgrade-node-22.md`             | `docs/migration-log/{es,en}/06-*.md`    |
| 07  | Upgrade 19 → 20                                            | `docs/tasks/upgrade-angular-20.md`          | `docs/migration-log/{es,en}/07-*.md`    |
| 08  | Built-in control flow (on Angular 20.3)                    | `docs/tasks/migrate-control-flow.md`        | `docs/migration-log/{es,en}/08-*.md`    |
| 09  | Upgrade 20 → 21                                            | `docs/tasks/upgrade-angular-21.md`          | `docs/migration-log/{es,en}/09-*.md`    |
| 10  | Builder package build-angular → `@angular/build` (on 21.2) | `docs/tasks/angular-build-package.md`       | `docs/migration-log/{es,en}/10-*.md`    |
| 11  | Upgrade 21 → 22 + TypeScript 6.0                           | `docs/tasks/upgrade-angular-22.md`          | `docs/migration-log/{es,en}/11-*.md`    |
| 12  | `APP_INITIALIZER` → `provideAppInitializer()` (on 22.2)    | `docs/tasks/provide-app-initializer.md`     | `docs/migration-log/{es,en}/12-*.md`    |

## Decisions (do not re-ask)

- One major at a time; upgrade and modernization are separate features; one concept per PR.
- Migrating ≠ fixing: bugs are locked with `KNOWN BUG (locked)` specs, fixed later in `fix(...)` PRs.
- Third-party versions chosen by `peerDependencies` matching the Angular major, never `ng update`'s "latest" suggestion.
- npm pinned in `angular.json` (`cli.packageManager`) because global `~/.angular-config.json` uses bun.
- Dead external deps (theme CSS 404, `api.realworld.io` 530) are OUT OF SCOPE (maintenance, not migration). Accepted risk: no manual visual/runtime validation.
- Published history: documentation files (`docs/migration-log`, `docs/tasks`, `PROJECT_CONTEXT.md`) were stripped from past commits with `git filter-repo` (own commits only; upstream history untouched) and added in one final commit. Commit hashes in the docs refer to the published history.
- Node 22 over Node 24 for stage 06: Angular CLI 19 reports Node 24 as `(Unsupported)` (`SUPPORTED_NODE_MAJORS = [18, 20, 22]`) even though its `engines` accepts it. `engines` is the floor npm checks, not the official support matrix. Node 24 moves to a later stage on Angular 20+.
- rx-angular 20 (not 22) for stage 07: 22.0.0, suggested by `ng update`, requires `@angular/core >=22`. Builder package switch (`@angular-devkit/build-angular` → `@angular/build`) deferred to its own change, unlike upstream `a420aa2`.
- Angular 21 (stage 09): zone.js kept, via `provideZoneChangeDetection()` added by the official `bootstrap-options-migration` (v21 defaults to zoneless). Going zoneless is deferred to its own modernization change. Builder package switch, Vitest and `provideAppInitializer()` stay separate changes, unlike upstream, which adopted them before its v21 commit `33bf8c3`.
- Angular 22 (stage 11): TypeScript 6.0 `TS5101` on `baseUrl` fixed by removing the unused `"baseUrl": "./"` from `tsconfig.json` (no import relies on it, no `paths`), not by `ignoreDeprecations`. The behavior-preserving changes of the v22 migrations (`ChangeDetectionStrategy.Eager`, `withXhr()`, `$safeNavigationMigration`, suppressed extended diagnostics) are accepted as-is; adopting the new defaults is deferred to follow-ups.
- Migration logs are decision records (es/en): diagnosis, changes, findings, verification, upstream comparison. Personal study material lives outside the repository.

## Locked findings (not fixed)

1. `ShowAuthedDirective` never re-renders after auth toggles back (both modes).
2. `EditorComponent.submitForm` always calls `create`, never `update`.
3. `ApiInterceptor` prefixes absolute URLs.
4. `ErrorInterceptor` rethrows `null` on empty error body.
5. `JwtService.getToken` returns `undefined` without token.
6. `EditorComponent.addTag` stores untrimmed tags.
7. `HomeComponent` redirects authenticated users to `/login` (`tap` runs before `subscribe` assigns `isAuthenticated`).
8. `ShowAuthedDirective` subscribes to `isAuthenticated` and never unsubscribes (memory leak).
9. `ListErrorsComponent` always renders an empty `ul.error-messages` (`errorList` is always an array; `[]` is truthy).

## Next step

Stage 12 (`APP_INITIALIZER` → `provideAppInitializer()` on Angular 22.2) complete on `feature/provide-app-initializer`, merge and tag `v22-app-initializer` pending (with user approval). Stage 11 merged and tagged `v22-upgraded`. Planned order: (1) builder package → `@angular/build` (done, stage 10); (2) Angular 21 → 22 + TypeScript 6.0 (done, stage 11); (3a) `APP_INITIALIZER` → `provideAppInitializer()` (done, pending merge; `docs/tasks/provide-app-initializer.md`); (3b) next: Node 22 → 24 (stage 13); (4) Karma → Vitest (`migrate-karma-to-vitest` is optional in v22); (5) zoneless change detection. Open follow-ups from stage 11: adopt v22 template `?.` semantics and remove the `$safeNavigationMigration` wrapper (`article.component.html`); review `ChangeDetectionStrategy.Eager` components when moving to OnPush / zoneless. Still open from earlier stages: `article-list` `RangeError` when `limit` is unset (not locked); `npm audit` 20 findings (no critical) after stage 11.

Every step: diagnosis checklist (Node/TS/zone.js matrix, third-party peers, test coverage of touched code, smoke test) → feature branch + `docs/tasks/*.md` → verify build + tests → compare with upstream → migration log es/en → merge with `--no-ff` + tag.
