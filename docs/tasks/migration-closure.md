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
- [ ] Security findings are classified and each has a decision.
- [ ] README presents goal, strategy, results and limitations.
- [ ] There is evidence of functional validation, or a documented limitation.

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

- [ ] T1 Classify `npm audit` findings; decision per finding; fix the stale count
- [ ] T2 End-to-end flow with mocked API, or documented limitation (decide after a short spike)
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

## Next step

T1.
