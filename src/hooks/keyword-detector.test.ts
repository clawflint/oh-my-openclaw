import { describe, it, expect } from 'vitest';
import { detectKeywords, keywordDetectorHandler, type MessageContext } from './keyword-detector.js';

describe('detectKeywords', () => {
  it('detects /run command', () => {
    const result = detectKeywords('/run refactor the auth module');
    expect(result).toEqual({ keyword: '/run', mode: 'run', args: 'refactor the auth module' });
  });

  it('detects /plan command', () => {
    const result = detectKeywords('/plan add user authentication');
    expect(result).toEqual({ keyword: '/plan', mode: 'plan', args: 'add user authentication' });
  });

  it('detects /ultrawork command', () => {
    const result = detectKeywords('/ultrawork build the whole feature');
    expect(result).toEqual({ keyword: '/ultrawork', mode: 'ultrawork', args: 'build the whole feature' });
  });

  it('detects /omoc command', () => {
    const result = detectKeywords('/omoc doctor');
    expect(result).toEqual({ keyword: '/omoc', mode: 'omoc', args: 'doctor' });
  });

  it('returns null for non-keyword messages', () => {
    expect(detectKeywords('hello world')).toBeNull();
    expect(detectKeywords('just a normal message')).toBeNull();
  });

  it('handles keyword with no args', () => {
    const result = detectKeywords('/status');
    expect(result).toEqual({ keyword: '/status', mode: 'status', args: '' });
  });
});

describe('keywordDetectorHandler', () => {
  it('adds omoc metadata to context', () => {
    const ctx: MessageContext = { body: '/run fix the bug' };
    keywordDetectorHandler(ctx);
    expect(ctx.metadata?.omocKeyword).toBe('/run');
    expect(ctx.metadata?.omocMode).toBe('run');
    expect(ctx.metadata?.omocArgs).toBe('fix the bug');
  });

  it('does nothing for non-keyword messages', () => {
    const ctx: MessageContext = { body: 'hello' };
    keywordDetectorHandler(ctx);
    expect(ctx.metadata).toBeUndefined();
  });
});
