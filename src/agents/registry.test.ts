import { describe, test, expect } from 'bun:test';
import { getAgentConfig, listAgents, canUseTool } from './registry.js';

describe('Agent Registry', () => {
  test('should have all 11 agents registered', () => {
    const agents = listAgents();
    expect(agents.length).toBe(11);
  });

  test('should have Lead agent', () => {
    const lead = getAgentConfig('lead');
    expect(lead.name).toBe('Lead');
    expect(lead.layer).toBe('orchestration');
    expect(lead.mode).toBe('commander');
    expect(lead.defaultTier).toBe('tier_1');
  });

  test('should have Foreman agent', () => {
    const foreman = getAgentConfig('foreman');
    expect(foreman.name).toBe('Foreman');
    expect(foreman.layer).toBe('orchestration');
    expect(foreman.mode).toBe('operative');
  });

  test('should have Planner agent', () => {
    const planner = getAgentConfig('planner');
    expect(planner.name).toBe('Planner');
    expect(planner.layer).toBe('planning');
  });

  test('should have Auditor agent', () => {
    const auditor = getAgentConfig('auditor');
    expect(auditor.name).toBe('Auditor');
    expect(auditor.layer).toBe('planning');
  });

  test('should have Critic agent', () => {
    const critic = getAgentConfig('critic');
    expect(critic.name).toBe('Critic');
    expect(critic.layer).toBe('planning');
  });

  test('should have Builder agent', () => {
    const builder = getAgentConfig('builder');
    expect(builder.name).toBe('Builder');
    expect(builder.layer).toBe('execution');
    expect(builder.mode).toBe('versatile');
  });

  test('should have Architect agent', () => {
    const architect = getAgentConfig('architect');
    expect(architect.name).toBe('Architect');
    expect(architect.layer).toBe('execution');
    expect(architect.defaultTier).toBe('tier_1');
  });

  test('should have Reviewer agent', () => {
    const reviewer = getAgentConfig('reviewer');
    expect(reviewer.name).toBe('Reviewer');
    expect(reviewer.layer).toBe('verification');
  });

  test('should have Scout agent', () => {
    const scout = getAgentConfig('scout');
    expect(scout.name).toBe('Scout');
    expect(scout.layer).toBe('support');
    expect(scout.defaultTier).toBe('tier_3');
  });

  test('should have Researcher agent', () => {
    const researcher = getAgentConfig('researcher');
    expect(researcher.name).toBe('Researcher');
    expect(researcher.layer).toBe('support');
  });

  test('should have Observer agent', () => {
    const observer = getAgentConfig('observer');
    expect(observer.name).toBe('Observer');
    expect(observer.layer).toBe('support');
    expect(observer.defaultTier).toBe('multimodal');
  });
});

describe('Tool Permissions', () => {
  test('Lead should have all tools', () => {
    expect(canUseTool('lead', 'read')).toBe(true);
    expect(canUseTool('lead', 'write')).toBe(true);
    expect(canUseTool('lead', 'edit')).toBe(true);
    expect(canUseTool('lead', 'delegate')).toBe(true);
    expect(canUseTool('lead', 'summon')).toBe(true);
    expect(canUseTool('lead', 'bash')).toBe(true);
    expect(canUseTool('lead', 'test')).toBe(true);
    expect(canUseTool('lead', 'web_search')).toBe(true);
  });

  test('Foreman should not have write access', () => {
    expect(canUseTool('foreman', 'read')).toBe(true);
    expect(canUseTool('foreman', 'write')).toBe(false);
    expect(canUseTool('foreman', 'edit')).toBe(false);
    expect(canUseTool('foreman', 'bash')).toBe(false);
    expect(canUseTool('foreman', 'delegate')).toBe(true);
    expect(canUseTool('foreman', 'test')).toBe(true);
  });

  test('Builder should have write tools but not delegate', () => {
    expect(canUseTool('builder', 'read')).toBe(true);
    expect(canUseTool('builder', 'write')).toBe(true);
    expect(canUseTool('builder', 'edit')).toBe(true);
    expect(canUseTool('builder', 'bash')).toBe(true);
    expect(canUseTool('builder', 'test')).toBe(true);
    expect(canUseTool('builder', 'delegate')).toBe(false);
    expect(canUseTool('builder', 'summon')).toBe(false);
  });

  test('Scout should only have read access', () => {
    expect(canUseTool('scout', 'read')).toBe(true);
    expect(canUseTool('scout', 'write')).toBe(false);
    expect(canUseTool('scout', 'edit')).toBe(false);
    expect(canUseTool('scout', 'delegate')).toBe(false);
    expect(canUseTool('scout', 'bash')).toBe(false);
  });

  test('Reviewer should only have read and test access', () => {
    expect(canUseTool('reviewer', 'read')).toBe(true);
    expect(canUseTool('reviewer', 'test')).toBe(true);
    expect(canUseTool('reviewer', 'write')).toBe(false);
    expect(canUseTool('reviewer', 'edit')).toBe(false);
    expect(canUseTool('reviewer', 'bash')).toBe(false);
  });

  test('Planner should not have write or bash access', () => {
    expect(canUseTool('planner', 'read')).toBe(true);
    expect(canUseTool('planner', 'summon')).toBe(true);
    expect(canUseTool('planner', 'web_search')).toBe(true);
    expect(canUseTool('planner', 'write')).toBe(false);
    expect(canUseTool('planner', 'bash')).toBe(false);
    expect(canUseTool('planner', 'delegate')).toBe(false);
  });

  test('Auditor should only have read and web_search', () => {
    expect(canUseTool('auditor', 'read')).toBe(true);
    expect(canUseTool('auditor', 'web_search')).toBe(true);
    expect(canUseTool('auditor', 'write')).toBe(false);
    expect(canUseTool('auditor', 'delegate')).toBe(false);
    expect(canUseTool('auditor', 'summon')).toBe(false);
  });

  test('Critic should only have read access', () => {
    expect(canUseTool('critic', 'read')).toBe(true);
    expect(canUseTool('critic', 'write')).toBe(false);
    expect(canUseTool('critic', 'web_search')).toBe(false);
    expect(canUseTool('critic', 'delegate')).toBe(false);
  });
});

describe('Agent System Prompts', () => {
  test('all agents should have system prompts', () => {
    const agents = listAgents();
    for (const agent of agents) {
      expect(agent.systemPrompt).toBeTruthy();
      expect(agent.systemPrompt.length).toBeGreaterThan(0);
    }
  });

  test('Lead prompt should mention intent classification', () => {
    const lead = getAgentConfig('lead');
    expect(lead.systemPrompt.toLowerCase()).toContain('classify');
  });

  test('Builder prompt should mention implementation', () => {
    const builder = getAgentConfig('builder');
    expect(builder.systemPrompt.toLowerCase()).toContain('implement');
  });

  test('Reviewer prompt should mention quality', () => {
    const reviewer = getAgentConfig('reviewer');
    expect(reviewer.systemPrompt.toLowerCase()).toContain('quality');
  });
});
