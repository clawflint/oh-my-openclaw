export const CORE_HOOKS = {
  INTENT_CLASSIFIER: 'intent-classifier',
  AGENTS_MD_INJECTOR: 'agents-md-injector',
  CONTEXT_WINDOW_MONITOR: 'context-window-monitor',
  COST_BUDGET_CHECK: 'cost-budget-check',
  TOOL_PERMISSION_CHECK: 'tool-permission-check',
  TODO_ENFORCER: 'todo-enforcer',
  LOOP_MANAGER: 'loop-manager',
  VERIFICATION_GATE: 'verification-gate',
  COMMENT_QUALITY: 'comment-quality',
  SESSION_RECOVERY: 'session-recovery',
  COMPACTION_PRESERVER: 'compaction-preserver',
  STALE_TASK_REAPER: 'stale-task-reaper',
  EVENT_EMITTER: 'event-emitter'
} as const;

export interface Hook {
  name: string;
  tier: 'session' | 'guard' | 'transform' | 'continuation' | 'skill';
  execute: (context: unknown) => unknown | Promise<unknown>;
}

export class HookRegistry {
  private hooks: Map<string, Hook> = new Map();

  register(hook: Hook): void {
    this.hooks.set(hook.name, hook);
  }

  get(name: string): Hook | undefined {
    return this.hooks.get(name);
  }

  list(): Hook[] {
    return Array.from(this.hooks.values());
  }

  listByTier(tier: Hook['tier']): Hook[] {
    return this.list().filter(h => h.tier === tier);
  }
}

export const hookRegistry = new HookRegistry();
export * from './implementation.js';
export { contextInjectorHandler } from './context-injector.js';
export { keywordDetectorHandler, detectKeywords } from './keyword-detector.js';
export { todoEnforcerHandler, detectIncompleteTodos } from './todo-enforcer.js';
export { evaluateRalphContinuation, detectIncompleteWork, detectCompletionSignal, createInitialRalphState, DEFAULT_RALPH_CONFIG } from '../services/ralph-loop.js';
export { pipelineEnforcerHandler, enforceRunPipeline, enforcePlanPipeline } from './pipeline-enforcer.js';
export { commentCheckerHandler, detectAiSlop, AI_SLOP_PATTERNS } from './comment-checker.js';
export { ultraworkEnforcerHandler, enforceUltraworkPipeline } from './ultrawork-enforcer.js';
