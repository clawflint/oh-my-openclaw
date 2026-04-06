# Project AGENTS.md

This file provides guidance to AI agents working on this project through oh-my-openclaw (OmOC).

## Execution Protocol

- Always run type checking before committing: `bun run typecheck`
- Run tests before marking work complete: `bun test`
- Follow existing code patterns and conventions
- Make minimal, focused changes

## Constraints

- Do not modify CI/CD configuration files
- Do not add unnecessary comments or docstrings
- Do not use `any` type or `@ts-ignore`
- Never force-push to git repositories
- Do not delete failing tests

## Verification Requirements

All code changes must pass:
- TypeScript compilation with strict mode
- All existing tests
- Lint checks
- Code formatting

## Cancellation Protocol

When work is cancelled:
1. Revert uncommitted changes
2. Delete any created branches that weren't merged
3. Clean up temporary files

## State Management

- Plans: `.omoc/plans/`
- Task records: `.omoc/state/tasks/`
- Session state: `.omoc/state/sessions/`
- Worker state: `.omoc/state/workers/`

## Technology Context

- Runtime: Bun
- Language: TypeScript
- Testing: Bun test runner
- Schema Validation: Zod

## Custom Rules

Add any project-specific rules here...
