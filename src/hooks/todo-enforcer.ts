import { INCOMPLETE_WORK_PATTERNS } from '../shared/patterns.js';

export interface ToolResultContext {
  toolName: string;
  result: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

const TODO_PATTERNS = INCOMPLETE_WORK_PATTERNS;

export function detectIncompleteTodos(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of TODO_PATTERNS) {
    if (pattern.test(text)) {
      matches.push(pattern.source);
    }
  }
  return matches;
}

export function todoEnforcerHandler(context: ToolResultContext): string | undefined {
  const todos = detectIncompleteTodos(context.result);
  if (todos.length > 0) {
    return `⚠️ Incomplete items detected in tool result (${context.toolName}). Patterns found: ${todos.join(', ')}. You MUST continue working on these before stopping. Do not consider this task complete until all TODOs, FIXMEs, and unchecked items are resolved.`;
  }
  return undefined;
}
