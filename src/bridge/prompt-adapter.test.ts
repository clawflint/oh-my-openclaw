import { describe, it, expect } from 'vitest';
import { detectModelFamily, adaptPromptForModel } from './prompt-adapter.js';

describe('detectModelFamily', () => {
  it('detects anthropic', () => {
    expect(detectModelFamily('anthropic/claude-opus-4-6')).toBe('anthropic');
    expect(detectModelFamily('anthropic/claude-sonnet-4-6')).toBe('anthropic');
  });
  it('detects openai', () => {
    expect(detectModelFamily('openai/gpt-5.4')).toBe('openai');
    expect(detectModelFamily('openai/gpt-5-nano')).toBe('openai');
  });
  it('detects google', () => {
    expect(detectModelFamily('google/gemini-3-flash')).toBe('google');
    expect(detectModelFamily('google/gemini-3.1-pro')).toBe('google');
  });
  it('returns unknown for unrecognized', () => {
    expect(detectModelFamily('custom/model')).toBe('unknown');
  });
});

describe('adaptPromptForModel', () => {
  it('adds anthropic prefix for claude models', () => {
    const result = adaptPromptForModel('Do the task', 'anthropic/claude-opus-4-6');
    expect(result).toContain('mechanics-driven');
    expect(result).toContain('Do the task');
    expect(result).toContain('structured sections');
  });
  it('adds openai prefix for gpt models', () => {
    const result = adaptPromptForModel('Do the task', 'openai/gpt-5.4');
    expect(result).toContain('principle-driven');
    expect(result).toContain('step by step');
  });
  it('adds google prefix for gemini models', () => {
    const result = adaptPromptForModel('Do the task', 'google/gemini-3-flash');
    expect(result).toContain('fast and efficient');
    expect(result).toContain('concise');
  });
  it('returns unchanged for unknown models', () => {
    const result = adaptPromptForModel('Do the task', 'custom/model');
    expect(result).toBe('Do the task');
  });
});
