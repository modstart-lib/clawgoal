---
name: programer-dev-init
version: 1.0.0
description: Generate a .clawgoal/DEV.md development spec for projects that are missing one, covering tech stack, main branch, and branch naming conventions.
tags: [programer, init, dev]
requiredTools: [file, shell]
---

## Skill: Initialize Project Dev Spec

When `.clawgoal/DEV.md` is missing from the project directory, generate it automatically by following these steps:

### Analysis Steps

1. **Detect tech stack**:
   - Check `package.json` (Node.js / frontend — read `dependencies` / `devDependencies`)
   - Check `go.mod` (Go project)
   - Check `requirements.txt` or `pyproject.toml` (Python project)
   - Check `Cargo.toml` (Rust project)
   - Check `pom.xml` / `build.gradle` (Java project)

2. **Identify main branch**:
   - Run `git remote show origin 2>/dev/null | grep 'HEAD branch'`
   - Or run `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null`
   - Default to `main` if unable to determine

3. **Detect build commands**:
   - Extract `build`, `dev`, `start` entries from `package.json` scripts
   - Or extract common targets from `Makefile`

### Output File

Create `.clawgoal/` if it does not exist, then write `.clawgoal/DEV.md`:

```markdown
# Development Spec

## Tech Stack
<!-- detected tech stack, e.g. Node.js 20 + TypeScript + Vue 3 + Vite -->

## Main Branch
<!-- main branch name, e.g. main -->

## Branch Naming Convention
- Feature: `dev/feat_<short_desc>` (e.g. `dev/feat_user_login`)
- Bug Fix: `dev/bugfix_<short_desc>` (e.g. `dev/bugfix_token_expire`)

## Key Commands
<!-- detected commands, e.g.
- Dev server: `pnpm dev`
- Build: `pnpm run build`
-->
```

Only record information that was actually detected — do not invent commands or version numbers.
