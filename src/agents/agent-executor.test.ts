import { describe, it, expect } from 'vitest';
import { executeAgent, StubLLMProvider } from './agent-executor.js';

describe('executeAgent', () => {
  it('executes lead agent with correct model', async () => {
    const provider = new StubLLMProvider();
    provider.setDefaultResponse('Intent: implement');
    const result = await executeAgent('lead', 'Add a hello endpoint', provider);
    expect(result.agent).toBe('lead');
    expect(result.model).toBe('anthropic/claude-opus-4-6');
    expect(result.response).toBe('Intent: implement');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('executes builder with tier_2 model', async () => {
    const provider = new StubLLMProvider();
    const result = await executeAgent('builder', 'Fix the bug', provider);
    expect(result.model).toBe('anthropic/claude-sonnet-4-6');
  });

  it('executes scout with tier_3 model', async () => {
    const provider = new StubLLMProvider();
    const result = await executeAgent('scout', 'Find auth files', provider);
    expect(result.model).toBe('google/gemini-3-flash');
  });

  it('passes system prompt to provider', async () => {
    const provider = new StubLLMProvider();
    await executeAgent('reviewer', 'Check code', provider);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].messages[0].content).toContain('Reviewer');
  });

  it('allows model override', async () => {
    const provider = new StubLLMProvider();
    const result = await executeAgent('builder', 'Task', provider, { model: 'custom/model' });
    expect(result.model).toBe('custom/model');
    expect(provider.calls[0].model).toBe('custom/model');
  });

  it('records token usage', async () => {
    const provider = new StubLLMProvider();
    const result = await executeAgent('lead', 'Task', provider);
    expect(result.tokens.input).toBe(100);
    expect(result.tokens.output).toBe(50);
  });
});

describe('StubLLMProvider', () => {
  it('returns model-specific responses', async () => {
    const provider = new StubLLMProvider();
    provider.setResponse('anthropic/claude-opus-4-6', 'opus response');
    provider.setResponse('anthropic/claude-sonnet-4-6', 'sonnet response');
    const r1 = await provider.complete({ model: 'anthropic/claude-opus-4-6', messages: [] });
    const r2 = await provider.complete({ model: 'anthropic/claude-sonnet-4-6', messages: [] });
    expect(r1.content).toBe('opus response');
    expect(r2.content).toBe('sonnet response');
  });
  it('tracks calls', async () => {
    const provider = new StubLLMProvider();
    await provider.complete({ model: 'test', messages: [{ role: 'user', content: 'hi' }] });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].model).toBe('test');
  });
});
