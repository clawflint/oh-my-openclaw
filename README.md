# oh-my-openclaw (OmOC)

Multi-agent orchestration for OpenClaw. Works with any OpenClaw instance - standalone or with ClawFlint platform.

## Quick Start

### Option 1: Standalone (Any OpenClaw)

```bash
# Install
bun install @clawflint/oh-my-openclaw

# Initialize project
bunx @clawflint/oh-my-openclaw setup

# Start orchestrating
/loop fix the tests
```

### Option 2: With ClawFlint Platform

```bash
# Install via ClawFlint dashboard
# Or use BYOM (Bring Your Own Machine):
bunx @clawflint/oh-my-openclaw install-byom \
  --workspace=your-workspace-id \
  --token=your-join-token
```

## Usage Modes

OmOC automatically detects which mode to use:

### Standalone Mode (Default)

- Configuration stored locally in `.omoc/config.json`
- Self-contained operation
- Works with any OpenClaw instance
- No external dependencies

**When to use:**

- Open source projects
- Self-hosted setups
- Development/testing
- Any OpenClaw-compatible gateway

### ClawFlint Mode (Optional)

- Configuration managed via ClawFlint dashboard
- Real-time dashboard with session monitoring
- Cost tracking and budget controls
- Team collaboration features
- Automatic Fly.io provisioning (Dedicated tier)

**When to use:**

- Production deployments
- Team environments
- Need dashboard visibility
- Want managed infrastructure

## Configuration

### Standalone Config (.omoc/config.json)

```json
{
  "$schema": "https://clawflint.com/schemas/omoc-v1.json",
  "project": {
    "name": "My Project",
    "repo": "github.com/user/repo"
  },
  "workflows": {
    "defaultApprovalGate": "required",
    "loopMaxIterations": 100,
    "parallelMaxWorkers": 5
  },
  "costControls": {
    "sessionBudgetUsd": 10.0,
    "taskBudgetUsd": 3.0,
    "alertThresholdPercent": 75
  }
}
```

### Environment Variables

**Standalone Mode:**

```bash
OMOC_MODE=standalone  # Auto-detected if no ClawFlint vars
```

**ClawFlint Mode:**

```bash
CLAWFLINT_WORKER_ID=worker-123
CLAWFLINT_KEY_ID=key-abc
CLAWFLINT_KEY_SECRET=secret-xyz
CLAWFLINT_API_URL=https://api.clawflint.com
```

## Commands

### Workflow Commands

- `/run <description>` - Full autonomous pipeline with planning
- `/plan <description>` - Generate implementation plan
- `/build` - Execute existing plan
- `/loop <description>` - Single-agent persistent loop
- `/parallel N <description>` - N workers in parallel

### Control Commands

- `/status` - Show active session status
- `/pause` - Pause active session
- `/resume` - Resume paused session
- `/cancel` - Cancel with clean shutdown
- `/cleanup` - Remove stale state

### Operator Commands

- `/omoc setup` - Initialize OmOC project
- `/omoc doctor` - Run diagnostics
- `/omoc status` - Show detailed status
- `/omoc health` - Lightweight health check
- `/omoc config` - Show current configuration

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  User (Discord/Telegram/CLI)                       │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│  OpenClaw Gateway                                   │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│  oh-my-openclaw Plugin                              │
│  ┌────────────────┬─────────────────────────────┐   │
│  │ Standalone     │ ClawFlint (optional)        │   │
│  │ - Local config │ - Dashboard API             │   │
│  │ - File state   │ - Config bundles            │   │
│  │ - Self-hosted  │ - Managed infrastructure    │   │
│  └────────────────┴─────────────────────────────┘   │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│  Agent Runtime (Lead, Foreman, Builder, etc.)      │
└─────────────────────────────────────────────────────┘
```

## Agents

| Agent          | Role                   | Description                         |
| -------------- | ---------------------- | ----------------------------------- |
| **Lead**       | Strategic Orchestrator | Classifies intent, selects workflow |
| **Foreman**    | Execution Orchestrator | Manages tasks, tracks workers       |
| **Planner**    | Strategic Planner      | Creates implementation plans        |
| **Auditor**    | Plan Validator         | Gap analysis before execution       |
| **Critic**     | Plan Reviewer          | Surfaces blockers and risks         |
| **Builder**    | Primary Worker         | Standard implementations            |
| **Architect**  | Deep Worker            | Complex refactoring                 |
| **Reviewer**   | Quality Gate           | Verifies output                     |
| **Scout**      | Codebase Explorer      | Grep, search, discovery             |
| **Researcher** | Knowledge Agent        | Documentation lookup                |
| **Observer**   | Visual Analyst         | Screenshots, PDFs, UI review        |

## License

MIT - See LICENSE file
