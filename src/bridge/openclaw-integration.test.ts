import { describe, it, expect } from 'vitest';
import { routeCategory } from './category-router.js';
import { resolveModel } from './model-resolver.js';

describe('integration: delegate routing', () => {
  it('routes quick → builder with sonnet', () => {
    const r = routeCategory('quick');
    expect(r.agent).toBe('builder');
    expect(r.model).toBe('anthropic/claude-sonnet-4-6');
  });
  it('routes deep → architect with opus', () => {
    const r = routeCategory('deep');
    expect(r.agent).toBe('architect');
    expect(r.model).toBe('anthropic/claude-opus-4-6');
  });
  it('routes research → researcher with flash', () => {
    const r = routeCategory('research');
    expect(r.agent).toBe('researcher');
    expect(r.model).toBe('google/gemini-3-flash');
  });
  it('resolveModel returns correct model for each tier', () => {
    expect(resolveModel('tier_1')).toBe('anthropic/claude-opus-4-6');
    expect(resolveModel('tier_2')).toBe('anthropic/claude-sonnet-4-6');
    expect(resolveModel('tier_3')).toBe('google/gemini-3-flash');
    expect(resolveModel('multimodal')).toBe('google/gemini-3.1-pro');
  });
});
