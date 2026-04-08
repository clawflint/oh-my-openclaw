import { describe, it, expect } from 'vitest';
import { enforceUltraworkPipeline, ultraworkEnforcerHandler } from './ultrawork-enforcer.js';

describe('enforceUltraworkPipeline', () => {
  it('generates 4-phase pipeline', () => {
    const r = enforceUltraworkPipeline('build auth system');
    expect(r).toContain('PHASE 1');
    expect(r).toContain('PHASE 2');
    expect(r).toContain('PHASE 3');
    expect(r).toContain('PHASE 4');
  });
  it('includes all agent types', () => {
    const r = enforceUltraworkPipeline('task');
    expect(r).toContain('omoc-lead');
    expect(r).toContain('omoc-planner');
    expect(r).toContain('omoc-auditor');
    expect(r).toContain('omoc-critic');
    expect(r).toContain('omoc-builder');
    expect(r).toContain('omoc-architect');
    expect(r).toContain('omoc-scout');
    expect(r).toContain('omoc-reviewer');
  });
  it('includes correct models', () => {
    const r = enforceUltraworkPipeline('task');
    expect(r).toContain('claude-opus-4-6');
    expect(r).toContain('claude-sonnet-4-6');
    expect(r).toContain('gemini-3-flash');
  });
  it('mentions parallel execution', () => {
    const r = enforceUltraworkPipeline('task');
    expect(r).toContain('Parallel');
  });
});

describe('ultraworkEnforcerHandler', () => {
  it('rewrites /ultrawork messages', () => {
    const ctx = { body: '/ultrawork build complete auth system' };
    ultraworkEnforcerHandler(ctx);
    expect(ctx.bodyForAgent).toContain('PHASE 1');
    expect(ctx.bodyForAgent).toContain('omoc-lead');
  });
  it('ignores non-ultrawork messages', () => {
    const ctx = { body: 'hello' };
    ultraworkEnforcerHandler(ctx);
    expect(ctx.bodyForAgent).toBeUndefined();
  });
  it('ignores bare /ultrawork', () => {
    const ctx = { body: '/ultrawork' };
    ultraworkEnforcerHandler(ctx);
    expect(ctx.bodyForAgent).toBeUndefined();
  });
});
