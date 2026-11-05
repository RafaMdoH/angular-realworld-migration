# Technical closure

> Closing record of the Angular RealWorld migration (stages 00–15 plus the closure stage). Spanish version: [`technical-closure.es.md`](technical-closure.es.md).

## 1. Problem

The project takes the RealWorld "Conduit" Angular app, pinned at upstream commit `e28c896` (Angular 15.2.3, TypeScript 4.8, Node 18, Karma, zone.js), and migrates it to Angular 22.2 one major version at a time. It is a documented reference migration: each stage records what was diagnosed before the change, what the official migrations did, what broke, how the result was verified, and how it compares with the upstream project's own upgrade commit (the "answer key").

The reason for doing it stage by stage, instead of in one jump, is attribution. When a single change moves the framework, the toolchain and the templates at once, a regression can come from any of them. Keeping one concept per change keeps each failure traceable to one cause, and keeps each stage small enough to review.

The public RealWorld API and the theme stylesheet the app depends on are no longer available, so the app cannot be used live. Validation relies on specs and on one end-to-end flow with a mocked API (see [Limitations](../README.md#limitations)).

## 2. Approach

Every stage followed the same loop (details in the [README](../README.md#approach)):

1. **Diagnosis checklist** before touching anything: Node / TypeScript / zone.js matrix, third-party `peerDependencies` for the target major, spec coverage of the code the stage touches, smoke test.
2. **Feature branch + task document** (`docs/tasks/*.md`) with a checklist, acceptance criteria and the verification evidence of each step.
3. **Build and tests**, plus mutation checks where the stage relied on the specs (break the code on purpose, confirm a spec fails, revert).
4. **Upstream comparison** with the corresponding upstream upgrade commit, while one existed (none exists after Angular 21).
5. **Bilingual decision record** in `docs/migration-log/{en,es}/`.
6. **Merge with `--no-ff` and a tag** per stage, after explicit approval.

## 3. Hardest decisions

### 3.1 Characterization specs before every risky change

The baseline had no specs. Before the first upgrade, 67 characterization specs locked the existing behavior, including existing bugs, and each one was validated by mutation ([stage 00](migration-log/en/00-characterization-tests.md)). The same rule was applied later whenever a stage changed something the specs did not observe: 44 template specs before the control-flow migration ([stage 08](migration-log/en/08-control-flow-migration.md), section 2), an interceptor-chain integration spec ([stage 04](migration-log/en/04-upgrade-angular-18.md), section 8), initializer-wiring specs ([stage 12](migration-log/en/12-provide-app-initializer.md)), and 21 zoneless specs that were RED before the fix ([stage 15](migration-log/en/15-zoneless.md), section 5). The cost is extra work before each risky stage; the benefit is that a green suite after the change means something.

### 3.2 Migrating ≠ fixing

Defects found during the migration were not fixed inside an upgrade. They were locked with `KNOWN BUG (locked)` specs, so a later change in that behavior is visible as a failing test. Ten findings are locked ([`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md#locked-findings-not-fixed)); the last one, the settings form that is never filled, was found during the zoneless audit ([stage 15](migration-log/en/15-zoneless.md), section 8). The trade-off is that known defects ship unchanged; the benefit is that every behavior change in the history is attributable to a deliberate fix, not to an upgrade.

### 3.3 Control-flow migration as its own stage, on Angular 20

In `@angular/core@21`, `control-flow-migration` is mandatory, and 7 of the 10 affected templates had no rendering spec. Running it inside the v21 upgrade would have mixed a framework change, a TypeScript bump and 10 rewritten templates in one diff. It was run first, on Angular 20, after adding the missing specs ([stage 08](migration-log/en/08-control-flow-migration.md)). The v21 upgrade then had nothing left to convert ([stage 09](migration-log/en/09-upgrade-angular-21.md)).

### 3.4 Builder package switch separated from the version upgrade

Upstream switched from `@angular-devkit/build-angular` to `@angular/build` inside its Angular 20 commit. Here it was a separate stage on Angular 21, before Angular 22 deprecated the old package ([stage 10](migration-log/en/10-angular-build-package.md)). Because the output files kept identical content hashes, the stage could show that only the installed tree changed (1093 → 710 packages), and the Angular 22 stage stayed a pure version upgrade ([stage 11](migration-log/en/11-upgrade-angular-22.md)).

### 3.5 Karma → Vitest: proving the safety net did not change

This was the one stage where the specs themselves changed, so a green run on the new runner proved only that the new suite agreed with itself. The equivalence was shown from outside the tool: identical test titles before and after (122), and a sample of earlier mutations still caught ([stage 14](migration-log/en/14-karma-to-vitest.md), section 6). Tests now run in Node + jsdom instead of a real browser (user decision, section 2). Coverage uses istanbul on both sides, but the numbers still differ with the same tests; the difference was documented, not adjusted, and coverage is treated as not fully comparable across this stage.

### 3.6 Zoneless with selective `markForCheck()`, no signals refactor

The [stage 15 ADR](migration-log/en/15-zoneless.md#2-adr-zoneless-compatibility-without-a-simultaneous-state-refactor) keeps the state model and adds `ChangeDetectorRef.markForCheck()` only at the 14 call sites where the audit and a failing zoneless spec showed a missing notification. Converting state to signals was rejected for this stage because it would change templates and mix two goals in one diff. The accepted cost is imperative notification code that a future signals stage would remove, and the need to remember `markForCheck()` for new asynchronous state.

## 4. Results

The before / after table is in the [README](../README.md#results-before--after). In summary:

- The app moved from Angular 15.2 / TypeScript 4.8 / Node 18 / webpack / Karma / zone.js to Angular 22.2 / TypeScript 6.0 / Node 24 / `@angular/build` (esbuild) / Vitest / zoneless, in 16 tagged stages.
- The suite grew from 67 to 143 specs. Coverage rose from 44.78 % to 87.17 % of statements, as a consequence of the specs added before risky changes, not as a target.
- The initial bundle is smaller than its first recorded value (332.17 → 319.70 kB raw); the largest single reduction was removing zone.js in stage 15 (−37.98 kB raw). The installed tree dropped from 1093 to 460 packages; the largest single reduction was dropping the webpack-carrying builder package in stage 10 (1093 → 710).
- `npm audit` went from 65 findings (2 critical, first recorded at stage 06) to 4, all in schematic-only tooling, accepted with reason and tracked.

## 5. What would be done differently in a company setting

- **Measure every baseline at stage 00.** The initial bundle, installed package count and `npm audit` were not measured on Angular 15; the README shows their first recorded values from stages 03, 10 and 06 instead, and the method behind the stage 00 `dist` size was not recorded. A company migration would capture these, with their commands, before the first change.
- **Set up the end-to-end harness early.** The only real-browser flow was added in the closure stage. Stage 14 moved unit tests from a real browser to jsdom, and stage 15 changed change detection, with only a headless smoke test of the anonymous home page as browser evidence. An E2E flow with a mocked API at stage 00 would have covered both.
- **Have a dependency audit policy from the start.** `npm audit` was first recorded at stage 06 (65 findings, 2 critical) and classified only at closure. A team would define severity thresholds and a per-finding decision (upgrade, accept with reason, track) for each stage.
- **Independent human review.** Every step was approved by one person and executed with an AI assistant. Decisions with lasting cost (the ADR in stage 15, accepting Node + jsdom in stage 14, accepting the audit findings) would go through review by other engineers and code owners.
- **Keep documentation in the same commits as the change.** The task documents and logs were stripped from the history with `git filter-repo` and added in one commit before publication ([`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md#decisions-do-not-re-ask)). In a shared repository, docs would be reviewed and merged with the change they describe.

## 6. AI-assisted development

The work was done with an AI coding assistant. The incidents below are those with evidence in the repository or the project memory. Each lists what was claimed or done, how it was detected, which control caught it, and the lesson.

### 6.1 "Angular 21 is the latest major"

- **Claim:** at the close of stage 09, the context file stated "Angular 21 is the current latest major line for this project" (commit `32776f7`, `PROJECT_CONTEXT.md`).
- **Detection:** the registry was checked with npm before planning the next stage: Angular 22 was already published (`latest` 22.2.4, 22.0.0 released 2026-06-03), requiring TypeScript 6.0 and deprecating `@angular-devkit/build-angular`.
- **Control:** registry check (`npm view`) before planning. The statement was replaced in commit `68ffe76`, and stages 10 and 11 were added to the plan ([stage 11](migration-log/en/11-upgrade-angular-22.md), section intro).
- **Lesson:** version facts come from the registry at the time of the decision, not from the assistant's knowledge.

### 6.2 Wrong upstream answer-key hash

- **Claim:** `PROJECT_CONTEXT.md` listed upstream `2351be8` as the Angular 20 answer key.
- **Detection:** while preparing the stage 07 upstream comparison, `2351be8` turned out to be a later 20.3 minor update; the Angular 20 upgrade commit is `a420aa2`.
- **Control:** the upstream comparison step itself, which requires reading the referenced commit. Corrected in commit `c560d30` ([stage 07](migration-log/en/07-upgrade-angular-20.md), section 7).
- **Lesson:** a hash recorded in a context file is a claim like any other; it is verified against `git` before it is used as evidence.

### 6.3 Automated refactor report: "No Manual Changes Required"

- **Claim:** the `refactor-jasmine-vitest` schematic reported 12 of 19 files transformed, 0 TODOs and "No Manual Changes Required" ([report](tasks/evidence/jasmine-vitest-20261105T190035550Z.md)). This is a deterministic Angular schematic, not an AI agent, but the lesson is the same.
- **Detection:** the test build then failed with 16 TypeScript errors, all type-only.
- **Control:** building and running the suite after the automated change. The errors were fixed with 15 listed edits ([stage 14](migration-log/en/14-karma-to-vitest.md), section 4).
- **Lesson:** build and test after every automated refactor; a tool's summary of its own work is not verification.

### 6.4 `git checkout` reverted an uncommitted fix

- **What happened:** during stage 15, while restoring a temporary mutation, `git checkout` on `article-preview.component.spec.ts` also reverted the uncommitted harness fix in the same file.
- **Detection and control:** it was noticed before the commit; the fix was reapplied and the suite re-verified before committing ([stage 15](migration-log/en/15-zoneless.md), section 6; [`docs/tasks/zoneless.md`](tasks/zoneless.md), T5). The record does not say more about how it was noticed.
- **Lesson:** do not use `git checkout <file>` to undo a mutation in a file that has uncommitted work; commit or stash first, or revert the mutation by hand.

### 6.5 Working model

The person approved each step (scope, merges, tags, accepted risks); the assistant executed bounded tasks with explicit edit boundaries and success criteria ([stage 00](migration-log/en/00-characterization-tests.md), sections 4–5). An agent reporting "done" was not treated as evidence: version claims were checked against the npm registry, documentation drafted by agents was re-verified against `git`, and code changes were checked by build, tests and mutation. The control also worked in the other direction: in stage 00 the human's brief had a wrong type for the error fixtures, and the agent followed the source code instead (section 6, row 3).
