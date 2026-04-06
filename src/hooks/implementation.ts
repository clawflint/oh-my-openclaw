import type { Task, Session } from '../types/index.js';

export interface HookContext {
  session?: Session;
  task?: Task;
  toolName?: string;
  toolArgs?: unknown[];
  toolResult?: unknown;
  message?: string;
}

export interface HookResult {
  allowed: boolean;
  modified?: unknown;
  message?: string;
}

export abstract class Hook {
  abstract readonly name: string;
  abstract readonly tier: 'session' | 'guard' | 'transform' | 'continuation' | 'skill';
  
  abstract execute(context: HookContext): HookResult | Promise<HookResult>;
}

export class CommentQualityHook extends Hook {
  readonly name = 'comment-quality';
  readonly tier = 'guard';

  private boilerplatePatterns = [
    /this\s+is\s+a\s+(generated|auto|ai)\s+(comment|code)/i,
    /TODO:\s*implement/i,
    /FIXME:\s*needed/i,
    /\*\s*created\s+by\s+AI/i
  ];

  execute(context: HookContext): HookResult {
    if (context.toolName !== 'write' && context.toolName !== 'edit') {
      return { allowed: true };
    }

    const content = context.toolArgs?.[1] as string;
    if (!content) return { allowed: true };

    const issues: string[] = [];

    for (const pattern of this.boilerplatePatterns) {
      if (pattern.test(content)) {
        issues.push(`Detected boilerplate comment matching: ${pattern.source}`);
      }
    }

    const commentRatio = this.calculateCommentRatio(content);
    if (commentRatio > 0.3) {
      issues.push('High comment-to-code ratio detected');
    }

    if (issues.length > 0) {
      return {
        allowed: false,
        message: `Comment quality issues: ${issues.join(', ')}`
      };
    }

    return { allowed: true };
  }

  private calculateCommentRatio(content: string): number {
    const lines = content.split('\n');
    const commentLines = lines.filter(line => 
      line.trim().startsWith('//') || 
      line.trim().startsWith('/*') || 
      line.trim().startsWith('*')
    ).length;
    
    return commentLines / lines.length;
  }
}

export class ContextWindowMonitorHook extends Hook {
  readonly name = 'context-window-monitor';
  readonly tier = 'guard';

  private threshold: number;

  constructor(threshold: number = 0.85) {
    super();
    this.threshold = threshold;
  }

  execute(context: HookContext): HookResult {
    const currentUsage = this.estimateContextUsage(context);

    if (currentUsage > this.threshold) {
      return {
        allowed: false,
        message: `Context window at ${(currentUsage * 100).toFixed(0)}%. Consider starting a new session.`
      };
    }

    if (currentUsage > this.threshold * 0.9) {
      return {
        allowed: true,
        message: `Warning: Context window at ${(currentUsage * 100).toFixed(0)}%`
      };
    }

    return { allowed: true };
  }

  private estimateContextUsage(_context: HookContext): number {
    return 0.5;
  }
}

export class CostBudgetCheckHook extends Hook {
  readonly name = 'cost-budget-check';
  readonly tier = 'guard';

  execute(context: HookContext): HookResult {
    const session = context.session;
    if (!session) return { allowed: true };

    const usage = session.tokenUsage.costUsd;
    const budget = session.budget.sessionBudgetUsd;
    const percentUsed = (usage / budget) * 100;

    if (usage > budget) {
      return {
        allowed: false,
        message: `Budget exceeded: $${usage.toFixed(2)} of $${budget.toFixed(2)}`
      };
    }

    if (percentUsed > session.budget.alertThresholdPercent) {
      return {
        allowed: true,
        message: `Budget alert: ${percentUsed.toFixed(0)}% used`
      };
    }

    return { allowed: true };
  }
}

export class SessionRecoveryHook extends Hook {
  readonly name = 'session-recovery';
  readonly tier = 'session';

  execute(context: HookContext): HookResult {
    if (!context.session) return { allowed: true };

    const session = context.session;
    
    if (session.status === 'active') {
      return { allowed: true };
    }

    if (session.status === 'paused') {
      return {
        allowed: false,
        message: 'Session is paused. Use /resume to continue.'
      };
    }

    return { allowed: true };
  }
}

export class CompactionPreserverHook extends Hook {
  readonly name = 'compaction-preserver';
  readonly tier = 'session';

  private preserveKeys = [
    'notepad',
    'agentsMd',
    'taskState',
    'planState'
  ];

  execute(context: HookContext): HookResult {
    return {
      allowed: true,
      modified: this.preserveCriticalContext(context)
    };
  }

  private preserveCriticalContext(context: HookContext): Record<string, unknown> {
    const preserved: Record<string, unknown> = {};

    for (const key of this.preserveKeys) {
      if (context.session && key in context.session) {
        preserved[key] = ((context.session as unknown) as Record<string, unknown>)[key];
      }
    }

    return preserved;
  }
}

export class ToolPermissionCheckHook extends Hook {
  readonly name = 'tool-permission-check';
  readonly tier = 'guard';

  private permissions: Map<string, string[]> = new Map();

  setPermissions(agent: string, tools: string[]): void {
    this.permissions.set(agent, tools);
  }

  execute(context: HookContext): HookResult {
    if (!context.toolName || !context.task?.assignedTo) {
      return { allowed: true };
    }

    const agent = context.task.assignedTo;
    const allowedTools = this.permissions.get(agent) || [];

    if (!allowedTools.includes(context.toolName)) {
      return {
        allowed: false,
        message: `Agent ${agent} does not have permission to use tool: ${context.toolName}`
      };
    }

    return { allowed: true };
  }
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

  async executeTier(tier: Hook['tier'], context: HookContext): Promise<HookResult[]> {
    const hooks = this.listByTier(tier);
    const results: HookResult[] = [];

    for (const hook of hooks) {
      try {
        const result = await hook.execute(context);
        results.push(result);

        if (!result.allowed) {
          break;
        }
      } catch {
        results.push({ allowed: false, message: `Hook ${hook.name} failed` });
        break;
      }
    }

    return results;
  }
}

export const hookRegistry = new HookRegistry();
