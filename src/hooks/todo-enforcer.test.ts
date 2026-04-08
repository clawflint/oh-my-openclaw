import { describe, it, expect } from 'vitest';
import { detectIncompleteTodos, todoEnforcerHandler, type ToolResultContext } from './todo-enforcer.js';

describe('detectIncompleteTodos', () => {
  it('detects TODO comments', () => {
    expect(detectIncompleteTodos('// TODO: fix this later')).toHaveLength(1);
  });

  it('detects FIXME comments', () => {
    expect(detectIncompleteTodos('// FIXME: broken')).toHaveLength(1);
  });

  it('detects unchecked checkboxes', () => {
    expect(detectIncompleteTodos('- [ ] not done yet')).toHaveLength(1);
  });

  it('detects placeholder text', () => {
    expect(detectIncompleteTodos('this is a placeholder implementation')).toHaveLength(1);
  });

  it('returns empty for clean text', () => {
    expect(detectIncompleteTodos('const x = 42;\nreturn x;')).toHaveLength(0);
  });

  it('detects multiple patterns', () => {
    const text = '// TODO: fix\n// FIXME: broken\n- [ ] unchecked';
    expect(detectIncompleteTodos(text).length).toBeGreaterThanOrEqual(3);
  });
});

describe('todoEnforcerHandler', () => {
  it('returns directive when todos found', () => {
    const ctx: ToolResultContext = { toolName: 'write', result: '// TODO: implement', sessionId: 'test' };
    const directive = todoEnforcerHandler(ctx);
    expect(directive).toContain('Incomplete items detected');
    expect(directive).toContain('MUST continue');
  });

  it('returns undefined when clean', () => {
    const ctx: ToolResultContext = { toolName: 'read', result: 'const x = 1;', sessionId: 'test' };
    expect(todoEnforcerHandler(ctx)).toBeUndefined();
  });
});
