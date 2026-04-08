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
  it('spawns builder with tier_2 model', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);
    const result = await bridge.spawn('builder', 'Fix the login bug');
    expect(api.runtime.subagent.run).toHaveBeenCalledWith(expect.objectContaining({ model: 'anthropic/claude-sonnet-4-6', deliver: false }));
    expect(result.response).toBe('Task completed successfully.');
    expect(result.runId).toBe('run-123');
  });

  it('spawns lead with tier_1 model', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);
    await bridge.spawn('lead', 'Classify intent');
    expect(api.runtime.subagent.run).toHaveBeenCalledWith(expect.objectContaining({ model: 'anthropic/claude-opus-4-6' }));
  });

  it('spawns scout with tier_3 model', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);
    await bridge.spawn('scout', 'Find auth files');
    expect(api.runtime.subagent.run).toHaveBeenCalledWith(expect.objectContaining({ model: 'google/gemini-3-flash' }));
  });

  it('includes agent persona in message', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);
    await bridge.spawn('reviewer', 'Check code quality');
    const callArgs = api.runtime.subagent.run.mock.calls[0][0];
    expect(callArgs.message).toContain('You are Reviewer');
    expect(callArgs.message).toContain('Check code quality');
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
  });

  it('waits with configurable timeout', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);
    await bridge.spawn('builder', 'Task', { timeout: 30000 });
    expect(api.runtime.subagent.waitForRun).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 30000 }));
  });

  it('spawns by category via spawnByCategory', async () => {
    const api = createMockApi();
    const bridge = new SubagentBridge(api as any);
    const result = await bridge.spawnByCategory('deep', 'Refactor auth');
    expect(api.runtime.subagent.run).toHaveBeenCalledWith(expect.objectContaining({ model: 'anthropic/claude-opus-4-6' }));
    expect(result.agent).toBe('architect');
  });
});
