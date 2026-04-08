import { describe, it, expect } from 'vitest';
import { routeCategory, CATEGORY_TO_AGENT } from './category-router.js';

describe('CATEGORY_TO_AGENT', () => {
  it('maps quick to builder', () => { expect(CATEGORY_TO_AGENT.quick).toBe('builder'); });
  it('maps deep to architect', () => { expect(CATEGORY_TO_AGENT.deep).toBe('architect'); });
  it('maps strategic to planner', () => { expect(CATEGORY_TO_AGENT.strategic).toBe('planner'); });
  it('maps visual to observer', () => { expect(CATEGORY_TO_AGENT.visual).toBe('observer'); });
  it('maps research to researcher', () => { expect(CATEGORY_TO_AGENT.research).toBe('researcher'); });
});

describe('routeCategory', () => {
  it('returns agent role and model for quick', () => {
    const r = routeCategory('quick');
    expect(r.agent).toBe('builder');
    expect(r.model).toBe('anthropic/claude-sonnet-4-6');
    expect(r.tier).toBe('tier_2');
  });
  it('returns architect with opus for deep', () => {
    const r = routeCategory('deep');
    expect(r.agent).toBe('architect');
    expect(r.model).toBe('anthropic/claude-opus-4-6');
    expect(r.tier).toBe('tier_1');
  });
  it('returns observer with multimodal for visual', () => {
    const r = routeCategory('visual');
    expect(r.agent).toBe('observer');
    expect(r.model).toBe('google/gemini-3.1-pro');
    expect(r.tier).toBe('multimodal');
  });
  it('allows explicit agent override', () => {
    const r = routeCategory('quick', 'architect');
    expect(r.agent).toBe('architect');
    expect(r.model).toBe('anthropic/claude-opus-4-6');
    expect(r.tier).toBe('tier_1');
  });
  it('falls back to builder for unknown categories', () => {
    const r = routeCategory('unknown-custom');
    expect(r.agent).toBe('builder');
    expect(r.tier).toBe('tier_2');
  });
});
