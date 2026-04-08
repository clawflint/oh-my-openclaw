import { describe, it, expect } from 'vitest';
import { RuntimeOverlayManager } from './runtime-overlay.js';

describe('RuntimeOverlayManager', () => {
  it('adds and retrieves overlays', () => {
    const mgr = new RuntimeOverlayManager();
    mgr.add({ id: 'o1', scope: 'session', constraints: ['No external API calls'], directives: ['Focus on tests'] });
    expect(mgr.count()).toBe(1);
    expect(mgr.getActiveConstraints('builder')).toEqual(['No external API calls']);
    expect(mgr.getActiveDirectives('builder')).toEqual(['Focus on tests']);
  });

  it('filters by target agent', () => {
    const mgr = new RuntimeOverlayManager();
    mgr.add({ id: 'o1', scope: 'session', targetAgent: 'builder', constraints: ['Only TypeScript'], directives: [] });
    mgr.add({ id: 'o2', scope: 'session', targetAgent: 'reviewer', constraints: ['Check tests'], directives: [] });
    expect(mgr.getActiveConstraints('builder')).toEqual(['Only TypeScript']);
    expect(mgr.getActiveConstraints('reviewer')).toEqual(['Check tests']);
  });

  it('filters by scope', () => {
    const mgr = new RuntimeOverlayManager();
    mgr.add({ id: 'o1', scope: 'session', constraints: ['session-level'], directives: [] });
    mgr.add({ id: 'o2', scope: 'task', constraints: ['task-level'], directives: [] });
    expect(mgr.getForAgent('builder', 'session')).toHaveLength(1);
    expect(mgr.getForAgent('builder', 'task')).toHaveLength(1);
  });

  it('removes overlays by id', () => {
    const mgr = new RuntimeOverlayManager();
    mgr.add({ id: 'o1', scope: 'session', constraints: ['test'], directives: [] });
    expect(mgr.remove('o1')).toBe(true);
    expect(mgr.count()).toBe(0);
    expect(mgr.remove('nonexistent')).toBe(false);
  });

  it('prunes expired overlays', () => {
    const mgr = new RuntimeOverlayManager();
    mgr.add({ id: 'o1', scope: 'session', constraints: ['expired'], directives: [], expiresAt: '2020-01-01T00:00:00Z' });
    mgr.add({ id: 'o2', scope: 'session', constraints: ['valid'], directives: [], expiresAt: '2030-01-01T00:00:00Z' });
    expect(mgr.pruneExpired()).toBe(1);
    expect(mgr.count()).toBe(1);
    expect(mgr.getActiveConstraints('builder')).toEqual(['valid']);
  });

  it('compiles overlay prompt', () => {
    const mgr = new RuntimeOverlayManager();
    mgr.add({ id: 'o1', scope: 'session', constraints: ['No rm -rf'], directives: ['Use TDD'] });
    const prompt = mgr.compileOverlayPrompt('builder');
    expect(prompt).toContain('Runtime Constraints');
    expect(prompt).toContain('No rm -rf');
    expect(prompt).toContain('Runtime Directives');
    expect(prompt).toContain('Use TDD');
  });

  it('returns empty string when no overlays', () => {
    const mgr = new RuntimeOverlayManager();
    expect(mgr.compileOverlayPrompt('builder')).toBe('');
  });

  it('clears all overlays', () => {
    const mgr = new RuntimeOverlayManager();
    mgr.add({ id: 'o1', scope: 'session', constraints: ['a'], directives: [] });
    mgr.add({ id: 'o2', scope: 'task', constraints: ['b'], directives: [] });
    mgr.clear();
    expect(mgr.count()).toBe(0);
  });
});
