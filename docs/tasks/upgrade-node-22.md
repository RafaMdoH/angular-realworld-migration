# Feature: upgrade-node-22

## Objective

Move the runtime from Node 18 to Node 22 on Angular 19.2, with build and characterization tests green, before the Angular 19 → 20 upgrade.

## Problem / Why

Sixth stage. Angular 20 requires Node `^20.19.0 || ^22.12.0 || >=24.0.0`, and rx-angular 19 tooling already requires Node 20+. Node 18 and Node 20 are both end-of-life (Node 20 since April 2026). Node 22 is the only non-EOL major officially supported by **both** Angular 19 and Angular 20, so the runtime change can be isolated from the framework upgrade without passing through an unsupported combination: one concept per change.

## Scope

- `.nvmrc` 18 → 22 (CI reads it through `setup-node`).
- `package.json` `engines.node`: still the upstream Angular 15 range (`^14.20.0 || ^16.13.0 || ^18.10.0`), which excludes Node 22.
- Reinstall from the lockfile on Node 22 and check whether npm rewrites it.
- README and `PROJECT_CONTEXT.md` references to Node 18 and `NG_DISABLE_VERSION_CHECK`.
- Out of scope: Angular 20 (next stage), Node 24 (later stage, on Angular 20+), dependency and tooling upgrades, `npm audit` findings.

## Constraints

- No source or spec changes expected: the runtime change must be invisible to the app and the tests.
- `engines.node` is set to `^22.12.0`: the minimum Node 22 accepted by Angular 20, so the range stays valid through the next stage.

## Checklist

- [x] T1 Diagnosis: what depends on the Node version
- [x] T2 Switch to Node 22: `.nvmrc`, `engines`, clean install from lockfile
- [x] T3 Verify: tests, build, metrics vs Node 18; `ng` without `NG_DISABLE_VERSION_CHECK`; `EBADENGINE` gone
- [x] T4 Docs: README, `PROJECT_CONTEXT.md`, migration log `docs/migration-log/{es,en}/06-*.md`
- [x] T5 Merge `--no-ff` + tag `v19-node22` (with user approval); CI green on GitHub

## Acceptance criteria

- 76/76 specs green, coverage identical; `ng build` green; no changes under `src/`.

## Checks

- `npx ng test --watch=false --browsers=ChromeHeadless --code-coverage`
- `npx ng build`
- `npx ng version` (no "Unsupported" marker)

## Progress

- T1 (inline): `.nvmrc` = 18; `engines.node` unchanged since upstream baseline `e28c896`; README and `PROJECT_CONTEXT.md` mention Node 18; CI needs no change (`node-version-file: .nvmrc`); no `.npmrc` / `engine-strict`. Baseline on Node 18 = stage 05 T5 (same tree): 76/76, coverage 57.41 / 74 / 51.82 / 55.36, build 2.9 / 2.5 / 2.4 s, initial 333.23 kB raw / 94.20 kB transfer.
- Node 24 attempt (discarded): on Node 24.19 / npm 11.17 build and tests were green with a byte-identical bundle, but `ng version` reports `Node: 24.19.0 (Unsupported)`. Angular CLI 19 hardcodes `SUPPORTED_NODE_MAJORS = [18, 20, 22]` (`@angular/cli/src/commands/version/cli.js`), stricter than its `engines` (`>=22.0.0`). CLI 20 lists `[20, 22, 24]`. Decision: Node 22 now, Node 24 in a later stage on Angular 20+.
- T2 (inline): Node 22.23.4 / npm 10.9.9; `.nvmrc` = 22; `engines.node` = `^22.12.0`. `npm ci` clean: no `EBADENGINE` (the rx-angular `minimatch@10` warning from stage 05 is gone), lockfile unchanged.
- T3 (inline): 76/76 green, coverage unchanged (57.41 / 74 / 51.82 / 55.36). Prod build 2.8 / 2.4 / 2.4 s. Initial total 333.23 kB raw / 94.20 kB transfer (byte-identical to Node 18; same `main` / `polyfills` hashes). `ng version` shows `Node: 22.23.4` without warning. `ng update` runs without `NG_DISABLE_VERSION_CHECK`; it lists Angular 20.3.9 and rx-angular 22.0.0.

- T4 (delegated writer): wrote `docs/migration-log/en/06-upgrade-node-22.md` and `docs/migration-log/es/06-upgrade-node-22.md`; updated `README.md` (stage 06 row, Node 22 requirement) and `PROJECT_CONTEXT.md` (Node row, stage 06 row, Node 22 over 24 decision, next step).

## Follow-ups (out of scope)

- Node 24 once on Angular 20+ (Node 22 maintenance LTS ends April 2027).
- `npm audit`: 65 findings (2 critical) in the dependency tree; pre-existing, not caused by this stage.

## Next step

Done. Merged into `main` (`a29ddbe`), tagged `v19-node22`; CI green on GitHub (Node 22.23.4, 76/76).
