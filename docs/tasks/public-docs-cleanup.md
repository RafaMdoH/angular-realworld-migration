# Public docs cleanup

## Objective

Prepare the repository documentation for public release: migration logs read as engineering decision records, task documents read as engineering checklists, and personal study material lives outside the repository.

## Problem

The migration logs mixed engineering records with personal study material (practice questions, feature study pointers, teaching analogies). Task documents contained internal tooling jargon (per-task execution routes, automated review metadata, opaque finding IDs).

## Scope

- `docs/migration-log/{es,en}/00..04-*.md`: keep, retitle, or move each section out of the repository per the approved section mapping.
- Moved material is preserved verbatim outside the repository before removal.
- `docs/tasks/*.md` and `PROJECT_CONTEXT.md`: remove tooling jargon.
- Out of scope: rewriting existing commit history now (planned for publish time), merging this branch (pending user review).

## Tasks

- [x] T1 Move `odd/tasks/` → `docs/tasks/`, update references
- [x] T2 Move study-only sections out of the repository; retitle/trim kept sections in all 10 logs
- [x] T3 Remove tooling jargon from `docs/tasks/*.md` and `PROJECT_CONTEXT.md`
- [x] T4 Verify moved content, leftover keywords, es/en parity, formatting

## Acceptance criteria

- No personal study material in the repository.
- Diagnosis, findings, metrics, upstream comparison, mutation evidence and AI-assistance notes are preserved.
- Moved material preserved in full outside the repository.

## Verification

- Every moved section found verbatim at its destination (distinctive-sentence `grep -F` against the `HEAD` originals).
- Keyword scan over `docs/` and `PROJECT_CONTEXT.md`: no leftover study-prep wording, routes, review metadata or opaque IDs.
- es/en heading counts equal for all five logs (16, 11, 9, 9, 13).
- `prettier --check`: clean.
- T2/T3 drafted by an AI agent; re-verified independently against git.

## Next step

User reviews branch `docs/public-cleanup`; merge only after approval.
