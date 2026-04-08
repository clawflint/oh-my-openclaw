# OmOC Orchestration Wiring Design

**Date:** 2026-04-08
**Status:** Approved
**Scope:** Wire OmOC's agent registry to OpenClaw's `api.runtime.subagent` API

## Problem

OmOC has 11 agents, 4 model tiers, 7 work categories, and a full type system — but none of it connects to OpenClaw's real agent spawning. The `omoc_delegate` tool returns a stub. The `/run` command doesn't exist as a real pipeline.

## Solution

Three components that bridge OmOC's orchestration logic to OpenClaw's subagent runtime.

## Component 1: Subagent Bridge (`src/bridge/subagent-bridge.ts`)

The core function that translates OmOC agent roles into real OpenClaw subagent sessions.

### Interface

```typescript
interface SubagentBridgeConfig {
  api: OpenClawPluginApi;  // captured during register()
}

interface SpawnResult {
  runId: string;
  sessionKey: string;
  response: string;
  tokenUsage?: { input: number; output: number };
}

class SubagentBridge {
  constructor(config: SubagentBridgeConfig);
  
  // Spawn an agent by role, wait for completion, return response
  async spawn(role: AgentRole, task: string, options?: {
    category?: WorkCategory;
    timeout?: number;
    background?: boolean;
  }): Promise<SpawnResult>;
  
  // Spawn without waiting (fire-and-forget)
  async spawnBackground(role: AgentRole, task: string): Promise<string>; // runId
  
  // Check on a background agent
  async waitFor(runId: string, timeout?: number): Promise<SpawnResult>;
}
```

### Spawn Logic

```
spawn(role, task):
  1. agentConfig = AGENT_REGISTRY[role]
  2. modelTier = DEFAULT_MODEL_TIERS[agentConfig.defaultTier]
  3. model = modelTier.model  // e.g. "anthropic/claude-opus-4-6"
  4. persona = agentConfig.systemPrompt
  5. sessionKey = `agent:main:omoc:${role}-${uuid()}`
  6. message = `${persona}\n\n---\n\nTask: ${task}`
  7. result = api.runtime.subagent.run({
       sessionKey,
       message,
       model,
       deliver: false
     })
  8. completion = api.runtime.subagent.waitForRun({
       runId: result.runId,
       timeoutMs: timeout || 120000
     })
  9. messages = api.runtime.subagent.getSessionMessages({
       sessionKey, limit: 1
     })
  10. return { runId, sessionKey, response: messages[0].text }
```

### Model Resolution

Uses existing `DEFAULT_MODEL_TIERS` from `src/config/index.ts`:
- tier_1 → `anthropic/claude-opus-4-6` (Lead, Foreman, Planner, Architect)
- tier_2 → `anthropic/claude-sonnet-4-6` (Builder, Reviewer, Auditor, Critic)
- tier_3 → `google/gemini-3-flash` (Scout, Researcher)
- multimodal → `google/gemini-3.1-pro` (Observer)

Fallback: if the primary model is unavailable, try `modelTier.fallback[0]`, then `fallback[1]`.

## Component 2: Delegate Tool Wiring (`src/openclaw-entry.ts`)

Update the existing `omoc_delegate` tool registration to use SubagentBridge.

### Current (stub):
```typescript
handler: async (params) => {
  return { status: 'delegated', category: params.category };
}
```

### New (real):
```typescript
handler: async (params) => {
  const category = params.category as WorkCategory;
  const task = params.taskDescription as string;
  const agentName = params.preferAgent as AgentRole | undefined;
  
  // Resolve agent from category if not specified
  const role = agentName || CATEGORY_TO_AGENT[category];
  
  const result = await bridge.spawn(role, task, { category });
  
  return {
    status: 'completed',
    agent: role,
    model: DEFAULT_MODEL_TIERS[AGENT_REGISTRY[role].defaultTier].model,
    response: result.response,
    runId: result.runId
  };
}
```

### Category → Agent Mapping

```typescript
const CATEGORY_TO_AGENT: Record<WorkCategory, AgentRole> = {
  quick: 'builder',
  standard: 'builder',
  deep: 'architect',
  strategic: 'planner',
  visual: 'observer',
  research: 'researcher',
  creative: 'builder'
};
```

Also wire the `summon` tool to spawn by explicit agent name.

## Component 3: /run Pipeline (`src/pipeline/run-pipeline.ts`)

Sequential orchestration that chains agents through a structured workflow.

### Pipeline Stages

```
/run <task description>
  ↓
Stage 1: CLASSIFY (Lead, tier_1)
  Input: user's task description
  Output: { intent, complexity, suggestedWorkflow }
  ↓
Stage 2: PLAN (Planner, tier_1)  
  Input: classified intent + task description
  Output: phased plan with acceptance criteria
  ↓
Stage 3: EXECUTE (Builder or Architect, tier_1/tier_2)
  Input: each phase from the plan
  Output: implementation per phase
  Note: phases can run in parallel if independent
  ↓
Stage 4: REVIEW (Reviewer, tier_2)
  Input: all changes from execute stage
  Output: approval or rejection with feedback
  ↓
Stage 5: REPORT
  Summarize what was done, return to user
```

### Interface

```typescript
interface PipelineResult {
  status: 'completed' | 'failed' | 'rejected';
  stages: StageResult[];
  summary: string;
  totalTokens: number;
  totalCost: number;
}

interface StageResult {
  stage: string;
  agent: AgentRole;
  model: string;
  response: string;
  durationMs: number;
  tokens: { input: number; output: number };
}

async function runPipeline(
  bridge: SubagentBridge,
  taskDescription: string,
  config: OmocConfig
): Promise<PipelineResult>;
```

### Cost Control

Before each spawn, check against `config.costControls`:
- `sessionBudgetUsd`: total session limit
- `taskBudgetUsd`: per-agent limit  
- `alertThresholdPercent`: warn at 75%
- `hardStopOnBudget`: halt if exceeded

Track cumulative cost across all stages. Estimate cost from token counts using model pricing.

## Integration: Capturing the API Object

The `register(api)` function receives the OpenClaw plugin API. We need to store it for later use by the bridge and pipeline.

```typescript
let bridge: SubagentBridge | null = null;

function register(api: OpenClawPluginApi): void {
  // Create the bridge with the API
  bridge = new SubagentBridge({ api });
  
  // Register tools that use the bridge
  api.registerCommand({ name: 'run', ... });
  api.registerTool({ name: 'delegate', handler: async (params) => {
    return bridge.spawn(...);
  }});
}
```

## File Structure

```
src/
  bridge/
    subagent-bridge.ts    # Core bridge: OmOC agents → OpenClaw subagents
    model-resolver.ts     # Model tier resolution with fallbacks
    category-router.ts    # Category → agent mapping
  pipeline/
    run-pipeline.ts       # /run command orchestration
    stage-runner.ts       # Individual stage execution
    cost-tracker.ts       # Budget tracking across stages
  openclaw-entry.ts       # Updated: real delegate tool + /run command
```

## What We're NOT Building (Yet)

- Ralph loop (self-correction service)
- Todo enforcer hook
- Comment checker hook
- Keyword detector hook
- /ultrawork, /plan, /start_work commands
- Parallel worker fan-out in execute stage
- Cross-model prompt adaptation

These are all valuable but incremental additions after the core wiring works.

## Success Criteria

1. `omoc_delegate` tool spawns a real OpenClaw subagent with the correct model
2. Different agents get different models (Opus for Lead, Sonnet for Builder, Flash for Scout)
3. `/run` command executes the full pipeline: classify → plan → execute → review → report
4. Cost tracking prevents budget overruns
5. All verifiable via CLI: `openclaw agent --local --message "/run add hello endpoint"`

## Testing Plan

1. Unit test SubagentBridge with mocked api.runtime.subagent
2. Unit test category router and model resolver
3. Integration test: run delegate tool via OpenClaw CLI, verify subagent spawned with correct model
4. End-to-end test: `/run` pipeline on a simple task (add hello endpoint)
