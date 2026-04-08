import { INCOMPLETE_WORK_PATTERNS } from '../shared/patterns.js';

export interface RalphLoopConfig {
  maxIterations: number;
  enabled: boolean;
  cooldownMs: number;
}

export const DEFAULT_RALPH_CONFIG: RalphLoopConfig = {
  maxIterations: 100,
  enabled: true,
  cooldownMs: 5000,
};

export interface RalphState {
  iteration: number;
  lastCheckAt: number;
  incompleteTasks: string[];
  status: 'idle' | 'active' | 'paused' | 'completed' | 'max_iterations';
}

export function createInitialRalphState(): RalphState {
  return {
    iteration: 0,
    lastCheckAt: Date.now(),
    incompleteTasks: [],
    status: 'idle',
  };
}

const INCOMPLETE_PATTERNS = INCOMPLETE_WORK_PATTERNS;

const COMPLETION_SIGNALS = [
  /all (tasks|items|todos) (are )?(done|complete|finished)/i,
  /implementation complete/i,
  /all tests pass/i,
  /APPROVED/i,
  /no (remaining|outstanding) (tasks|items|work)/i,
  /nothing left to do/i,
];

export function detectIncompleteWork(text: string): string[] {
  const found: string[] = [];
  for (const pattern of INCOMPLETE_PATTERNS) {
    const match = text.match(pattern);
    if (match) found.push(match[0]);
  }
  return found;
}

export function detectCompletionSignal(text: string): boolean {
  for (const pattern of COMPLETION_SIGNALS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

export function evaluateRalphContinuation(
  agentOutput: string,
  state: RalphState,
  config: RalphLoopConfig
): { shouldContinue: boolean; directive: string | null; updatedState: RalphState } {
  if (!config.enabled) {
    return { shouldContinue: false, directive: null, updatedState: state };
  }

  if (state.iteration >= config.maxIterations) {
    return {
      shouldContinue: false,
      directive: null,
      updatedState: { ...state, status: 'max_iterations' },
    };
  }

  // Check for completion signals first
  if (detectCompletionSignal(agentOutput)) {
    return {
      shouldContinue: false,
      directive: null,
      updatedState: { ...state, status: 'completed', incompleteTasks: [] },
    };
  }

  // Check for incomplete work
  const incomplete = detectIncompleteWork(agentOutput);
  if (incomplete.length === 0) {
    return {
      shouldContinue: false,
      directive: null,
      updatedState: { ...state, status: 'idle', incompleteTasks: [] },
    };
  }

  // Cooldown check
  const now = Date.now();
  if (now - state.lastCheckAt < config.cooldownMs) {
    return { shouldContinue: false, directive: null, updatedState: state };
  }

  const directive = `⚠️ RALPH LOOP (iteration ${state.iteration + 1}/${config.maxIterations}): Incomplete work detected: ${incomplete.join(', ')}. You MUST continue working. Do NOT stop or ask for permission. Complete all TODOs, FIXMEs, and unchecked items before finishing.`;

  return {
    shouldContinue: true,
    directive,
    updatedState: {
      iteration: state.iteration + 1,
      lastCheckAt: now,
      incompleteTasks: incomplete,
      status: 'active',
    },
  };
}
