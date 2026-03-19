# Artifact Rules

## Required Files

- `doc/plans/2026-03-19-refactor-master-plan.md`
- `doc/plans/2026-03-19-refactor-workboard.md`
- `doc/plans/2026-03-19-refactor-risks.md`
- `doc/plans/2026-03-19-refactor-decisions.md`
- `doc/plans/2026-03-19-refactor-test-matrix.md`
- `doc/plans/2026-03-19-refactor-status.md`

## Ownership

- `master-plan`: conductor
- `workboard`: conductor
- `risks`: critic
- `decisions`: conductor with critic review
- `test-matrix`: sentinel
- `status`: conductor after architect review

## Update Rules

- update `workboard` whenever ownership or status changes
- add a new risk instead of silently mutating scope
- record decisions only when the team is actually committing to them
- do not mark a wave complete until `test-matrix` has evidence
