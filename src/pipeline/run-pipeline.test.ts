import { describe, it, expect, vi } from 'vitest';
import { runPipeline } from './run-pipeline.js';
import { PipelineEventEmitter } from './pipeline-events.js';
import type { SpawnResult } from '../bridge/subagent-bridge.js';
import type { CostControlsConfig } from '../types/index.js';

function makeSpawnResult(agent: string, response: string): SpawnResult {
  return { runId: `run-${agent}`, sessionKey: `agent:main:omoc:${agent}-test`, agent: agent as any, model: 'test-model', response, tokens: { input: 500, output: 200 } };
}

function createMockBridge() {
  const responses: Record<string, string> = {
    lead: JSON.stringify({ intent: 'implement', complexity: 'standard', plan: 'Add the endpoint' }),
    planner: '## Plan\n1. Create handler\n2. Add tests\n3. Wire router',
    builder: 'Implementation complete. Added /hello endpoint.',
    reviewer: 'APPROVED. Tests pass, code follows conventions.',
  };
  return {
    spawn: vi.fn().mockImplementation((role: string, task: string) => Promise.resolve(makeSpawnResult(role, responses[role] || 'done'))),
    spawnByCategory: vi.fn(),
  };
}

const budget: CostControlsConfig = { sessionBudgetUsd: 10, taskBudgetUsd: 3, alertThresholdPercent: 75, hardStopOnBudget: true };

describe('runPipeline', () => {
  it('executes classify→plan→build→review', async () => {
    const bridge = createMockBridge();
    const result = await runPipeline(bridge as any, 'Add /hello endpoint', budget);
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

  it('calls bridge.spawn with correct agents in order', async () => {
    const bridge = createMockBridge();
    await runPipeline(bridge as any, 'Fix bug', budget);
    const calls = bridge.spawn.mock.calls;
    expect(calls[0][0]).toBe('lead');
    expect(calls[1][0]).toBe('planner');
    expect(calls[2][0]).toBe('builder');
    expect(calls[3][0]).toBe('reviewer');
  });

  it('passes plan output to builder', async () => {
    const bridge = createMockBridge();
    await runPipeline(bridge as any, 'Add feature', budget);
    const builderTask = bridge.spawn.mock.calls[2][1];
    expect(builderTask).toContain('Plan');
  });

  it('reports total cost', async () => {
    const bridge = createMockBridge();
    const result = await runPipeline(bridge as any, 'Task', budget);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.summary).toBeDefined();
  });

  it('fails if budget exceeded mid-pipeline', async () => {
    const tinyBudget: CostControlsConfig = { sessionBudgetUsd: 0.001, taskBudgetUsd: 0.001, alertThresholdPercent: 50, hardStopOnBudget: true };
    const bridge = createMockBridge();
    bridge.spawn.mockImplementation((role: string) => Promise.resolve({ ...makeSpawnResult(role, 'done'), tokens: { input: 100000, output: 50000 } }));
    const result = await runPipeline(bridge as any, 'Expensive', tinyBudget);
    expect(result.status).toBe('failed');
    expect(result.summary).toContain('budget');
  });

  it('emits stage events when PipelineEventEmitter is provided', async () => {
    const bridge = createMockBridge();
    const emitter = new PipelineEventEmitter();
    const emittedTypes: string[] = [];
    emitter.addSink((event) => emittedTypes.push(event.type));

    await runPipeline(bridge as any, 'Add /hello endpoint', budget, { events: emitter, pipelineId: 'test-pipe' });

    expect(emittedTypes).toContain('pipeline:started');
    expect(emittedTypes).toContain('pipeline:stage:started');
    expect(emittedTypes).toContain('pipeline:stage:completed');
    expect(emittedTypes).toContain('pipeline:completed');
  });

  it('includes approval stages when approvalMode is required', async () => {
    const bridge = createMockBridge();
    const result = await runPipeline(bridge as any, 'Add feature', budget, { approvalMode: 'required' });
    expect(result.status).toBe('completed');
    const stageNames = result.stages.map((s) => s.stage);
    expect(stageNames).toContain('approval:build');
    expect(stageNames).toContain('approval:review');
  });
});
