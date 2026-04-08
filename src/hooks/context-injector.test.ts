import { describe, it, expect } from 'vitest';
import { contextInjectorHandler, type BootstrapContext } from './context-injector.js';

describe('contextInjectorHandler', () => {
  it('adds OMOC.md to bootstrap files', () => {
    const ctx: BootstrapContext = { bootstrapFiles: [], agentId: 'main' };
    contextInjectorHandler(ctx);
    expect(ctx.bootstrapFiles).toHaveLength(1);
    expect(ctx.bootstrapFiles[0].name).toBe('OMOC.md');
    expect(ctx.bootstrapFiles[0].content).toContain('OmOC');
  });

  it('preserves existing bootstrap files', () => {
    const ctx: BootstrapContext = {
      bootstrapFiles: [{ name: 'AGENTS.md', content: 'existing' }],
      agentId: 'main',
    };
    contextInjectorHandler(ctx);
    expect(ctx.bootstrapFiles).toHaveLength(2);
    expect(ctx.bootstrapFiles[0].name).toBe('AGENTS.md');
    expect(ctx.bootstrapFiles[1].name).toBe('OMOC.md');
  });
});
