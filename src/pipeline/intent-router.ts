// src/pipeline/intent-router.ts
import type { AgentRole } from '../types/index.js';

export type UserIntent = 'explain' | 'implement' | 'investigate' | 'refactor' | 'evaluate' | 'operate';

export interface IntentWorkflow {
  intent: UserIntent;
  stages: Array<{ stage: string; agent: AgentRole; description: string }>;
  requiresApproval: boolean;
}

export const INTENT_WORKFLOWS: Record<UserIntent, IntentWorkflow> = {
  explain: {
    intent: 'explain',
    stages: [
      { stage: 'scout', agent: 'scout', description: 'Search codebase for relevant files' },
      { stage: 'research', agent: 'researcher', description: 'Gather documentation context' },
      { stage: 'explain', agent: 'lead', description: 'Synthesize and explain to user' },
    ],
    requiresApproval: false,
  },
  implement: {
    intent: 'implement',
    stages: [
      { stage: 'classify', agent: 'lead', description: 'Classify intent and complexity' },
      { stage: 'plan', agent: 'planner', description: 'Create phased plan' },
      { stage: 'build', agent: 'builder', description: 'Implement the plan' },
      { stage: 'review', agent: 'reviewer', description: 'Quality gate' },
    ],
    requiresApproval: true,
  },
  investigate: {
    intent: 'investigate',
    stages: [
      { stage: 'scout', agent: 'scout', description: 'Search for symptoms and patterns' },
      { stage: 'analyze', agent: 'architect', description: 'Root cause analysis' },
      { stage: 'report', agent: 'lead', description: 'Present findings' },
    ],
    requiresApproval: false,
  },
  refactor: {
    intent: 'refactor',
    stages: [
      { stage: 'scout', agent: 'scout', description: 'Map current code structure' },
      { stage: 'plan', agent: 'architect', description: 'Design refactoring approach' },
      { stage: 'audit', agent: 'auditor', description: 'Validate plan safety' },
      { stage: 'build', agent: 'builder', description: 'Execute refactoring' },
      { stage: 'review', agent: 'reviewer', description: 'Verify no regressions' },
    ],
    requiresApproval: true,
  },
  evaluate: {
    intent: 'evaluate',
    stages: [
      { stage: 'scout', agent: 'scout', description: 'Gather code and context' },
      { stage: 'review', agent: 'reviewer', description: 'Code quality assessment' },
      { stage: 'critique', agent: 'critic', description: 'Architectural critique' },
      { stage: 'report', agent: 'lead', description: 'Synthesize evaluation' },
    ],
    requiresApproval: false,
  },
  operate: {
    intent: 'operate',
    stages: [
      { stage: 'classify', agent: 'lead', description: 'Determine operation type' },
      { stage: 'execute', agent: 'builder', description: 'Run operation (test/build/deploy)' },
      { stage: 'verify', agent: 'reviewer', description: 'Verify operation success' },
    ],
    requiresApproval: true,
  },
};

export function getWorkflowForIntent(intent: UserIntent): IntentWorkflow {
  return INTENT_WORKFLOWS[intent];
}

export function classifyIntent(taskDescription: string): UserIntent {
  const lower = taskDescription.toLowerCase();

  // Explain patterns
  if (/\b(explain|how does|what is|what are|describe|tell me about|help me understand)\b/.test(lower)) return 'explain';

  // Investigate patterns
  if (/\b(why is|debug|find the cause|investigate|diagnose|trace|what happened|broken)\b/.test(lower)) return 'investigate';

  // Refactor patterns
  if (/\b(refactor|restructure|clean up|reorganize|simplify|extract|rename|move)\b/.test(lower)) return 'refactor';

  // Evaluate patterns
  if (/\b(review|evaluate|assess|audit|what do you think|analyze|critique)\b/.test(lower)) return 'evaluate';

  // Operate patterns
  if (/\b(deploy|run tests|run the|start|stop|restart|install|update|migrate)\b/.test(lower)) return 'operate';
  if (/\bbuild\s+(the\s+)?(project|app|application|docker|image|artifact)\b/.test(lower)) return 'operate';

  // Default: implement
  return 'implement';
}

export function formatWorkflowPlan(workflow: IntentWorkflow, task: string): string {
  const lines = [
    `**Intent: ${workflow.intent}** | Approval: ${workflow.requiresApproval ? 'required' : 'not needed'}`,
    `**Task:** ${task}`,
    '',
    '**Stages:**',
    ...workflow.stages.map((s, i) => `${i + 1}. **${s.stage}** → ${s.agent}: ${s.description}`),
  ];
  return lines.join('\n');
}
