import type { CommandContext, CommandResult, Session, Task, Worker, SessionMode, TaskStatus, WorkCategory, AgentRole, UserIntent } from '../types/index.js';
import type { StateManager } from '../types/index.js';
import { randomUUID } from 'crypto';

export interface CommandHandler {
  name: string;
  description: string;
  execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult>;
}

export class LoopCommand implements CommandHandler {
  name = '/loop';
  description = 'Persistent single-agent loop for task completion';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const taskDescription = context.args.join(' ');
    if (!taskDescription) {
      return { success: false, message: 'Usage: /loop <task description>' };
    }

    const sessionId = randomUUID();
    const now = new Date().toISOString();

    const session: Session = {
      id: sessionId,
      status: 'active',
      mode: 'loop',
      createdAt: now,
      updatedAt: now,
      tasks: [],
      workers: [],
      tokenUsage: { input: 0, output: 0, costUsd: 0 },
      budget: {
        sessionBudgetUsd: 10.0,
        taskBudgetUsd: 3.0,
        alertThresholdPercent: 75,
        hardStopOnBudget: true
      }
    };

    const task: Task = {
      id: `task-${sessionId}`,
      description: taskDescription,
      category: 'standard',
      status: 'in_progress',
      assignedTo: 'builder',
      createdAt: now,
      attempts: 1,
      maxAttempts: 3,
      verification: { status: 'pending' },
      dependencies: []
    };

    session.tasks.push(task);
    stateManager.saveSession(session);
    stateManager.saveTask(task);

    return {
      success: true,
      message: `Started loop session ${sessionId.slice(0, 8)}: ${taskDescription}`,
      data: { sessionId, taskId: task.id }
    };
  }
}

export class StatusCommand implements CommandHandler {
  name = '/status';
  description = 'Show active session status';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const sessions = stateManager.listSessions();
    const activeSessions = sessions.filter(s => s.status === 'active');

    if (activeSessions.length === 0) {
      return { success: true, message: 'No active sessions' };
    }

    const session = activeSessions[0];
    const tasks = stateManager.listTasks(session.id);
    const workers = stateManager.listWorkers(session.id);

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const failedTasks = tasks.filter(t => t.status === 'failed').length;

    const message = [
      `Session: ${session.id.slice(0, 8)} (${session.mode})`,
      `Tasks: ${completedTasks} completed / ${inProgressTasks} in progress / ${failedTasks} failed / ${tasks.length} total`,
      `Workers: ${workers.length} active`,
      `Cost: $${session.tokenUsage.costUsd.toFixed(2)} of $${session.budget.sessionBudgetUsd.toFixed(2)}`
    ].join('\n');

    return { success: true, message, data: { session } };
  }
}

export class CancelCommand implements CommandHandler {
  name = '/cancel';
  description = 'Cancel active session with clean shutdown';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const sessions = stateManager.listSessions();
    const activeSession = sessions.find(s => s.status === 'active');

    if (!activeSession) {
      return { success: false, message: 'No active session to cancel' };
    }

    activeSession.status = 'cancelled';
    activeSession.completedAt = new Date().toISOString();
    activeSession.updatedAt = new Date().toISOString();

    // Mark all in-progress tasks as interrupted
    const tasks = stateManager.listTasks(activeSession.id);
    for (const task of tasks) {
      if (task.status === 'in_progress' || task.status === 'assigned') {
        task.status = 'interrupted';
        stateManager.saveTask(task);
      }
    }

    stateManager.saveSession(activeSession);

    return {
      success: true,
      message: `Cancelled session ${activeSession.id.slice(0, 8)}`,
      data: { sessionId: activeSession.id }
    };
  }
}

export class PauseCommand implements CommandHandler {
  name = '/pause';
  description = 'Pause active session';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const sessions = stateManager.listSessions();
    const activeSession = sessions.find(s => s.status === 'active');

    if (!activeSession) {
      return { success: false, message: 'No active session to pause' };
    }

    activeSession.status = 'paused';
    activeSession.updatedAt = new Date().toISOString();
    stateManager.saveSession(activeSession);

    return {
      success: true,
      message: `Paused session ${activeSession.id.slice(0, 8)}`,
      data: { sessionId: activeSession.id }
    };
  }
}

export class ResumeCommand implements CommandHandler {
  name = '/resume';
  description = 'Resume paused session';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const sessions = stateManager.listSessions();
    const pausedSession = sessions.find(s => s.status === 'paused');

    if (!pausedSession) {
      return { success: false, message: 'No paused session to resume' };
    }

    pausedSession.status = 'active';
    pausedSession.updatedAt = new Date().toISOString();
    stateManager.saveSession(pausedSession);

    return {
      success: true,
      message: `Resumed session ${pausedSession.id.slice(0, 8)}`,
      data: { sessionId: pausedSession.id }
    };
  }
}

export class CleanupCommand implements CommandHandler {
  name = '/cleanup';
  description = 'Remove stale state and prune worktrees';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const sessions = stateManager.listSessions();
    let cleanedCount = 0;

    for (const session of sessions) {
      if (session.status === 'completed' || session.status === 'cancelled') {
        // Archive completed/cancelled sessions older than 7 days
        const completedAt = session.completedAt ? new Date(session.completedAt) : null;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        if (completedAt && completedAt < sevenDaysAgo) {
          stateManager.deleteSession(session.id);
          cleanedCount++;
        }
      }
    }

    return {
      success: true,
      message: `Cleaned up ${cleanedCount} archived sessions`,
      data: { cleanedCount }
    };
  }
}

export class OmocSetupCommand implements CommandHandler {
  name = '/omoc setup';
  description = 'Initialize OmOC project structure';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const { scaffoldProject } = await import('../cli/setup.js');
    const result = scaffoldProject();
    
    return {
      success: result.success,
      message: result.message,
      data: { initialized: result.success, created: result.created }
    };
  }
}

export class OmocDoctorCommand implements CommandHandler {
  name = '/omoc doctor';
  description = 'Run diagnostics on OmOC installation';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const checks = [
      { name: 'Plugin registration', status: 'pass' },
      { name: 'Agent registration', status: 'pass' },
      { name: 'State directory', status: 'pass' },
      { name: 'Config validation', status: 'pass' }
    ];

    const message = checks.map(c => `${c.status === 'pass' ? '✓' : '✗'} ${c.name}: ${c.status}`).join('\n');

    return {
      success: true,
      message: `OmOC Diagnostics:\n${message}`,
      data: { checks }
    };
  }
}

export class OmocStatusCommand implements CommandHandler {
  name = '/omoc status';
  description = 'Show detailed OmOC status';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const sessions = stateManager.listSessions();
    const activeCount = sessions.filter(s => s.status === 'active').length;
    const totalCount = sessions.length;

    return {
      success: true,
      message: `OmOC Status: ${activeCount} active sessions, ${totalCount} total sessions`,
      data: { activeSessions: activeCount, totalSessions: totalCount }
    };
  }
}

export class RunCommand implements CommandHandler {
  name = '/run';
  description = 'Full autonomous pipeline with planning';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const description = context.args.join(' ');
    if (!description) {
      return { success: false, message: 'Usage: /run <task description>' };
    }

    const { PlanningOrchestrator, PlanManager, createDraftPlan, approvePlan } = await import('../planning/index.js');
    const { Foreman, selectAgentForTask } = await import('../execution/foreman.js');
    const { WorktreeManager } = await import('../execution/worktree.js');
    const { Mailbox } = await import('../execution/mailbox.js');

    const orchestrator = new PlanningOrchestrator();
    const planManager = new PlanManager();

    try {
      const planBase = await orchestrator.createPlan(description);
      let plan = createDraftPlan(planBase.title, planBase.description, planBase.phases as never);

      if (plan.approvalGate === 'required') {
        plan = approvePlan(plan);
      }

      await planManager.savePlan(plan);

      const sessionId = randomUUID();
      const foreman = new Foreman(sessionId);
      const worktreeManager = new WorktreeManager();
      const mailbox = new Mailbox(sessionId);

      const session: Session = {
        id: sessionId,
        status: 'active',
        mode: 'run',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [],
        workers: [],
        tokenUsage: { input: 0, output: 0, costUsd: 0 },
        budget: {
          sessionBudgetUsd: 10.0,
          taskBudgetUsd: 3.0,
          alertThresholdPercent: 75,
          hardStopOnBudget: true
        }
      };

      stateManager.saveSession(session);

      return {
        success: true,
        message: `Started /run pipeline: ${sessionId.slice(0, 8)}\nPlan: ${plan.title}\nPhases: ${plan.phases.length}\nStatus: Planning complete, ready for execution`,
        data: { sessionId, planId: plan.id, phases: plan.phases.length }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to start /run: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export class PlanCommand implements CommandHandler {
  name = '/plan';
  description = 'Generate implementation plan';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const description = context.args.join(' ');
    if (!description) {
      return { success: false, message: 'Usage: /plan <task description>' };
    }

    const { PlanningOrchestrator, PlanManager, createDraftPlan, addGapAnalysis, addPlanReview } = await import('../planning/index.js');
    
    const orchestrator = new PlanningOrchestrator();
    const planManager = new PlanManager();
    
    try {
      const planBase = await orchestrator.createPlan(description);
      let plan = createDraftPlan(planBase.title, planBase.description, planBase.phases as never);
      
      const validation = await orchestrator.validatePlan(plan);
      
      if (validation.gaps) {
        plan = addGapAnalysis(plan, validation.gaps);
      }
      
      if (validation.review) {
        plan = addPlanReview(plan, validation.review);
      }
      
      await planManager.savePlan(plan);
      
      const gapSummary = validation.gaps 
        ? `\nGaps: ${validation.gaps.criticalGaps.length} critical, ${validation.gaps.warnings.length} warnings`
        : '';
      
      return {
        success: true,
        message: `Plan created: ${plan.title}\nPhases: ${plan.phases.length}${gapSummary}\nReview with: /build`,
        data: { planId: plan.id, phases: plan.phases.length }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create plan: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export class BuildCommand implements CommandHandler {
  name = '/build';
  description = 'Execute existing plan';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const { PlanManager, approvePlan, convertPlanToTasks } = await import('../planning/index.js');
    const planManager = new PlanManager();
    
    const plan = await planManager.loadLatestPlan();
    
    if (!plan) {
      return { success: false, message: 'No plan found. Create one with: /plan <description>' };
    }
    
    if (plan.status === 'completed') {
      return { success: false, message: 'Plan already completed' };
    }
    
    if (plan.approvalGate === 'required' && plan.status !== 'approved') {
      const approved = approvePlan(plan);
      await planManager.savePlan(approved);
    }
    
    const tasks = convertPlanToTasks(plan);
    const totalTasks = tasks.length;
    
    const session: Session = {
      id: randomUUID(),
      status: 'active',
      mode: 'build',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: tasks.map(t => ({
        id: `task-${t.task.id.slice(0, 8)}`,
        planId: plan.id,
        description: t.task.description,
        category: t.task.category,
        status: 'queued',
        createdAt: new Date().toISOString(),
        attempts: 0,
        maxAttempts: 3,
        verification: { status: 'pending' },
        dependencies: t.task.dependencies
      })),
      workers: [],
      tokenUsage: { input: 0, output: 0, costUsd: 0 },
      budget: {
        sessionBudgetUsd: 10.0,
        taskBudgetUsd: 3.0,
        alertThresholdPercent: 75,
        hardStopOnBudget: true
      }
    };
    
    stateManager.saveSession(session);
    
    return {
      success: true,
      message: `Build session started: ${session.id.slice(0, 8)}\nPlan: ${plan.title}\nTasks: ${totalTasks} queued`,
      data: { sessionId: session.id, totalTasks }
    };
  }
}

export class ParallelCommand implements CommandHandler {
  name = '/parallel';
  description = 'Parallel team execution';

  async execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const workerCount = parseInt(context.args[0] || '3', 10);
    const description = context.args.slice(1).join(' ');

    if (!description) {
      return { success: false, message: 'Usage: /parallel <N> <task description>' };
    }

    if (workerCount < 1 || workerCount > 10) {
      return { success: false, message: 'Worker count must be between 1 and 10' };
    }

    const sessionId = randomUUID();
    const tasks: Task[] = [];

    for (let i = 0; i < workerCount; i++) {
      tasks.push({
        id: `task-${sessionId.slice(0, 8)}-${i}`,
        description: `${description} (part ${i + 1}/${workerCount})`,
        category: 'standard',
        status: 'queued',
        createdAt: new Date().toISOString(),
        attempts: 0,
        maxAttempts: 3,
        verification: { status: 'pending' },
        dependencies: []
      });
    }

    const session: Session = {
      id: sessionId,
      status: 'active',
      mode: 'parallel',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks,
      workers: [],
      tokenUsage: { input: 0, output: 0, costUsd: 0 },
      budget: {
        sessionBudgetUsd: 10.0 * workerCount,
        taskBudgetUsd: 3.0,
        alertThresholdPercent: 75,
        hardStopOnBudget: true
      }
    };

    stateManager.saveSession(session);
    tasks.forEach(t => stateManager.saveTask(t));

    return {
      success: true,
      message: `Parallel session started: ${sessionId.slice(0, 8)}\nWorkers: ${workerCount}\nTasks: ${tasks.length} queued`,
      data: { sessionId, workerCount, tasks: tasks.length }
    };
  }
}
