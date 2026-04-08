import { describe, it, expect } from 'vitest';
import {
  detectIncompleteWork,
  detectCompletionSignal,
  evaluateRalphContinuation,
  createInitialRalphState,
  DEFAULT_RALPH_CONFIG,
} from './ralph-loop.js';

describe('detectIncompleteWork', () => {
  it('detects TODO', () => {
    expect(detectIncompleteWork('// TODO: fix this')).toHaveLength(1);
  });
  it('detects FIXME', () => {
    expect(detectIncompleteWork('// FIXME: broken')).toHaveLength(1);
  });
  it('detects unchecked checkbox', () => {
    expect(detectIncompleteWork('- [ ] not done')).toHaveLength(1);
  });
  it('detects placeholder', () => {
    expect(detectIncompleteWork('this is a placeholder')).toHaveLength(1);
  });
  it('returns empty for clean output', () => {
    expect(detectIncompleteWork('All tests pass. Code looks good.')).toHaveLength(0);
  });
  it('detects multiple patterns', () => {
    expect(detectIncompleteWork('TODO fix\nFIXME broken\n- [ ] task').length).toBeGreaterThanOrEqual(3);
  });
});

describe('detectCompletionSignal', () => {
  it('detects "all tasks done"', () => {
    expect(detectCompletionSignal('All tasks are done.')).toBe(true);
  });
  it('detects APPROVED', () => {
    expect(detectCompletionSignal('APPROVED — code looks great')).toBe(true);
  });
  it('detects "all tests pass"', () => {
    expect(detectCompletionSignal('All tests pass.')).toBe(true);
  });
  it('returns false for normal text', () => {
    expect(detectCompletionSignal('Working on the feature now.')).toBe(false);
  });
});

describe('evaluateRalphContinuation', () => {
  it('returns shouldContinue=true when incomplete work found', () => {
    const state = createInitialRalphState();
    // Force lastCheckAt to old enough to pass cooldown
    const oldState = { ...state, lastCheckAt: Date.now() - 10000 };
    const result = evaluateRalphContinuation('// TODO: fix this', oldState, DEFAULT_RALPH_CONFIG);
    expect(result.shouldContinue).toBe(true);
    expect(result.directive).toContain('RALPH LOOP');
    expect(result.updatedState.iteration).toBe(1);
    expect(result.updatedState.status).toBe('active');
  });

  it('returns shouldContinue=false when completion signal found', () => {
    const state = { ...createInitialRalphState(), status: 'active' as const, iteration: 3 };
    const result = evaluateRalphContinuation('All tasks are done.', state, DEFAULT_RALPH_CONFIG);
    expect(result.shouldContinue).toBe(false);
    expect(result.updatedState.status).toBe('completed');
  });

  it('returns shouldContinue=false when max iterations reached', () => {
    const state = { ...createInitialRalphState(), iteration: 100 };
    const result = evaluateRalphContinuation('// TODO: still broken', state, DEFAULT_RALPH_CONFIG);
    expect(result.shouldContinue).toBe(false);
    expect(result.updatedState.status).toBe('max_iterations');
  });

  it('returns shouldContinue=false when disabled', () => {
    const config = { ...DEFAULT_RALPH_CONFIG, enabled: false };
    const result = evaluateRalphContinuation('// TODO: fix', createInitialRalphState(), config);
    expect(result.shouldContinue).toBe(false);
  });

  it('respects cooldown', () => {
    const state = { ...createInitialRalphState(), lastCheckAt: Date.now() };
    const result = evaluateRalphContinuation('// TODO: fix', state, DEFAULT_RALPH_CONFIG);
    expect(result.shouldContinue).toBe(false);
  });

  it('returns shouldContinue=false when no incomplete work', () => {
    const result = evaluateRalphContinuation('Code is clean.', createInitialRalphState(), DEFAULT_RALPH_CONFIG);
    expect(result.shouldContinue).toBe(false);
    expect(result.updatedState.status).toBe('idle');
  });
});
