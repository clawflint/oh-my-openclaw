import { describe, it, expect } from 'vitest';
import { resolveModel } from './model-resolver.js';

describe('resolveModel', () => {
  it('returns primary model for tier_1', () => {
    expect(resolveModel('tier_1')).toBe('anthropic/claude-opus-4-6');
  });
  it('returns primary model for tier_2', () => {
    expect(resolveModel('tier_2')).toBe('anthropic/claude-sonnet-4-6');
  });
  it('returns primary model for tier_3', () => {
    expect(resolveModel('tier_3')).toBe('google/gemini-3-flash');
  });
  it('returns primary model for multimodal', () => {
    expect(resolveModel('multimodal')).toBe('google/gemini-3.1-pro');
  });
  it('returns fallback when primary is unavailable', () => {
    expect(resolveModel('tier_1', ['anthropic/claude-opus-4-6'])).toBe('openai/gpt-5.4');
  });
  it('returns second fallback when first also unavailable', () => {
    expect(resolveModel('tier_1', ['anthropic/claude-opus-4-6', 'openai/gpt-5.4'])).toBe('google/gemini-3.1-pro');
  });
  it('accepts custom model tiers', () => {
    const custom = {
      tier_1: { model: 'custom/model', fallback: ['backup/model'] },
      tier_2: { model: 'anthropic/claude-sonnet-4-6', fallback: [] },
      tier_3: { model: 'google/gemini-3-flash', fallback: [] },
      multimodal: { model: 'google/gemini-3.1-pro', fallback: [] },
    };
    expect(resolveModel('tier_1', [], custom)).toBe('custom/model');
  });
  it('throws when all models unavailable', () => {
    expect(() => resolveModel('tier_3', ['google/gemini-3-flash', 'openai/gpt-5-nano'])).toThrow('No available model');
  });
});
