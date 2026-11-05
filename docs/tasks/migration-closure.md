# Feature: migration-closure

## Objective

Close the project: verify that the result is reliable, classify the remaining risks, consolidate the results, and publish a final tagged release. No new modernization.

## Problem / Why

The planned sequence is complete (stages 00–15: Angular 15 → 22.2, TypeScript 6.0, Node 24, `@angular/build`, built-in control flow, `provideAppInitializer()`, Vitest, zoneless). The technical work is green in CI. What is missing is closure evidence and presentation:

- Security findings are not classified (and the recorded count is stale).
- The README has the approach and the stages table, but no consolidated results (before / after) and no consolidated limitations.
- Functional validation stops at component / integration specs and a headless smoke test of the anonymous home page; no end-to-end user flow has been exercised (the public RealWorld API no longer exists).

## Closure criteria (contract)

- [ ] Zoneless works and its documentation reflects the real state (stage 15 T8 closed).
- [ ] Production build and automated tests pass.
- [ ] CI verifies changes and shows results.
- [x] Security findings are classified and each has a decision.
- [ ] README presents goal, strategy, results and limitations.
- [x] There is evidence of functional validation, or a documented limitation.

## Scope

1. **`npm audit` classification.** Current state (checked read-only on 2026-11-05, `main` at `86a71e0`): 8 findings (5 moderate, 3 high); `--omit=dev`: 7 (4 moderate, 3 high): `minimatch`, `picomatch`, `ng-morph`, `ts-morph`, `@ts-morph/common` (via rx-angular schematics) and `ajv`, `@angular-devkit/core` (Angular devkit). Classify each by whether it reaches the browser bundle or only build / code-generation tooling; record a decision per finding (upgrade, accept with reason, or track). Do not run `npm audit fix --force`. Fix the stale count in `PROJECT_CONTEXT.md` (it still says 20; Karma removal in stage 14 reduced it).
2. **One end-to-end flow with a mocked API** (or a documented limitation). Scope: one critical flow only, e.g. sign in with mocked credentials → feed → open an article. Candidate: Playwright with request interception, in its own CI step. If the cost is disproportionate (dependency, browser download in CI, dead theme stylesheet), document the limitation instead.
3. **Final README.** Add: results summary (before / after: Angular, TypeScript, Node, test runner, test count, coverage, bundle, install size, change detection), consolidated limitations (dead API and theme, locked bugs, coverage measurement notes), and an explicit out-of-scope list.
4. **Technical closure document** (`docs/`): the problem, the hardest decisions (with links to the stage logs and the stage 15 ADR), results, what would be done differently in a company setting, and an AI-assisted development section based on verified incidents only: the wrong "Angular 21 is the latest major" claim corrected after checking npm; contradictions caught by documentation agents (upstream answer-key hash, bundle baselines); the `refactor-jasmine-vitest` report claiming no manual changes while the build then failed with 16 type errors; the `git checkout` that reverted an uncommitted fix during stage 15 and how it was caught. Neutral, technical tone; not written for recruiters.
5. **Release.** Tick T8 in `docs/tasks/zoneless.md`; final `PROJECT_CONTEXT.md` state; tag `v1.0.0` with a GitHub Release summarizing the 16 stages; then development stops.

## Out of scope (explicit decisions)

| Improvement                                                                                      | Decision                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Convert all state to signals                                                                     | Out of scope (future opportunity)                             |
| Move all components to `OnPush`                                                                  | Out of scope (future opportunity)                             |
| Reach 90–100 % coverage                                                                          | Not a goal                                                    |
| Fix all inherited defects (locked bugs)                                                          | Out of scope unless a risk is blocking ("migrating ≠ fixing") |
| Rewrite the architecture                                                                         | Out of scope                                                  |
| Add more AI tooling                                                                              | Out of scope                                                  |
| Other follow-ups (`MarkdownPipe` await spec, `$safeNavigationMigration` cleanup, `Eager` review) | Listed as future opportunities, not blocking                  |

## Checklist

- [x] T1 Classify `npm audit` findings; decision per finding; fix the stale count
- [x] T2 End-to-end flow with mocked API, or documented limitation (decide after a short spike)
- [ ] T3 Final README (results, limitations, out of scope)
- [ ] T4 Technical closure document (incl. AI-assisted section from verified incidents)
- [ ] T5 Close stage 15 T8; final `PROJECT_CONTEXT.md`; tag `v1.0.0` + GitHub Release (with user approval)

## Acceptance criteria

- All six closure criteria checked with evidence; no new modernization in the diff.

## Checks

- `npx ng build`
- `npx ng test --watch=false --coverage`
- `npm audit` / `npm audit --omit=dev`

## Progress

- Plan agreed with the user on 2026-11-05 (closure stage, no further modernization; external publication outside this repository). Execution starts in a new session.
- T1 (inline; trigger evidence: one lockfile, bounded audit output). `npm audit fix` without `--force`: only `package-lock.json` changed (no `package.json` range changed). `npm audit` 8 → 4 (5 moderate / 3 high → 2 moderate / 2 high); `--omit=dev` 7 → 4. Prod build OK; 32 files, 143/143 green; none of the affected packages appears in `dist/`.

  | Package                | Severity | Path                                                                                           | Reaches browser bundle | Decision                                             |
  | ---------------------- | -------- | ---------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------- |
  | `ajv`                  | moderate | `ng-morph` → `@angular-devkit/core@18`                                                         | No                     | Fixed by lockfile update (8.17.1 → 8.20.0)           |
  | `picomatch`            | high     | `ng-morph` → `@angular-devkit/core@18`; `tinyglobby`                                           | No                     | Fixed by lockfile update (→ 2.3.2 / 4.0.7)           |
  | `@angular-devkit/core` | moderate | `ng-morph` (via `ajv`, `picomatch`)                                                            | No                     | Fixed by lockfile update (18.2.21 → 22.2.6, deduped) |
  | `yaml`                 | moderate | `lint-staged` (dev only)                                                                       | No                     | Fixed by lockfile update (→ 2.9.1)                   |
  | `minimatch`            | high     | `@rx-angular/{cdk,template}` → `ng-morph@4.9.1` (pins `10.0.3`); `@ts-morph/common` (`^9.0.4`) | No                     | Accepted with reason, tracked                        |
  | `ng-morph`             | high     | `@rx-angular/{cdk,template}` (`^4.0.3`)                                                        | No                     | Accepted with reason, tracked                        |
  | `ts-morph`             | moderate | `ng-morph@4.9.1` (pins `24.0.0`)                                                               | No                     | Accepted with reason, tracked                        |
  | `@ts-morph/common`     | moderate | `ts-morph@24` (`~0.25.0`)                                                                      | No                     | Accepted with reason, tracked                        |

  Reason for the 4 accepted findings (user decision, option A): `ng-morph` is used only by `@rx-angular/*/schematics` (`ng add` / `ng update`), never by the application build or the browser bundle; the advisories are ReDoS / glob-matching issues on developer-controlled glob patterns. The real fix is `ng-morph@5` (`minimatch 10.2.6`, `ts-morph 27`), which `@rx-angular` 22 does not allow. Forcing it with npm `overrides` was rejected: it imposes major versions `ng-morph` does not declare, and the schematics cannot be verified without running them. Tracking: re-check when `@rx-angular` moves to `ng-morph@5`.

- T2 (delegated writer; trigger: 2+ non-trivial files). One Playwright flow with a fully mocked API, no production source change.
  - Dependency: `@playwright/test` `1.65.0` (pinned exactly, dev only; Chromium headless shell revision 1254). Added `playwright.config.ts` (chromium only, `webServer` = `npx ng serve --port 4200`, `reuseExistingServer` outside CI, retries 0 locally / 1 in CI, `trace: on-first-retry`), `e2e/sign-in-feed-article.e2e.ts`, `e2e/tsconfig.json` + `e2e/node-env.d.ts` (type-check without adding `@types/node`), npm script `e2e`, `.gitignore` entries for Playwright output, and three CI steps after the unit tests (install Chromium with deps, `npm run e2e`, upload `playwright-report/` on failure).
  - Flow: `/login` → sign in → home → "Your Feed" → open article → title, markdown body and comment visible. Mocked endpoints (`https://api.realworld.io/api/**`): `POST /users/login` (request body asserted), `GET /user` (defensive: only requested at bootstrap when a token is already stored), `GET /tags`, `GET /articles`, `GET /articles/feed` (asserts `Authorization: Token <jwt>`), `GET /articles/:slug`, `GET /articles/:slug/comments`. Any unmocked API call gets HTTP 500 and fails the test; every other external host (dead theme stylesheet, fonts, icons) is aborted.
  - Finding: the locked home-page bug (`home.component.spec.ts`, "redirects an authenticated user to /login on init") is reproduced in a real browser: after sign-in the home page stays on "Global Feed" and calls `GET /articles`. The test asserts this and clicks "Your Feed" explicitly; the bug stays locked ("migrating ≠ fixing").
  - Test-first exception: test infrastructure only, no production behavior change, so there is no RED/GREEN cycle on production code. The test was shown to fail: with the `GET /articles/:slug/comments` fixture removed it failed (article `h1` not found, because the article page redirects home on the API error); restored, it passed.
  - Evidence: `npm run e2e` passed 1/1 (≈2.6–2.9 s wall time including the dev server, on four separate runs) and 5/5 with `--repeat-each=5`; `npx ng build` OK; `npx ng test --watch=false` 32 files, 143/143 (e2e files are not picked up); `npm audit` 4 (2 moderate / 2 high) and `--omit=dev` 4, unchanged from T1.

## Next step

T3 (final README).
