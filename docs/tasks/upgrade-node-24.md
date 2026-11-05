# Feature: upgrade-node-24

## Objective

Move the runtime from Node 22 to Node 24 on Angular 22.2, with build and characterization tests green.

## Problem / Why

Thirteenth stage. Node 22 is in maintenance LTS until April 2027; Node 24 is supported until April 2028. In stage 06 Node 24 was rejected because Angular CLI 19 listed only Node 18/20/22 as supported. Angular 22.2 now declares Node `^22.22.3 || ^24.15.0 || >=26.0.0` (`@angular/core` and `@angular/build`), so the reason no longer applies.

## Scope

- `.nvmrc` 22 → 24 (CI reads it through `setup-node`).
- `package.json` `engines.node` `^22.12.0` → `^24.15.0` (the Node 24 floor declared by Angular 22.2; the old value is also below Angular 22's Node 22 floor `^22.22.3`).
- Clean install from the lockfile on Node 24; check whether npm rewrites it.
- Out of scope: Vitest, zoneless, dependency upgrades.

## Constraints

- No source or spec changes expected.
- Node 24 ships npm 11; stage 06 saw `allow-scripts` warnings for packages with install scripts (esbuild, fsevents, `@parcel/watcher`).

## Checklist

- [x] T1 Diagnosis: Angular 22 Node support, current `.nvmrc` / `engines`, installed Node 24
- [ ] T2 Switch to Node 24: `.nvmrc`, `engines`, clean install
- [ ] T3 Verify: tests, build, `ng version` support status, metrics vs Node 22
- [ ] T4 Migration log `docs/migration-log/{es,en}/13-*.md`, README, `PROJECT_CONTEXT.md`
- [ ] T5 Merge `--no-ff` + tag (with user approval); CI green on GitHub

## Acceptance criteria

- 122/122 specs green; coverage identical; `ng build` green; `ng version` does not mark Node as unsupported; no changes under `src/`.

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`
- `npx ng version`

## Progress

- T1 (inline): `.nvmrc` = 22; `engines.node` = `^22.12.0`; Node 24.19.0 installed via nvm. `@angular/core@22.2.4` and `@angular/build@22.2.6` engines: `^22.22.3 || ^24.15.0 || >=26.0.0`. The `SUPPORTED_NODE_MAJORS` constant used in stage 06 was not found in `@angular/cli@22` sources; support is checked with `ng version` in T3. Baseline (stage 12, Node 22.23.4): 122/122, coverage 76.98 / 74 / 68.48 / 75.72, initial 357.58 kB raw / 99.59 kB transfer.

## Next step

T2.
