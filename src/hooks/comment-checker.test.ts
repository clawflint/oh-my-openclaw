import { describe, it, expect } from 'vitest';
import { detectAiSlop, commentCheckerHandler, AI_SLOP_PATTERNS } from './comment-checker.js';

describe('detectAiSlop', () => {
  it('detects TODO implement', () => {
    const r = detectAiSlop('// TODO: implement this');
    expect(r).toHaveLength(1);
    expect(r[0].label).toBe('TODO implement placeholder');
  });
  it('detects Add your placeholder', () => {
    expect(detectAiSlop('// Add your logic here')).toHaveLength(1);
  });
  it('detects ellipsis placeholder', () => {
    expect(detectAiSlop('// ... rest of implementation')).toHaveLength(1);
  });
  it('detects Handle error cases', () => {
    expect(detectAiSlop('// Handle error cases here')).toHaveLength(1);
  });
  it('detects Not implemented throw', () => {
    expect(detectAiSlop("throw new Error('Not implemented')")).toHaveLength(1);
  });
  it('detects Placeholder comment', () => {
    expect(detectAiSlop('// Placeholder for future')).toHaveLength(1);
  });
  it('detects Stub comment', () => {
    expect(detectAiSlop('// Stub method')).toHaveLength(1);
  });
  it('detects HACK comment', () => {
    expect(detectAiSlop('// HACK: workaround for bug')).toHaveLength(1);
  });
  it('returns empty for clean code', () => {
    expect(detectAiSlop('const x = 42;\nreturn x + 1;')).toHaveLength(0);
  });
  it('reports line numbers', () => {
    const r = detectAiSlop('line1\n// TODO: implement\nline3');
    expect(r[0].lineNumber).toBe(2);
  });
  it('detects multiple patterns', () => {
    const code = '// TODO: implement\n// Placeholder\n// HACK: fix later';
    expect(detectAiSlop(code).length).toBeGreaterThanOrEqual(3);
  });
  it('has 11 patterns defined', () => {
    expect(AI_SLOP_PATTERNS).toHaveLength(11);
  });
});

describe('commentCheckerHandler', () => {
  it('returns report for write tool with slop', () => {
    const ctx = { toolName: 'write', result: '// TODO: implement this' };
    const r = commentCheckerHandler(ctx);
    expect(r).toContain('AI slop detected');
    expect(r).toContain('MUST fix');
  });
  it('returns report for edit tool with slop', () => {
    const ctx = { toolName: 'edit', result: '// Placeholder code' };
    expect(commentCheckerHandler(ctx)).toContain('AI slop');
  });
  it('returns undefined for read tool', () => {
    expect(commentCheckerHandler({ toolName: 'read', result: '// TODO: implement' })).toBeUndefined();
  });
  it('returns undefined for clean code', () => {
    expect(commentCheckerHandler({ toolName: 'write', result: 'const x = 1;' })).toBeUndefined();
  });
});
