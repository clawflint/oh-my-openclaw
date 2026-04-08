import { describe, it, expect } from 'vitest';
import { executeWithFallback, getModelChain, getAgentModelChain } from './fallback-executor.js';

describe('executeWithFallback', () => {
  it('succeeds on first attempt', async () => {
    const { result, fallbackInfo } = await executeWithFallback('tier_1', async (model) => `ok:${model}`);
    expect(result).toBe('ok:anthropic/claude-opus-4-6');
    expect(fallbackInfo.attempt).toBe(1);
    expect(fallbackInfo.success).toBe(true);
  });

  it('falls back on first failure', async () => {
    let call = 0;
    const { result, fallbackInfo } = await executeWithFallback('tier_1', async (model) => {
      call++;
      if (call === 1) throw new Error('rate limited');
      return `ok:${model}`;
    });
    expect(result).toBe('ok:openai/gpt-5.4');
    expect(fallbackInfo.attempt).toBe(2);
  });

  it('throws after all attempts fail', async () => {
    await expect(executeWithFallback('tier_3', async () => { throw new Error('fail'); }, 3)).rejects.toThrow('All');
  });

  it('respects maxAttempts', async () => {
    let calls = 0;
    await expect(executeWithFallback('tier_1', async () => { calls++; throw new Error('fail'); }, 2)).rejects.toThrow();
    expect(calls).toBe(2);
  });
});

describe('getModelChain', () => {
  it('returns primary + fallbacks for tier_1', () => {
    const chain = getModelChain('tier_1');
    expect(chain[0]).toBe('anthropic/claude-opus-4-6');
    expect(chain.length).toBeGreaterThan(1);
  });
});

describe('getAgentModelChain', () => {
  it('returns chain for builder (tier_2)', () => {
    const chain = getAgentModelChain('builder');
    expect(chain[0]).toBe('anthropic/claude-sonnet-4-6');
  });
  it('returns chain for scout (tier_3)', () => {
    const chain = getAgentModelChain('scout');
    expect(chain[0]).toBe('google/gemini-3-flash');
  });
});
