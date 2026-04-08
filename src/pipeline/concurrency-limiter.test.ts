import { describe, it, expect } from 'vitest';
import { ConcurrencyLimiter } from './concurrency-limiter.js';

const config = {
  maxParallelWorkers: 3,
  maxBackgroundTasks: 10,
  perProviderLimit: 2,
  perModelLimit: 1,
  staleTaskTimeoutSeconds: 300,
};

describe('ConcurrencyLimiter', () => {
  it('allows spawn within limits', () => {
    const limiter = new ConcurrencyLimiter(config);
    expect(limiter.canSpawn('anthropic', 'opus').allowed).toBe(true);
  });
  it('blocks when max workers reached', () => {
    const limiter = new ConcurrencyLimiter(config);
    limiter.acquire('a', 'm1');
    limiter.acquire('b', 'm2');
    limiter.acquire('c', 'm3');
    expect(limiter.canSpawn('d', 'm4').allowed).toBe(false);
    expect(limiter.canSpawn('d', 'm4').reason).toContain('Max parallel');
  });
  it('blocks when provider limit reached', () => {
    const limiter = new ConcurrencyLimiter(config);
    limiter.acquire('anthropic', 'opus');
    limiter.acquire('anthropic', 'sonnet');
    expect(limiter.canSpawn('anthropic', 'haiku').allowed).toBe(false);
    expect(limiter.canSpawn('anthropic', 'haiku').reason).toContain('Provider limit');
  });
  it('blocks when model limit reached', () => {
    const limiter = new ConcurrencyLimiter(config);
    limiter.acquire('anthropic', 'opus');
    expect(limiter.canSpawn('openai', 'opus').allowed).toBe(false);
    expect(limiter.canSpawn('openai', 'opus').reason).toContain('Model limit');
  });
  it('allows after release', () => {
    const limiter = new ConcurrencyLimiter(config);
    limiter.acquire('a', 'm1');
    limiter.acquire('a', 'm2');
    expect(limiter.canSpawn('a', 'm3').allowed).toBe(false);
    limiter.release('a', 'm1');
    expect(limiter.canSpawn('a', 'm3').allowed).toBe(true);
  });
  it('reports status', () => {
    const limiter = new ConcurrencyLimiter(config);
    limiter.acquire('anthropic', 'opus');
    const status = limiter.getStatus();
    expect(status.total).toBe(1);
    expect(status.byProvider.anthropic).toBe(1);
    expect(status.byModel.opus).toBe(1);
  });
  it('resets all counts', () => {
    const limiter = new ConcurrencyLimiter(config);
    limiter.acquire('a', 'm1');
    limiter.acquire('b', 'm2');
    limiter.reset();
    expect(limiter.getStatus().total).toBe(0);
  });
});
