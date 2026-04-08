# Testing Guide for oh-my-openclaw (OmOC)

## Quick Start

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test src/commands/handlers.test.ts

# Run in watch mode (during development)
bun test --watch
```

## Test Categories

### 1. Unit Tests (99+ tests)

**Already implemented and passing:**

- Config validation and merging
- Agent registry and permissions
- State management (sessions, tasks, workers)
- Tool delegation and routing
- Command handlers

**Run:**

```bash
bun test
```

**Expected output:**

```
✓ src/config/index.test.ts (15 tests)
✓ src/agents/registry.test.ts (42 tests)
✓ src/state/file-state-manager.test.ts (8 tests)
✓ src/commands/handlers.test.ts (28 tests)
✓ ... (all passing)
```

### 2. Manual Testing

#### Setup Test Environment

```bash
# Create a test directory
mkdir omoc-test && cd omoc-test

# Initialize git repo
git init

# Create a simple test file
echo 'console.log("hello")' > index.js

# Stage and commit
git add . && git commit -m "initial"
```

#### Test Standalone Mode

```bash
# From the omoc-test directory

# 1. Initialize OmOC
bun run /path/to/oh-my-openclaw/src/cli/setup.ts

# Verify .omoc/ directory created
ls -la .omoc/
# Should see: state/, plans/, config.json, worktrees/

# 2. Run doctor
bun run /path/to/oh-my-openclaw/src/cli/doctor.ts

# Expected: All checks pass

# 3. Test /loop command (simulated)
# In a real OpenClaw environment, you would type: /loop add a README

# For testing, call the command directly:
bun -e "
import { LoopCommand } from '/path/to/oh-my-openclaw/src/commands/handlers.ts';
import { FileStateManager } from '/path/to/oh-my-openclaw/src/state/file-state-manager.ts';

const cmd = new LoopCommand();
const state = new FileStateManager('.omoc');
const result = await cmd.execute(
  { sessionId: 'test', userId: 'user1', channelId: 'ch1', args: ['add', 'a', 'README'] },
  state
);
console.log(result);
"
```

#### Test Commands

**Test /status:**

```bash
bun -e "
import { StatusCommand } from '/path/to/oh-my-openclaw/src/commands/handlers.ts';
import { FileStateManager } from '/path/to/oh-my-openclaw/src/state/file-state-manager.ts';

const cmd = new StatusCommand();
const state = new FileStateManager('.omoc');
const result = await cmd.execute(
  { sessionId: 'test', userId: 'user1', channelId: 'ch1', args: [] },
  state
);
console.log(result.message);
"
```

**Test /plan:**

```bash
bun -e "
import { PlanCommand } from '/path/to/oh-my-openclaw/src/commands/handlers.ts';
import { FileStateManager } from '/path/to/oh-my-openclaw/src/state/file-state-manager.ts';

const cmd = new PlanCommand();
const state = new FileStateManager('.omoc');
const result = await cmd.execute(
  { sessionId: 'test', userId: 'user1', channelId: 'ch1', args: ['implement', 'auth'] },
  state
);
console.log(result.message);
console.log('Plan created:', result.data?.planId);
"
```

**Test /cancel:**

```bash
bun -e "
import { CancelCommand } from '/path/to/oh-my-openclaw/src/commands/handlers.ts';
import { FileStateManager } from '/path/to/oh-my-openclaw/src/state/file-state-manager.ts';

const cmd = new CancelCommand();
const state = new FileStateManager('.omoc');
const result = await cmd.execute(
  { sessionId: 'test', userId: 'user1', channelId: 'ch1', args: [] },
  state
);
console.log(result.message);
"
```

### 3. Integration Testing

#### Test Git Worktrees

```bash
# Create test repo
cd omoc-test

# Test worktree creation (via WorktreeManager)
bun -e "
import { WorktreeManager } from '/path/to/oh-my-openclaw/src/execution/worktree.ts';

const wm = new WorktreeManager('.omoc/worktrees');
const info = await wm.createWorktree('test-worker-1', 'omoc/test-branch');
console.log('Worktree created:', info.path);

// Verify worktree exists
const { execSync } = require('child_process');
const worktrees = execSync('git worktree list', { encoding: 'utf8' });
console.log('Worktrees:', worktrees);
"
```

#### Test State Persistence

```bash
# Test session persistence
bun -e "
import { FileStateManager } from '/path/to/oh-my-openclaw/src/state/file-state-manager.ts';

const state = new FileStateManager('.omoc');

// Create a session
const session = {
  id: 'test-session-123',
  status: 'active',
  mode: 'loop',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tasks: [],
  workers: [],
  tokenUsage: { input: 0, output: 0, costUsd: 0 },
  budget: { sessionBudgetUsd: 10, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true }
};

state.saveSession(session);
console.log('Session saved');

// Read it back
const retrieved = state.getSession('test-session-123');
console.log('Retrieved:', retrieved?.id === 'test-session-123' ? '✓ OK' : '✗ FAIL');
"
```

### 4. End-to-End Testing

#### Scenario 1: Full /loop Workflow

```bash
# Create test repo
mkdir -p /tmp/omoc-e2e && cd /tmp/omoc-e2e
git init

# Set up OmOC
bun run /path/to/oh-my-openclaw/src/cli/setup.ts

# Create a file with a "bug"
cat > calculator.js << 'EOF'
function add(a, b) {
  return a - b; // Intentional bug
}
module.exports = { add };
EOF

git add . && git commit -m "initial"

# In real usage (requires OpenClaw):
# /loop fix the bug in calculator.js

# Verify manually:
cat calculator.js
```

#### Scenario 2: /plan + /build

```bash
cd /tmp/omoc-e2e

# Create plan (simulated)
bun -e "
import { PlanCommand, BuildCommand } from '/path/to/oh-my-openclaw/src/commands/handlers.ts';
import { FileStateManager } from '/path/to/oh-my-openclaw/src/state/file-state-manager.ts';

const state = new FileStateManager('.omoc');

// Create plan
const planCmd = new PlanCommand();
const planResult = await planCmd.execute(
  { sessionId: 'test', userId: 'user1', channelId: 'ch1', args: ['add', 'user', 'authentication'] },
  state
);
console.log('Plan result:', planResult.message);

// Build plan
const buildCmd = new BuildCommand();
const buildResult = await buildCmd.execute(
  { sessionId: 'test', userId: 'user1', channelId: 'ch1', args: [] },
  state
);
console.log('Build result:', buildResult.message);
"

# Check created plan
ls -la .omoc/plans/
cat .omoc/plans/plan-latest.json
```

#### Scenario 3: Parallel Execution

```bash
cd /tmp/omoc-e2e

bun -e "
import { ParallelCommand } from '/path/to/oh-my-openclaw/src/commands/handlers.ts';
import { FileStateManager } from '/path/to/oh-my-openclaw/src/state/file-state-manager.ts';

const cmd = new ParallelCommand();
const state = new FileStateManager('.omoc');
const result = await cmd.execute(
  { sessionId: 'test', userId: 'user1', channelId: 'ch1', args: ['3', 'implement', 'endpoints'] },
  state
);
console.log(result.message);
console.log('Session ID:', result.data?.sessionId);
console.log('Workers:', result.data?.workerCount);
"
```

### 5. Testing with OpenClaw

To test with actual OpenClaw integration:

#### Option A: Local OpenClaw Instance

```bash
# If you have OpenClaw running locally:
export OPENCLAW_STATE_DIR=/tmp/omoc-e2e/.omoc
export OPENCLAW_CONFIG=/tmp/omoc-e2e/.omoc/config.toml

# Start OpenClaw with OmOC plugin
openclaw --plugin /path/to/oh-my-openclaw

# Then in OpenClaw:
# /loop fix the tests
# /status
# /cancel
```

#### Option B: MCP Server Mode

```bash
# Run OmOC as MCP server for testing
bun run /path/to/oh-my-openclaw/src/cli.ts --mcp

# Connect from Claude Desktop or other MCP client
```

### 6. Testing ClawFlint Integration

#### Test Config Bundle (requires ClawFlint API)

```bash
# Set environment variables
export CLAWFLINT_API_URL=http://localhost:3000
export CLAWFLINT_WORKER_ID=test-worker-123
export CLAWFLINT_KEY_ID=test-key
export CLAWFLINT_KEY_SECRET=test-secret

# Test config bundle fetching
bun -e "
import { ConfigBundleManager } from '/path/to/oh-my-openclaw/src/clawflint/config-bundle.ts';

const manager = new ConfigBundleManager();
const config = await manager.fetchBundle(
  process.env.CLAWFLINT_API_URL,
  { keyId: process.env.CLAWFLINT_KEY_ID, secret: process.env.CLAWFLINT_KEY_SECRET }
);

console.log('Config fetched:', config ? '✓ OK' : '✗ FAIL');
if (config) {
  console.log('Version:', config.versionNumber);
  console.log('OmOC enabled:', config.onboardConfig?.omoc?.enabled);
}
"
```

#### Test Dual-Mode Config

```bash
# Test standalone mode (no ClawFlint vars)
unset CLAWFLINT_WORKER_ID CLAWFLINT_KEY_ID

bun -e "
import { ConfigManager } from '/path/to/oh-my-openclaw/src/core/config-manager.ts';

const manager = new ConfigManager();
await manager.initialize();

console.log('Mode:', manager.getMode());
console.log('Is standalone:', manager.isStandalone());
console.log('Config project:', manager.getConfig().project.name);
"

# Test ClawFlint mode
export CLAWFLINT_WORKER_ID=test-worker
export CLAWFLINT_KEY_ID=test-key

bun -e "
import { ConfigManager } from '/path/to/oh-my-openclaw/src/core/config-manager.ts';

const manager = new ConfigManager();
console.log('Mode:', manager.getMode());
console.log('Is ClawFlint:', manager.isClawFlint());
"
```

### 7. Performance Testing

```bash
# Test with many sessions
bun -e "
import { FileStateManager } from '/path/to/oh-my-openclaw/src/state/file-state-manager.ts';
import { randomUUID } from 'crypto';

const state = new FileStateManager('.omoc');
const start = Date.now();

// Create 100 sessions
for (let i = 0; i < 100; i++) {
  state.saveSession({
    id: randomUUID(),
    status: 'active',
    mode: 'loop',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [],
    workers: [],
    tokenUsage: { input: 0, output: 0, costUsd: 0 },
    budget: { sessionBudgetUsd: 10, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true }
  });
}

const elapsed = Date.now() - start;
console.log(\`Created 100 sessions in \${elapsed}ms (\${elapsed / 100}ms per session)\`);

// Read them back
const readStart = Date.now();
const sessions = state.listSessions();
const readElapsed = Date.now() - readStart;
console.log(\`Listed \${sessions.length} sessions in \${readElapsed}ms\`);
"
```

### 8. Testing Checklist

Use this checklist to verify everything works:

#### Basic Functionality

- [ ] `bun test` passes all tests
- [ ] `bun run src/cli/doctor.ts` shows all checks pass
- [ ] `bun run src/cli/setup.ts` creates .omoc/ directory
- [ ] Configuration file loads correctly

#### Commands

- [ ] `/loop` creates a session
- [ ] `/status` shows active sessions
- [ ] `/cancel` stops a session
- [ ] `/plan` creates a plan
- [ ] `/build` executes a plan
- [ ] `/parallel` creates multiple workers

#### State Management

- [ ] Sessions persist to disk
- [ ] Tasks can be created and updated
- [ ] Workers can be registered
- [ ] State survives process restart

#### Git Integration

- [ ] Worktrees can be created
- [ ] Commits can be made
- [ ] Branches can be merged

#### Config Modes

- [ ] Standalone mode works (no ClawFlint env vars)
- [ ] ClawFlint mode detected (with env vars)
- [ ] Config loads from local file (standalone)
- [ ] Falls back to defaults if no config

#### Edge Cases

- [ ] Cancel works mid-execution
- [ ] Resume works after pause
- [ ] Handles missing config gracefully
- [ ] Validates user input
- [ ] Prevents concurrent modifications

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Run type check
        run: bun run typecheck

      - name: Run tests
        run: bun test

      - name: Run integration tests
        run: bun test:integration
```

## Debugging

### Enable Debug Logging

```bash
export DEBUG=omoc:*
bun test
```

### Check State Files

```bash
# View session state
cat .omoc/state/sessions/*.json | jq

# View task state
cat .omoc/state/tasks/*.json | jq

# View worker state
cat .omoc/state/workers/*.json | jq
```

### Trace Command Execution

```bash
# Add tracing to any command
bun --inspect run src/cli.ts

# Then open Chrome DevTools and connect
```

## Reporting Issues

When reporting bugs, include:

1. **Test case** - Minimal code to reproduce
2. **Expected behavior** - What should happen
3. **Actual behavior** - What actually happens
4. **Environment**:
   ```bash
   bun --version
   git --version
   node --version
   uname -a
   ```
5. **Logs** - Run with `DEBUG=omoc:*` and attach output

## Next Steps

After testing:

- Review test coverage: `bun test --coverage`
- Fix any failing tests
- Add tests for new features
- Run integration tests before releases
