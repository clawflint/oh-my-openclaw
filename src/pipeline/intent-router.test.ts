import { describe, it, expect } from 'vitest';
import { classifyIntent, getWorkflowForIntent, formatWorkflowPlan, INTENT_WORKFLOWS } from './intent-router.js';

describe('classifyIntent', () => {
  it('classifies explain intents', () => {
    expect(classifyIntent('explain how the auth module works')).toBe('explain');
    expect(classifyIntent('what is the purpose of this function')).toBe('explain');
    expect(classifyIntent('how does the routing work')).toBe('explain');
  });
  it('classifies implement intents', () => {
    expect(classifyIntent('add a new login page')).toBe('implement');
    expect(classifyIntent('create a REST API for users')).toBe('implement');
    expect(classifyIntent('build a caching layer')).toBe('implement');
  });
  it('classifies investigate intents', () => {
    expect(classifyIntent('why is the test failing')).toBe('investigate');
    expect(classifyIntent('debug the login flow')).toBe('investigate');
    expect(classifyIntent('find the cause of the memory leak')).toBe('investigate');
  });
  it('classifies refactor intents', () => {
    expect(classifyIntent('refactor the database module')).toBe('refactor');
    expect(classifyIntent('clean up the utility functions')).toBe('refactor');
    expect(classifyIntent('restructure the project layout')).toBe('refactor');
  });
  it('classifies evaluate intents', () => {
    expect(classifyIntent('review the pull request')).toBe('evaluate');
    expect(classifyIntent('what do you think about this approach')).toBe('evaluate');
    expect(classifyIntent('audit the security configuration')).toBe('evaluate');
  });
  it('classifies operate intents', () => {
    expect(classifyIntent('run tests')).toBe('operate');
    expect(classifyIntent('deploy to staging')).toBe('operate');
    expect(classifyIntent('build the project')).toBe('operate');
  });
  it('defaults to implement for ambiguous', () => {
    expect(classifyIntent('make it better')).toBe('implement');
  });
});

describe('getWorkflowForIntent', () => {
  it('returns correct stages for implement', () => {
    const wf = getWorkflowForIntent('implement');
    expect(wf.stages).toHaveLength(4);
    expect(wf.stages[0].agent).toBe('lead');
    expect(wf.stages[2].agent).toBe('builder');
    expect(wf.requiresApproval).toBe(true);
  });
  it('returns correct stages for explain', () => {
    const wf = getWorkflowForIntent('explain');
    expect(wf.stages).toHaveLength(3);
    expect(wf.stages[0].agent).toBe('scout');
    expect(wf.requiresApproval).toBe(false);
  });
  it('returns correct stages for investigate', () => {
    const wf = getWorkflowForIntent('investigate');
    expect(wf.stages.map(s => s.agent)).toContain('architect');
  });
  it('returns correct stages for refactor', () => {
    const wf = getWorkflowForIntent('refactor');
    expect(wf.stages).toHaveLength(5);
    expect(wf.stages.map(s => s.agent)).toContain('auditor');
  });
});

describe('INTENT_WORKFLOWS', () => {
  it('covers all 6 intents', () => {
    expect(Object.keys(INTENT_WORKFLOWS)).toHaveLength(6);
    expect(Object.keys(INTENT_WORKFLOWS)).toContain('explain');
    expect(Object.keys(INTENT_WORKFLOWS)).toContain('implement');
    expect(Object.keys(INTENT_WORKFLOWS)).toContain('investigate');
    expect(Object.keys(INTENT_WORKFLOWS)).toContain('refactor');
    expect(Object.keys(INTENT_WORKFLOWS)).toContain('evaluate');
    expect(Object.keys(INTENT_WORKFLOWS)).toContain('operate');
  });
});

describe('formatWorkflowPlan', () => {
  it('formats a readable workflow plan', () => {
    const wf = getWorkflowForIntent('implement');
    const formatted = formatWorkflowPlan(wf, 'add hello endpoint');
    expect(formatted).toContain('implement');
    expect(formatted).toContain('hello endpoint');
    expect(formatted).toContain('lead');
    expect(formatted).toContain('builder');
  });
});
