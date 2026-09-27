---
name: principal-engineer-directive
description: Plan and verify changes in PymesHub while preserving existing behavior, tenant isolation, and reviewable diffs. Use before changing this repository's code.
---

# PymesHub engineering workflow

1. Read the current files, callers, relevant tests, and git status. Package manifests and implementation are authoritative when older stack descriptions disagree.
2. Identify the user-visible outcome and affected API contracts. Preserve the full requested scope; implement it in reviewable increments.
3. Budget the diff around the affected feature. Avoid unrelated formatting, removing working features, and replacing whole services to simplify a small fix. Reassess large diffs against the outcome rather than imposing an arbitrary line limit.
4. Verify with the relevant package's existing checks and behavioral tests. UI changes also need rendered checks at phone widths, keyboard operation, long content, and reduced motion. Report unavailable verification honestly.
5. Review the final diff for regressions and secrets before committing. Follow the repository's master-branch and pull-before-push rules. Do not deploy merely to validate a local change.

Design direction comes from the current user request and repository DESIGN.md. Existing colors and layouts are revisable design decisions, not engineering invariants.
