# PROJECT_CONTEXT — realworld-migration

Living state of the Angular migration showcase. Read this first in every new session.

## Goal

Documented, real Angular migration (v15 → current, one major at a time) as a reference migration and learning path. Later: (1) distill the process into a skill-agent ("auditor and planner", human approval per step, documents where the AI failed); (2) a second example migrating v15 → v22 in one effort.

## Source

- Upstream: `gothinkster/angular-realworld-example-app` (remote `upstream`), pinned at `e28c896` (Angular 15.2.3).
- Upstream's own upgrade commits are the "answer key": `0d28f5c` (v16), `bd914dc` (rx-angular rename), `e0a5940`, `6d97f15` (v17.2), `a6f16d0` (v19), `a420aa2` (v20), `2351be8` (v20.3 minor), `33bf8c3` (v21).

## Current state (2026-11-05)

| Item                 | Value                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Integration branch   | `main` (formerly `main-v15`)                                                                                        |
| Tags                 | `v15-baseline` … `v19-upgraded`, `v19-node22` (`v20-upgraded` pending stage 07 merge)                               |
| Angular / CLI        | 20.3.35 / 20.3.42                                                                                                   |
| TypeScript / zone.js | 5.8.3 / 0.15.1                                                                                                      |
| rx-angular           | template 20.1.0, cdk 20.1.1                                                                                         |
| Builder              | esbuild `build-angular:application` (Karma still webpack)                                                           |
| Node                 | 22 (`nvm use`, per `.nvmrc`; `engines.node` `^22.12.0`). Node 24 now officially supported by Angular 20 (follow-up) |
| Tests                | 76 specs (72 characterization + 4 interceptor-chain integration), Karma, all green; coverage 57.41% stmts           |

## Completed stages

| #   | Stage                                             | Task doc                                    | Migration log                           |
| --- | ------------------------------------------------- | ------------------------------------------- | --------------------------------------- |
| 00  | Characterization tests (safety net)               | `docs/tasks/characterization-tests.md`      | `docs/migration-log/{es,en}/00-*.md`    |
| 01  | Upgrade 15 → 16                                   | `docs/tasks/upgrade-angular-16.md`          | `docs/migration-log/{es,en}/01-*.md`    |
| 02  | Upgrade 16 → 17                                   | `docs/tasks/upgrade-angular-17.md`          | `docs/migration-log/{es,en}/02-*.md`    |
| 03  | Builder webpack → esbuild `application` (on 17.3) | `docs/tasks/esbuild-application-builder.md` | `docs/migration-log/{es,en}/03-*.md`    |
| 04  | Upgrade 17 → 18                                   | `docs/tasks/upgrade-angular-18.md`          | `docs/migration-log/{es,en}/04-*.md`    |
| 04b | Interceptor chain integration spec                | `docs/tasks/interceptor-chain-spec.md`      | `docs/migration-log/{es,en}/04-*.md` §8 |
| 05  | Upgrade 18 → 19                                   | `docs/tasks/upgrade-angular-19.md`          | `docs/migration-log/{es,en}/05-*.md`    |
| 06  | Runtime Node 18 → 22 (on Angular 19.2)            | `docs/tasks/upgrade-node-22.md`             | `docs/migration-log/{es,en}/06-*.md`    |
| 07  | Upgrade 19 → 20                                   | `docs/tasks/upgrade-angular-20.md`          | `docs/migration-log/{es,en}/07-*.md`    |

## Decisions (do not re-ask)

- One major at a time; upgrade and modernization are separate features; one concept per PR.
- Migrating ≠ fixing: bugs are locked with `KNOWN BUG (locked)` specs, fixed later in `fix(...)` PRs.
- Third-party versions chosen by `peerDependencies` matching the Angular major, never `ng update`'s "latest" suggestion.
- npm pinned in `angular.json` (`cli.packageManager`) because global `~/.angular-config.json` uses bun.
- Dead external deps (theme CSS 404, `api.realworld.io` 530) are OUT OF SCOPE (maintenance, not migration). Accepted risk: no manual visual/runtime validation.
- Published history: documentation files (`docs/migration-log`, `docs/tasks`, `PROJECT_CONTEXT.md`) were stripped from past commits with `git filter-repo` (own commits only; upstream history untouched) and added in one final commit. Commit hashes in the docs refer to the published history.
- Node 22 over Node 24 for stage 06: Angular CLI 19 reports Node 24 as `(Unsupported)` (`SUPPORTED_NODE_MAJORS = [18, 20, 22]`) even though its `engines` accepts it. `engines` is the floor npm checks, not the official support matrix. Node 24 moves to a later stage on Angular 20+.
- rx-angular 20 (not 22) for stage 07: 22.0.0, suggested by `ng update`, requires `@angular/core >=22`. Builder package switch (`@angular-devkit/build-angular` → `@angular/build`) deferred to its own change, unlike upstream `a420aa2`.
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

## Next step

Stage 07 (Angular 19.2 → 20.3) done on `feature/upgrade-angular-20`; pending merge `--no-ff` + tag `v20-upgraded` (with user approval). Next: stage 08, upgrade Angular 20 → 21 (the next major). Open follow-ups (see `docs/tasks/upgrade-angular-20.md`): builder package `@angular-devkit/build-angular` → `@angular/build` (`use-application-builder`); `*ngIf` / `*ngFor` → built-in control flow (`control-flow-migration`); `APP_INITIALIZER` → `provideAppInitializer()`; unused `AsyncPipe` imports (NG8113, formerly TS-998113); Node 24 (now officially supported); `npm audit` 65 findings (2 critical), pre-existing.

Every step: diagnosis checklist (Node/TS/zone.js matrix, third-party peers, test coverage of touched code, smoke test) → feature branch + `docs/tasks/*.md` → verify build + tests → compare with upstream → migration log es/en → merge with `--no-ff` + tag.
