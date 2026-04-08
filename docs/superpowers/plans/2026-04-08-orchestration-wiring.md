# OmOC Orchestration Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire OmOC's agent registry and model tiers to OpenClaw's `api.runtime.subagent` API so `omoc_delegate` spawns real subagents and `/run` executes a full classify→plan→build→review pipeline.

**Architecture:** Three new modules — SubagentBridge (spawns agents via OpenClaw API), CategoryRouter (maps categories to agents/models), RunPipeline (chains agents through structured stages). All integrate through `openclaw-entry.ts` which captures the `api` object during plugin registration.

**Tech Stack:** TypeScript, Bun, Vitest, OpenClaw Plugin SDK (`api.runtime.subagent`)

---

## File Structure

```
src/
  bridge/
    subagent-bridge.ts      # Core: spawn OmOC agents as OpenClaw subagents
    subagent-bridge.test.ts  # Tests for bridge
    model-resolver.ts        # Resolve model from tier + fallbacks
    model-resolver.test.ts   # Tests for resolver
    category-router.ts       # Map category → agent role
    category-router.test.ts  # Tests for router
  pipeline/
    run-pipeline.ts          # /run command: classify→plan→build→review
    run-pipeline.test.ts     # Tests for pipeline
    cost-tracker.ts          # Track token spend across stages
    cost-tracker.test.ts     # Tests for cost tracker
  openclaw-entry.ts          # MODIFY: wire real delegate + /run command
```

---

### Task 1: Model Resolver

**Files:**
- Create: `src/bridge/model-resolver.ts`
- Create: `src/bridge/model-resolver.test.ts`
- Reference: `src/config/index.ts:79-97` (DEFAULT_MODEL_TIERS)
- Reference: `src/types/index.ts:36` (ModelTier type)

- [ ] **Step 1: Write failing test for resolveModel**

```typescript
// src/bridge/model-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveModel } from './model-resolver.js';

describe('resolveModel', () => {
  it('returns primary model for tier_1', () => {
    const result = resolveModel('tier_1');
    expect(result).toBe('anthropic/claude-opus-4-6');
  });

  it('returns primary model for tier_2', () => {
    const result = resolveModel('tier_2');
    expect(result).toBe('anthropic/claude-sonnet-4-6');
  });

  it('returns primary model for tier_3', () => {
    const result = resolveModel('tier_3');
    expect(result).toBe('google/gemini-3-flash');
  });

  it('returns primary model for multimodal', () => {
    const result = resolveModel('multimodal');
    expect(result).toBe('google/gemini-3.1-pro');
  });

  it('returns fallback when primary is in unavailable list', () => {
    const result = resolveModel('tier_1', ['anthropic/claude-opus-4-6']);
    expect(result).toBe('openai/gpt-5.4');
  });

  it('returns second fallback when primary and first fallback unavailable', () => {
    const result = resolveModel('tier_1', [
      'anthropic/claude-opus-4-6',
      'openai/gpt-5.4',
    ]);
    expect(result).toBe('google/gemini-3.1-pro');
  });

  it('accepts custom model tiers override', () => {
    const custom = {
      tier_1: { model: 'custom/model', fallback: ['backup/model'] },
      tier_2: { model: 'anthropic/claude-sonnet-4-6', fallback: [] },
      tier_3: { model: 'google/gemini-3-flash', fallback: [] },
      multimodal: { model: 'google/gemini-3.1-pro', fallback: [] },
    };
    const result = resolveModel('tier_1', [], custom);
    expect(result).toBe('custom/model');
  });

  it('throws when all models unavailable', () => {
    expect(() =>
      resolveModel('tier_3', ['google/gemini-3-flash', 'openai/gpt-5-nano'])
    ).toThrow('No available model');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test src/bridge/model-resolver.test.ts`
Expected: FAIL — module `./model-resolver.js` not found

- [ ] **Step 3: Implement model-resolver.ts**

```typescript
// src/bridge/model-resolver.ts
import { DEFAULT_MODEL_TIERS } from '../config/index.js';
import type { ModelTier, ModelConfig } from '../types/index.js';

export function resolveModel(
  tier: ModelTier,
  unavailable: string[] = [],
  customTiers?: Record<ModelTier, Pick<ModelConfig, 'model' | 'fallback'>>
): string {
  const tiers = customTiers || DEFAULT_MODEL_TIERS;
  const tierConfig = tiers[tier];

  if (!unavailable.includes(tierConfig.model)) {
    return tierConfig.model;
  }

  for (const fallback of tierConfig.fallback) {
    if (!unavailable.includes(fallback)) {
      return fallback;
    }
  }

  throw new Error(
    `No available model for ${tier}. Primary: ${tierConfig.model}, fallbacks: ${tierConfig.fallback.join(', ')}. All unavailable.`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test src/bridge/model-resolver.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/engmsaleh/Repos/oh-my-openclaw && git add src/bridge/model-resolver.ts src/bridge/model-resolver.test.ts && git commit -m "feat(bridge): model resolver with tier-based fallback chains"
```

---

### Task 2: Category Router

**Files:**
- Create: `src/bridge/category-router.ts`
- Create: `src/bridge/category-router.test.ts`
- Reference: `src/config/index.ts:99-107` (DEFAULT_CATEGORIES)
- Reference: `src/agents/registry.ts` (AGENT_REGISTRY)

- [ ] **Step 1: Write failing test for routeCategory**

```typescript
// src/bridge/category-router.test.ts
import { describe, it, expect } from 'vitest';
import { routeCategory, CATEGORY_TO_AGENT } from './category-router.js';

describe('CATEGORY_TO_AGENT', () => {
  it('maps quick to builder', () => {
    expect(CATEGORY_TO_AGENT.quick).toBe('builder');
  });

  it('maps deep to architect', () => {
    expect(CATEGORY_TO_AGENT.deep).toBe('architect');
  });

  it('maps strategic to planner', () => {
    expect(CATEGORY_TO_AGENT.strategic).toBe('planner');
  });

  it('maps visual to observer', () => {
    expect(CATEGORY_TO_AGENT.visual).toBe('observer');
  });

  it('maps research to researcher', () => {
    expect(CATEGORY_TO_AGENT.research).toBe('researcher');
  });
});

describe('routeCategory', () => {
  it('returns agent role and model for a category', () => {
    const result = routeCategory('quick');
    expect(result.agent).toBe('builder');
    expect(result.model).toBe('anthropic/claude-sonnet-4-6');
    expect(result.tier).toBe('tier_2');
  });

  it('returns architect with tier_1 model for deep', () => {
    const result = routeCategory('deep');
    expect(result.agent).toBe('architect');
    expect(result.model).toBe('anthropic/claude-opus-4-6');
    expect(result.tier).toBe('tier_1');
  });

  it('returns observer with multimodal model for visual', () => {
    const result = routeCategory('visual');
    expect(result.agent).toBe('observer');
    expect(result.model).toBe('google/gemini-3.1-pro');
    expect(result.tier).toBe('multimodal');
  });

  it('allows explicit agent override', () => {
    const result = routeCategory('quick', 'architect');
    expect(result.agent).toBe('architect');
    expect(result.model).toBe('anthropic/claude-opus-4-6');
    expect(result.tier).toBe('tier_1');
  });

  it('falls back to builder for unknown categories', () => {
    const result = routeCategory('unknown-custom-category');
    expect(result.agent).toBe('builder');
    expect(result.tier).toBe('tier_2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test src/bridge/category-router.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement category-router.ts**

```typescript
// src/bridge/category-router.ts
import { AGENT_REGISTRY } from '../agents/index.js';
import { resolveModel } from './model-resolver.js';
import type { AgentRole, WorkCategory, ModelTier } from '../types/index.js';

export const CATEGORY_TO_AGENT: Record<string, AgentRole> = {
  quick: 'builder',
  standard: 'builder',
  deep: 'architect',
  strategic: 'planner',
  visual: 'observer',
  research: 'researcher',
  creative: 'builder',
};

export interface RouteResult {
  agent: AgentRole;
  model: string;
  tier: ModelTier;
  persona: string;
}

export function routeCategory(
  category: WorkCategory,
  explicitAgent?: AgentRole
): RouteResult {
  const agent = explicitAgent || CATEGORY_TO_AGENT[category] || 'builder';
  const agentConfig = AGENT_REGISTRY[agent];
  const tier = agentConfig.defaultTier;
  const model = resolveModel(tier);

  return {
    agent,
    model,
    tier,
    persona: agentConfig.systemPrompt,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test src/bridge/category-router.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/engmsaleh/Repos/oh-my-openclaw && git add src/bridge/category-router.ts src/bridge/category-router.test.ts && git commit -m "feat(bridge): category router maps work categories to agents and models"
```

---

### Task 3: Cost Tracker

**Files:**
- Create: `src/pipeline/cost-tracker.ts`
- Create: `src/pipeline/cost-tracker.test.ts`
- Reference: `src/types/index.ts:166-178` (TokenUsage, BudgetConfig)

- [ ] **Step 1: Write failing test**

```typescript
// src/pipeline/cost-tracker.test.ts
import { describe, it, expect } from 'vitest';
import { CostTracker } from './cost-tracker.js';

describe('CostTracker', () => {
  it('starts with zero usage', () => {
    const tracker = new CostTracker({ sessionBudgetUsd: 10, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true });
    expect(tracker.getTotalCost()).toBe(0);
    expect(tracker.isOverBudget()).toBe(false);
  });

  it('tracks token usage and estimates cost', () => {
    const tracker = new CostTracker({ sessionBudgetUsd: 10, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true });
    tracker.recordUsage('builder', { input: 1000, output: 500, costUsd: 0.005 });
    expect(tracker.getTotalCost()).toBe(0.005);
    expect(tracker.getUsageByAgent('builder')).toEqual({ input: 1000, output: 500, costUsd: 0.005 });
  });

  it('detects budget exceeded when hardStop is true', () => {
    const tracker = new CostTracker({ sessionBudgetUsd: 0.01, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true });
    tracker.recordUsage('builder', { input: 100000, output: 50000, costUsd: 0.02 });
    expect(tracker.isOverBudget()).toBe(true);
  });

  it('detects alert threshold', () => {
    const tracker = new CostTracker({ sessionBudgetUsd: 1.0, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: false });
    tracker.recordUsage('architect', { input: 50000, output: 25000, costUsd: 0.80 });
    expect(tracker.isAlertThreshold()).toBe(true);
    expect(tracker.isOverBudget()).toBe(false);
  });

  it('returns summary report', () => {
    const tracker = new CostTracker({ sessionBudgetUsd: 10, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true });
    tracker.recordUsage('lead', { input: 500, output: 200, costUsd: 0.01 });
    tracker.recordUsage('builder', { input: 2000, output: 1000, costUsd: 0.03 });
    const summary = tracker.getSummary();
    expect(summary.totalCost).toBe(0.04);
    expect(summary.agentBreakdown).toHaveLength(2);
    expect(summary.budgetRemaining).toBe(9.96);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test src/pipeline/cost-tracker.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement cost-tracker.ts**

```typescript
// src/pipeline/cost-tracker.ts
import type { AgentRole, TokenUsage, CostControlsConfig } from '../types/index.js';

interface AgentUsage {
  input: number;
  output: number;
  costUsd: number;
}

export interface CostSummary {
  totalCost: number;
  budgetRemaining: number;
  budgetPercent: number;
  agentBreakdown: Array<{ agent: string; cost: number; tokens: { input: number; output: number } }>;
}

export class CostTracker {
  private budget: CostControlsConfig;
  private usage: Map<string, AgentUsage> = new Map();

  constructor(budget: CostControlsConfig) {
    this.budget = budget;
  }

  recordUsage(agent: AgentRole | string, tokens: TokenUsage): void {
    const existing = this.usage.get(agent) || { input: 0, output: 0, costUsd: 0 };
    this.usage.set(agent, {
      input: existing.input + tokens.input,
      output: existing.output + tokens.output,
      costUsd: existing.costUsd + tokens.costUsd,
    });
  }

  getTotalCost(): number {
    let total = 0;
    for (const u of this.usage.values()) total += u.costUsd;
    return total;
  }

  getUsageByAgent(agent: string): AgentUsage | undefined {
    return this.usage.get(agent);
  }

  isOverBudget(): boolean {
    return this.budget.hardStopOnBudget && this.getTotalCost() > this.budget.sessionBudgetUsd;
  }

  isAlertThreshold(): boolean {
    const percent = (this.getTotalCost() / this.budget.sessionBudgetUsd) * 100;
    return percent >= this.budget.alertThresholdPercent;
  }

  getSummary(): CostSummary {
    const totalCost = this.getTotalCost();
    const agentBreakdown: CostSummary['agentBreakdown'] = [];
    for (const [agent, u] of this.usage.entries()) {
      agentBreakdown.push({ agent, cost: u.costUsd, tokens: { input: u.input, output: u.output } });
    }
    return {
      totalCost,
      budgetRemaining: this.budget.sessionBudgetUsd - totalCost,
      budgetPercent: (totalCost / this.budget.sessionBudgetUsd) * 100,
      agentBreakdown,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test src/pipeline/cost-tracker.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/engmsaleh/Repos/oh-my-openclaw && git add src/pipeline/cost-tracker.ts src/pipeline/cost-tracker.test.ts && git commit -m "feat(pipeline): cost tracker with budget enforcement and per-agent breakdown"
```

---

### Task 4: Subagent Bridge

**Files:**
- Create: `src/bridge/subagent-bridge.ts`
- Create: `src/bridge/subagent-bridge.test.ts`
- Reference: `src/agents/registry.ts` (AGENT_REGISTRY)
- Reference: `src/bridge/model-resolver.ts` (resolveModel)
- Reference: `src/bridge/category-router.ts` (routeCategory)

- [ ] **Step 1: Write failing test with mocked API**

```typescript
// src/bridge/subagent-bridge.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SubagentBridge } from './subagent-bridge.js';

function createMockApi() {
  return {
    runtime: {
      subagent: {
        run: vi.fn().mockResolvedValue({ runId: 'run-123' }),
        waitForRun: vi.fn().mockResolvedValue({ status: 'completed', tokenStats: { input: 500, output: 200 } }),
        getSessionMessages: vi.fn().mockResolvedValue([{ text: 'Task completed successfully.' }]),
        deleteSession: vi.fn().mockResolvedValue(undefined),
      },
    },
  };
}

describe('SubagentBridge', () => {
  it('spawns a builder agent with tier_2 model', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);

    const result = await bridge.spawn('builder', 'Fix the login bug');

    expect(api.runtime.subagent.run).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'anthropic/claude-sonnet-4-6',
        deliver: false,
      })
    );
    expect(result.response).toBe('Task completed successfully.');
    expect(result.runId).toBe('run-123');
  });

  it('spawns a lead agent with tier_1 model', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);

    await bridge.spawn('lead', 'Classify this intent');

    expect(api.runtime.subagent.run).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'anthropic/claude-opus-4-6',
      })
    );
  });

  it('spawns a scout agent with tier_3 model', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);

    await bridge.spawn('scout', 'Find all auth files');

    expect(api.runtime.subagent.run).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'google/gemini-3-flash',
      })
    );
  });

  it('includes agent persona in the message', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);

    await bridge.spawn('reviewer', 'Check the code quality');

    const callArgs = api.runtime.subagent.run.mock.calls[0][0];
    expect(callArgs.message).toContain('You are Reviewer');
    expect(callArgs.message).toContain('Check the code quality');
  });

  it('uses unique session keys per spawn', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);

    await bridge.spawn('builder', 'Task 1');
    await bridge.spawn('builder', 'Task 2');

    const key1 = api.runtime.subagent.run.mock.calls[0][0].sessionKey;
    const key2 = api.runtime.subagent.run.mock.calls[1][0].sessionKey;
    expect(key1).not.toBe(key2);
    expect(key1).toContain('builder');
    expect(key2).toContain('builder');
  });

  it('waits for completion with configurable timeout', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);

    await bridge.spawn('builder', 'Task', { timeout: 30000 });

    expect(api.runtime.subagent.waitForRun).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 30000 })
    );
  });

  it('spawns by category via spawnByCategory', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);

    const result = await bridge.spawnByCategory('deep', 'Refactor the auth system');

    expect(api.runtime.subagent.run).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'anthropic/claude-opus-4-6', // architect = tier_1
      })
    );
    expect(result.agent).toBe('architect');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test src/bridge/subagent-bridge.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement subagent-bridge.ts**

```typescript
// src/bridge/subagent-bridge.ts
import { AGENT_REGISTRY } from '../agents/index.js';
import { resolveModel } from './model-resolver.js';
import { routeCategory } from './category-router.js';
import type { AgentRole, WorkCategory, ModelTier } from '../types/index.js';

interface SubagentApi {
  runtime: {
    subagent: {
      run(params: {
        sessionKey: string;
        message: string;
        model?: string;
        deliver?: boolean;
      }): Promise<{ runId: string }>;
      waitForRun(params: {
        runId: string;
        timeoutMs?: number;
      }): Promise<{ status: string; tokenStats?: { input: number; output: number } }>;
      getSessionMessages(params: {
        sessionKey: string;
        limit?: number;
      }): Promise<Array<{ text: string }>>;
      deleteSession(params: { sessionKey: string }): Promise<void>;
    };
  };
}

export interface SpawnResult {
  runId: string;
  sessionKey: string;
  agent: AgentRole;
  model: string;
  response: string;
  tokens: { input: number; output: number };
}

export interface SpawnOptions {
  category?: WorkCategory;
  timeout?: number;
  background?: boolean;
}

let spawnCounter = 0;

function makeSessionKey(role: AgentRole): string {
  spawnCounter++;
  const ts = Date.now().toString(36);
  return `agent:main:omoc:${role}-${ts}-${spawnCounter}`;
}

export class SubagentBridge {
  private api: SubagentApi;

  constructor(api: SubagentApi) {
    this.api = api;
  }

  async spawn(role: AgentRole, task: string, options?: SpawnOptions): Promise<SpawnResult> {
    const agentConfig = AGENT_REGISTRY[role];
    const model = resolveModel(agentConfig.defaultTier);
    const sessionKey = makeSessionKey(role);
    const timeout = options?.timeout || 120000;

    const message = `${agentConfig.systemPrompt}\n\n---\n\nTask: ${task}`;

    const { runId } = await this.api.runtime.subagent.run({
      sessionKey,
      message,
      model,
      deliver: false,
    });

    const completion = await this.api.runtime.subagent.waitForRun({
      runId,
      timeoutMs: timeout,
    });

    const messages = await this.api.runtime.subagent.getSessionMessages({
      sessionKey,
      limit: 1,
    });

    const responseText = messages.length > 0 ? messages[0].text : '(no response)';
    const tokens = completion.tokenStats || { input: 0, output: 0 };

    return {
      runId,
      sessionKey,
      agent: role,
      model,
      response: responseText,
      tokens,
    };
  }

  async spawnByCategory(
    category: WorkCategory,
    task: string,
    options?: SpawnOptions
  ): Promise<SpawnResult> {
    const route = routeCategory(category);
    const result = await this.spawn(route.agent, task, options);
    return { ...result, agent: route.agent };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test src/bridge/subagent-bridge.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/engmsaleh/Repos/oh-my-openclaw && git add src/bridge/subagent-bridge.ts src/bridge/subagent-bridge.test.ts && git commit -m "feat(bridge): subagent bridge spawns OmOC agents via OpenClaw runtime API"
```

---

### Task 5: Run Pipeline

**Files:**
- Create: `src/pipeline/run-pipeline.ts`
- Create: `src/pipeline/run-pipeline.test.ts`
- Reference: `src/bridge/subagent-bridge.ts` (SubagentBridge)
- Reference: `src/pipeline/cost-tracker.ts` (CostTracker)

- [ ] **Step 1: Write failing test**

```typescript
// src/pipeline/run-pipeline.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runPipeline } from './run-pipeline.js';
import type { SubagentBridge, SpawnResult } from '../bridge/subagent-bridge.js';
import type { CostControlsConfig } from '../types/index.js';

function makeSpawnResult(agent: string, response: string): SpawnResult {
  return {
    runId: `run-${agent}`,
    sessionKey: `agent:main:omoc:${agent}-test`,
    agent: agent as any,
    model: 'test-model',
    response,
    tokens: { input: 500, output: 200 },
  };
}

function createMockBridge(): SubagentBridge {
  const responses: Record<string, string> = {
    lead: JSON.stringify({ intent: 'implement', complexity: 'standard', plan: 'Add the endpoint' }),
    planner: '## Plan\n1. Create route handler\n2. Add tests\n3. Wire to router',
    builder: 'Implementation complete. Added /hello endpoint.',
    reviewer: 'APPROVED. Tests pass, code follows conventions.',
  };
  return {
    spawn: vi.fn().mockImplementation((role: string, task: string) =>
      Promise.resolve(makeSpawnResult(role, responses[role] || 'done'))
    ),
    spawnByCategory: vi.fn(),
  } as any;
}

const budget: CostControlsConfig = {
  sessionBudgetUsd: 10,
  taskBudgetUsd: 3,
  alertThresholdPercent: 75,
  hardStopOnBudget: true,
};

describe('runPipeline', () => {
  it('executes classify→plan→build→review stages', async () => {
    const bridge = createMockBridge();
    const result = await runPipeline(bridge, 'Add a /hello endpoint', budget);

    expect(result.status).toBe('completed');
    expect(result.stages).toHaveLength(4);
    expect(result.stages[0].stage).toBe('classify');
    expect(result.stages[0].agent).toBe('lead');
    expect(result.stages[1].stage).toBe('plan');
    expect(result.stages[1].agent).toBe('planner');
    expect(result.stages[2].stage).toBe('build');
    expect(result.stages[2].agent).toBe('builder');
    expect(result.stages[3].stage).toBe('review');
    expect(result.stages[3].agent).toBe('reviewer');
  });

  it('calls bridge.spawn with correct agents', async () => {
    const bridge = createMockBridge();
    await runPipeline(bridge, 'Fix the bug', budget);

    const calls = (bridge.spawn as any).mock.calls;
    expect(calls[0][0]).toBe('lead');
    expect(calls[1][0]).toBe('planner');
    expect(calls[2][0]).toBe('builder');
    expect(calls[3][0]).toBe('reviewer');
  });

  it('passes plan output to builder', async () => {
    const bridge = createMockBridge();
    await runPipeline(bridge, 'Add feature', budget);

    const builderCall = (bridge.spawn as any).mock.calls[2];
    expect(builderCall[1]).toContain('Plan');
  });

  it('reports total cost from all stages', async () => {
    const bridge = createMockBridge();
    const result = await runPipeline(bridge, 'Add feature', budget);

    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.summary).toBeDefined();
  });

  it('fails if budget exceeded mid-pipeline', async () => {
    const tinyBudget: CostControlsConfig = {
      sessionBudgetUsd: 0.001,
      taskBudgetUsd: 0.001,
      alertThresholdPercent: 50,
      hardStopOnBudget: true,
    };
    const bridge = createMockBridge();
    // Override to return high cost
    (bridge.spawn as any).mockImplementation((role: string) =>
      Promise.resolve({
        ...makeSpawnResult(role, 'done'),
        tokens: { input: 100000, output: 50000 },
      })
    );

    const result = await runPipeline(bridge, 'Expensive task', tinyBudget);
    expect(result.status).toBe('failed');
    expect(result.summary).toContain('budget');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test src/pipeline/run-pipeline.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement run-pipeline.ts**

```typescript
// src/pipeline/run-pipeline.ts
import type { SubagentBridge, SpawnResult } from '../bridge/subagent-bridge.js';
import { CostTracker } from './cost-tracker.js';
import type { AgentRole, CostControlsConfig } from '../types/index.js';

export interface StageResult {
  stage: string;
  agent: AgentRole;
  model: string;
  response: string;
  durationMs: number;
  tokens: { input: number; output: number };
}

export interface PipelineResult {
  status: 'completed' | 'failed';
  stages: StageResult[];
  summary: string;
  totalTokens: number;
  totalCost: number;
}

// Rough cost estimates per 1K tokens (USD)
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'anthropic/claude-opus-4-6': { input: 0.015, output: 0.075 },
  'anthropic/claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'google/gemini-3-flash': { input: 0.0001, output: 0.0004 },
  'google/gemini-3.1-pro': { input: 0.00125, output: 0.005 },
};

function estimateCost(model: string, tokens: { input: number; output: number }): number {
  const rates = COST_PER_1K[model] || { input: 0.003, output: 0.015 };
  return (tokens.input / 1000) * rates.input + (tokens.output / 1000) * rates.output;
}

async function runStage(
  bridge: SubagentBridge,
  stageName: string,
  agent: AgentRole,
  task: string,
  costTracker: CostTracker
): Promise<StageResult> {
  const start = Date.now();
  const result: SpawnResult = await bridge.spawn(agent, task);
  const durationMs = Date.now() - start;

  const cost = estimateCost(result.model, result.tokens);
  costTracker.recordUsage(agent, { ...result.tokens, costUsd: cost });

  return {
    stage: stageName,
    agent,
    model: result.model,
    response: result.response,
    durationMs,
    tokens: result.tokens,
  };
}

export async function runPipeline(
  bridge: SubagentBridge,
  taskDescription: string,
  budget: CostControlsConfig
): Promise<PipelineResult> {
  const costTracker = new CostTracker(budget);
  const stages: StageResult[] = [];

  // Stage 1: Classify
  const classify = await runStage(
    bridge,
    'classify',
    'lead',
    `Classify this task and return a JSON object with fields: intent (explain|implement|investigate|refactor|evaluate|operate), complexity (quick|standard|deep), and plan (one-sentence summary).\n\nTask: ${taskDescription}`,
    costTracker
  );
  stages.push(classify);

  if (costTracker.isOverBudget()) {
    return { status: 'failed', stages, summary: 'Pipeline halted: session budget exceeded after classify stage.', totalTokens: 0, totalCost: costTracker.getTotalCost() };
  }

  // Stage 2: Plan
  const plan = await runStage(
    bridge,
    'plan',
    'planner',
    `Create a phased implementation plan for this task. Be specific about files to change and acceptance criteria.\n\nTask: ${taskDescription}\n\nClassification: ${classify.response}`,
    costTracker
  );
  stages.push(plan);

  if (costTracker.isOverBudget()) {
    return { status: 'failed', stages, summary: 'Pipeline halted: session budget exceeded after plan stage.', totalTokens: 0, totalCost: costTracker.getTotalCost() };
  }

  // Stage 3: Build
  const build = await runStage(
    bridge,
    'build',
    'builder',
    `Execute this plan. Make the changes, write tests, commit your work.\n\nPlan:\n${plan.response}\n\nOriginal task: ${taskDescription}`,
    costTracker
  );
  stages.push(build);

  if (costTracker.isOverBudget()) {
    return { status: 'failed', stages, summary: 'Pipeline halted: session budget exceeded after build stage.', totalTokens: 0, totalCost: costTracker.getTotalCost() };
  }

  // Stage 4: Review
  const review = await runStage(
    bridge,
    'review',
    'reviewer',
    `Review the implementation below. Check for correctness, test coverage, and code quality. Respond with APPROVED or REJECTED with specific feedback.\n\nImplementation report:\n${build.response}\n\nOriginal task: ${taskDescription}`,
    costTracker
  );
  stages.push(review);

  const summary = costTracker.getSummary();
  const totalTokens = stages.reduce((sum, s) => sum + s.tokens.input + s.tokens.output, 0);

  return {
    status: 'completed',
    stages,
    summary: `Pipeline completed: ${stages.length} stages, ${totalTokens} tokens, $${summary.totalCost.toFixed(4)} cost. Review: ${review.response.substring(0, 100)}`,
    totalTokens,
    totalCost: summary.totalCost,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test src/pipeline/run-pipeline.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/engmsaleh/Repos/oh-my-openclaw && git add src/pipeline/run-pipeline.ts src/pipeline/run-pipeline.test.ts && git commit -m "feat(pipeline): run pipeline chains classify→plan→build→review with cost tracking"
```

---

### Task 6: Wire openclaw-entry.ts

**Files:**
- Modify: `src/openclaw-entry.ts`
- Reference: all bridge and pipeline modules

- [ ] **Step 1: Write failing test for the wired delegate tool**

```typescript
// src/bridge/openclaw-integration.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SubagentBridge } from './subagent-bridge.js';
import { routeCategory } from './category-router.js';
import { resolveModel } from './model-resolver.js';

describe('integration: delegate routing', () => {
  it('routes quick category to builder with sonnet', () => {
    const route = routeCategory('quick');
    expect(route.agent).toBe('builder');
    expect(route.model).toBe('anthropic/claude-sonnet-4-6');
  });

  it('routes deep category to architect with opus', () => {
    const route = routeCategory('deep');
    expect(route.agent).toBe('architect');
    expect(route.model).toBe('anthropic/claude-opus-4-6');
  });

  it('routes research category to researcher with flash', () => {
    const route = routeCategory('research');
    expect(route.agent).toBe('researcher');
    expect(route.model).toBe('google/gemini-3-flash');
  });

  it('resolveModel returns correct model for each tier', () => {
    expect(resolveModel('tier_1')).toBe('anthropic/claude-opus-4-6');
    expect(resolveModel('tier_2')).toBe('anthropic/claude-sonnet-4-6');
    expect(resolveModel('tier_3')).toBe('google/gemini-3-flash');
    expect(resolveModel('multimodal')).toBe('google/gemini-3.1-pro');
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (this uses already-built modules)

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test src/bridge/openclaw-integration.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 3: Update openclaw-entry.ts with real wiring**

Replace the entire `src/openclaw-entry.ts` with the wired version. Key changes:
- Import SubagentBridge, routeCategory, runPipeline
- Capture `api` in a module-level variable
- Wire `delegate` tool to `bridge.spawnByCategory()`
- Wire `summon` tool to `bridge.spawn()`
- Add `/run` command that calls `runPipeline()`
- Update `/omoc doctor` to report bridge status

```typescript
// src/openclaw-entry.ts
import { OmocPlugin } from './plugin.js';
import { AGENT_REGISTRY } from './agents/index.js';
import { OMOcPluginManifest } from './plugin/manifest.js';
import { SubagentBridge } from './bridge/subagent-bridge.js';
import { routeCategory } from './bridge/category-router.js';
import { runPipeline } from './pipeline/run-pipeline.js';
import type { AgentRole, WorkCategory } from './types/index.js';

interface OpenClawPluginApi {
  registerCommand(opts: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    handler: (ctx: CommandContext) => Promise<string | void>;
  }): void;
  registerTool?(opts: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
  }): void;
  runtime?: {
    subagent: {
      run(params: { sessionKey: string; message: string; model?: string; deliver?: boolean }): Promise<{ runId: string }>;
      waitForRun(params: { runId: string; timeoutMs?: number }): Promise<{ status: string; tokenStats?: { input: number; output: number } }>;
      getSessionMessages(params: { sessionKey: string; limit?: number }): Promise<Array<{ text: string }>>;
      deleteSession(params: { sessionKey: string }): Promise<void>;
    };
  };
}

interface CommandContext {
  args?: string;
  channel?: string;
  sender?: string;
  sessionId?: string;
  [key: string]: unknown;
}

let omocInstance: OmocPlugin | null = null;
let bridge: SubagentBridge | null = null;

async function getOmoc(): Promise<OmocPlugin> {
  if (!omocInstance) {
    omocInstance = await OmocPlugin.create({ mode: 'standalone' });
  }
  return omocInstance;
}

function register(api: OpenClawPluginApi): void {
  // Create bridge if runtime.subagent is available
  if (api.runtime?.subagent) {
    bridge = new SubagentBridge(api as any);
  }

  // Register /omoc command with subcommands
  api.registerCommand({
    name: 'omoc',
    description: 'Oh My OpenClaw - Multi-agent orchestration',
    acceptsArgs: true,
    handler: async (ctx: CommandContext) => {
      const args = ctx.args?.trim() ?? '';
      const subcommand = args.split(/\s+/)[0]?.toLowerCase() ?? 'status';
      const omoc = await getOmoc();

      switch (subcommand) {
        case 'doctor': {
          const config = omoc.getConfig();
          const mode = omoc.getMode();
          const agents = Object.keys(AGENT_REGISTRY);
          return [
            '🔧 OmOC Doctor',
            `Mode: ${mode}`,
            `Bridge: ${bridge ? 'CONNECTED (api.runtime.subagent)' : 'NOT CONNECTED (stub mode)'}`,
            `Project: ${config.project.name}`,
            `Agents: ${agents.length} registered (${agents.join(', ')})`,
            `Version: ${OMOcPluginManifest.version}`,
          ].join('\n');
        }
        case 'status': {
          const mode = omoc.getMode();
          const config = omoc.getConfig();
          return [
            '📊 OmOC Status',
            `Mode: ${mode}`,
            `Bridge: ${bridge ? 'active' : 'stub'}`,
            `Budget: $${config.costControls.sessionBudgetUsd} session / $${config.costControls.taskBudgetUsd} task`,
            `Max Workers: ${config.workflows.parallelMaxWorkers}`,
          ].join('\n');
        }
        case 'health':
          return `💚 OmOC Health: OK\nBridge: ${bridge ? 'connected' : 'disconnected'}`;
        case 'config': {
          const config = omoc.getConfig();
          return '⚙️ OmOC Config:\n' + JSON.stringify(config, null, 2).slice(0, 1000);
        }
        default:
          return [
            '🦞 Oh My OpenClaw (OmOC)',
            'Commands: /omoc doctor | status | health | config',
            'Orchestration: /run <task> | /plan <task>',
            'Delegation: delegate tool (category-based) | summon tool (by name)',
          ].join('\n');
      }
    },
  });

  // Register /run command — full pipeline
  api.registerCommand({
    name: 'run',
    description: 'Execute a task through the full OmOC pipeline (classify→plan→build→review)',
    acceptsArgs: true,
    handler: async (ctx: CommandContext) => {
      const task = ctx.args?.trim();
      if (!task) return 'Usage: /run <task description>';
      if (!bridge) return '❌ OmOC bridge not connected. api.runtime.subagent unavailable.';

      const omoc = await getOmoc();
      const result = await runPipeline(bridge, task, omoc.getConfig().costControls);

      const stageReport = result.stages
        .map((s) => `  ${s.stage}: ${s.agent} (${s.model}) — ${s.durationMs}ms`)
        .join('\n');

      return [
        `🦞 /run ${result.status === 'completed' ? '✅' : '❌'}`,
        `Task: ${task}`,
        `Stages:\n${stageReport}`,
        `Cost: $${result.totalCost.toFixed(4)} | Tokens: ${result.totalTokens}`,
        `Summary: ${result.summary}`,
      ].join('\n');
    },
  });

  // Register /omoc-status command
  api.registerCommand({
    name: 'omoc-status',
    description: 'Show OmOC orchestration status',
    handler: async () => {
      const omoc = await getOmoc();
      return `OmOC running in ${omoc.getMode()} mode | Bridge: ${bridge ? 'active' : 'stub'}`;
    },
  });

  // Register /hello command
  api.registerCommand({
    name: 'hello',
    description: 'Simple hello command for OmOC',
    handler: async () => {
      return 'Hello World! OmOC is running.';
    },
  });

  // Register delegate tool — real agent spawning
  if (api.registerTool) {
    api.registerTool({
      name: 'delegate',
      description: 'Delegate a task to a specialized OmOC agent. Routes by category to the right agent and model.',
      parameters: {
        category: { type: 'string', description: 'Work category: quick, standard, deep, strategic, visual, research, creative' },
        taskDescription: { type: 'string', description: 'Description of the task to delegate' },
        preferAgent: { type: 'string', description: 'Optional: specific agent role to use (lead, builder, architect, etc.)' },
      },
      handler: async (params) => {
        const category = (params.category as string) || 'standard';
        const task = params.taskDescription as string;
        const preferAgent = params.preferAgent as AgentRole | undefined;

        if (!bridge) {
          const route = routeCategory(category, preferAgent);
          return { status: 'stub', agent: route.agent, model: route.model, message: 'Bridge not connected. Would spawn: ' + route.agent };
        }

        if (preferAgent) {
          const result = await bridge.spawn(preferAgent, task);
          return { status: 'completed', agent: result.agent, model: result.model, response: result.response, runId: result.runId };
        }

        const result = await bridge.spawnByCategory(category as WorkCategory, task);
        return { status: 'completed', agent: result.agent, model: result.model, response: result.response, runId: result.runId };
      },
    });

    api.registerTool({
      name: 'summon',
      description: 'Summon a specific OmOC agent by name.',
      parameters: {
        agent: { type: 'string', description: 'Agent role: lead, foreman, planner, builder, architect, reviewer, scout, researcher, observer' },
        taskDescription: { type: 'string', description: 'Task for the agent' },
      },
      handler: async (params) => {
        const agentName = params.agent as AgentRole;
        const task = params.taskDescription as string;

        if (!AGENT_REGISTRY[agentName]) {
          return { status: 'error', message: `Unknown agent: ${agentName}. Available: ${Object.keys(AGENT_REGISTRY).join(', ')}` };
        }

        if (!bridge) {
          return { status: 'stub', agent: agentName, message: 'Bridge not connected.' };
        }

        const result = await bridge.spawn(agentName, task);
        return { status: 'completed', agent: result.agent, model: result.model, response: result.response, runId: result.runId };
      },
    });
  }
}

export default {
  id: 'oh-my-openclaw',
  name: 'Oh My OpenClaw',
  description: 'Multi-agent orchestration for OpenClaw by ClawFlint',
  configSchema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      mode: { type: 'string', enum: ['standalone', 'clawflint'], default: 'standalone' },
    },
  },
  register,
};
```

- [ ] **Step 4: Build and verify**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun run build`
Expected: Bundled successfully with 3 entry points

- [ ] **Step 5: Run all tests**

Run: `cd /Users/engmsaleh/Repos/oh-my-openclaw && bun test`
Expected: All tests pass (existing + new)

- [ ] **Step 6: Commit**

```bash
cd /Users/engmsaleh/Repos/oh-my-openclaw && git add src/openclaw-entry.ts src/bridge/openclaw-integration.test.ts && git commit -m "feat: wire delegate/summon/run to real OpenClaw subagent API via SubagentBridge"
```

---

### Task 7: Integration Test via OpenClaw CLI

**Files:** None (manual verification)

- [ ] **Step 1: Rebuild and restart gateway**

```bash
cd /Users/engmsaleh/Repos/oh-my-openclaw && bun run build
cd ~/openclaw && docker compose -f docker-compose.yml -f docker-compose.extra.yml restart openclaw-gateway
```

Wait 15 seconds for startup.

- [ ] **Step 2: Verify plugin loads with bridge status**

```bash
cd ~/openclaw && docker compose -f docker-compose.yml -f docker-compose.extra.yml exec -e ANTHROPIC_API_KEY="sk-ant-api03-..." openclaw-gateway node dist/index.js agent --local --session-id test-doctor --message "/omoc doctor" --timeout 30
```

Expected output should include: `Bridge: CONNECTED (api.runtime.subagent)` or `Bridge: NOT CONNECTED (stub mode)` — either confirms the wiring is in place.

- [ ] **Step 3: Test delegate tool routing**

```bash
cd ~/openclaw && docker compose -f docker-compose.yml -f docker-compose.extra.yml exec -e ANTHROPIC_API_KEY="sk-ant-api03-..." openclaw-gateway node dist/index.js agent --local --session-id test-delegate --message "Use the delegate tool to assign a 'quick' category task: list all TypeScript files in the workspace" --timeout 60
```

Expected: Agent uses delegate tool, which routes to builder with sonnet model.

- [ ] **Step 4: Test /run pipeline (if bridge connected)**

```bash
cd ~/openclaw && docker compose -f docker-compose.yml -f docker-compose.extra.yml exec -e ANTHROPIC_API_KEY="sk-ant-api03-..." openclaw-gateway node dist/index.js agent --local --session-id test-run --message "/run add a /ping endpoint to openclaw-entry.ts that returns pong" --timeout 180
```

Expected: Full pipeline output showing 4 stages with different agents.

- [ ] **Step 5: Commit any fixes**

```bash
cd /Users/engmsaleh/Repos/oh-my-openclaw && git add -A && git commit -m "fix: integration test adjustments"
```
