---
name: programer-test-init
version: 1.0.0
description: Generate a .clawgoal/TEST.md test spec for projects that are missing one, covering lint, build, and test commands with pass criteria.
tags: [programer, init, test]
requiredTools: [file, shell]
---

## Skill: Initialize Project Test Spec

When `.clawgoal/TEST.md` is missing from the project directory, generate it automatically by following these steps:

### Analysis Steps

1. **Detect available commands** (check in priority order):
   - Read `package.json` scripts and extract the following if present:
     - `lint` (code style check)
     - `build` (compile / bundle)
     - `test` / `test:unit` (automated tests)
     - `typecheck` / `type-check` (TypeScript type checking)
   - Check `Makefile` for `lint`, `build`, `test` targets
   - For Go projects (`go.mod`): use `go vet ./...` and `go build ./...`

2. **Detect package manager**:
   - `pnpm-lock.yaml` → `pnpm run <cmd>`
   - `yarn.lock` → `yarn <cmd>`
   - `package-lock.json` → `npm run <cmd>`
   - No lock file → default to `npm run <cmd>`

### Output File

Create `.clawgoal/` if it does not exist, then write `.clawgoal/TEST.md`:

```markdown
# Test Spec

## Test Commands
<!-- Execute all commands in order; all must pass to consider the task complete -->
- Lint:  `pnpm run lint`
- Build: `pnpm run build`
<!-- If a test script was detected, append: -->
<!-- - Test: `pnpm run test` -->

## Pass Criteria
All commands must exit with code 0 and produce no error-level output.
```

Only include commands that were actually detected — omit any lines where no matching script exists.
