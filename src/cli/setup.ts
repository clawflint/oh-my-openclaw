import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const AGENTS_MD_TEMPLATE = `# Project AGENTS.md

This file provides guidance to AI agents working on this project through oh-my-openclaw (OmOC).

## Execution Protocol

- Always run type checking before committing: \`bun run typecheck\`
- Run tests before marking work complete: \`bun test\`
- Follow existing code patterns and conventions
- Make minimal, focused changes

## Constraints

- Do not modify CI/CD configuration files
- Do not add unnecessary comments or docstrings
- Do not use \`any\` type or \`@ts-ignore\`
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

- Plans: \`.omoc/plans/\`
- Task records: \`.omoc/state/tasks/\`
- Session state: \`.omoc/state/sessions/\`
- Worker state: \`.omoc/state/workers/\`

## Technology Context

- Runtime: Bun
- Language: TypeScript
- Testing: Bun test runner
- Schema Validation: Zod

## Custom Rules

Add any project-specific rules here...
`;

export function scaffoldProject(basePath: string = '.'): { success: boolean; message: string; created: string[] } {
  const created: string[] = [];

  const dirs = [
    join(basePath, '.omoc'),
    join(basePath, '.omoc', 'state'),
    join(basePath, '.omoc', 'state', 'sessions'),
    join(basePath, '.omoc', 'state', 'tasks'),
    join(basePath, '.omoc', 'state', 'workers'),
    join(basePath, '.omoc', 'plans'),
    join(basePath, '.omoc', 'worktrees')
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      created.push(dir);
    }
  }

  const agentsMdPath = join(basePath, 'AGENTS.md');
  if (!existsSync(agentsMdPath)) {
    writeFileSync(agentsMdPath, AGENTS_MD_TEMPLATE);
    created.push(agentsMdPath);
  }

  const configPath = join(basePath, '.omoc', 'config.json');
  if (!existsSync(configPath)) {
    const defaultConfig = {
      $schema: 'https://clawflint.com/schemas/omoc-v1.json',
      project: {
        name: 'My Project',
        repo: 'github.com/user/repo'
      },
      modelTiers: {},
      agents: {},
      categories: {},
      workflows: {
        defaultApprovalGate: 'required',
        loopMaxIterations: 100,
        parallelMaxWorkers: 5
      },
      concurrency: {
        maxParallelWorkers: 5,
        maxBackgroundTasks: 10,
        perProviderLimit: 3,
        perModelLimit: 2,
        staleTaskTimeoutSeconds: 300
      },
      costControls: {
        sessionBudgetUsd: 10.0,
        taskBudgetUsd: 3.0,
        alertThresholdPercent: 75,
        hardStopOnBudget: true
      },
      eventRouting: {
        channels: {
          'agent-status': 'discord:CHANNEL_ID',
          'build-log': 'discord:CHANNEL_ID',
          'alerts': 'discord:CHANNEL_ID'
        },
        mentionPolicy: {
          'alerts': '@USER_ID',
          'plan.ready': '@USER_ID',
          'cost.alert': '@USER_ID'
        }
      }
    };
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    created.push(configPath);
  }

  const gitignorePath = join(basePath, '.gitignore');
  const omocEntry = '.omoc/state/';
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(omocEntry)) {
      writeFileSync(gitignorePath, content + '\n' + omocEntry + '\n');
      created.push('.gitignore (updated)');
    }
  } else {
    writeFileSync(gitignorePath, omocEntry + '\n');
    created.push('.gitignore');
  }

  return {
    success: true,
    message: `OmOC project initialized with ${created.length} files/directories`,
    created
  };
}
