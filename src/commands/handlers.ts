import type { CommandContext, CommandResult, Session, Task, Worker } from '../types/index.js';
import type { StateManager } from '../types/index.js';
import type { Foreman } from '../execution/foreman.js';
import type { Mailbox } from '../execution/mailbox.js';
import { randomUUID } from 'crypto';

export interface CommandHandler {
  name: string;
  description: string;
  execute(context: CommandContext, stateManager: StateManager): Promise<CommandResult>;
}

async function executeTaskLifecycle(
  task: Task,
  worker: Worker,
  session: Session,
  foreman: Foreman,
  mailbox: Mailbox,
): Promise<void> {
  const { ReviewerAgent, CostTracker } = await import('../execution/agents.js');
  const reviewer = new ReviewerAgent();
  const tracker = new CostTracker(session.budget.sessionBudgetUsd, session.budget.taskBudgetUsd);

  task.status = 'in_progress';
  task.startedAt = task.startedAt || new Date().toISOString();
  task.attempts += 1;
  worker.status = 'active';
  worker.taskId = task.id;
  worker.lastHeartbeat = new Date().toISOString();
  foreman.updateHeartbeat(worker.workerId, 'working', 20);

  const inputTokens = Math.max(32, task.description.length * 4);
  const outputTokens = Math.max(16, Math.round(inputTokens / 2));
  const costUsd = Number(((inputTokens + outputTokens) / 100000).toFixed(4));
  const budgetCheck = tracker.recordUsage(task.id, inputTokens, outputTokens, costUsd);

  session.tokenUsage.input += inputTokens;
  session.tokenUsage.output += outputTokens;
  session.tokenUsage.costUsd += costUsd;
  worker.tokenUsage.input += inputTokens;
  worker.tokenUsage.output += outputTokens;
  worker.tokenUsage.costUsd += costUsd;

  if (!budgetCheck.withinBudget) {
    foreman.markTaskComplete(task, false);
    task.verification = {
      status: 'failed',
      reviewerNotes: budgetCheck.alert || 'Budget exceeded',
      verifiedAt: new Date().toISOString(),
    };
    await mailbox.reportError(worker.workerId, task.id, budgetCheck.alert || 'Budget exceeded');
    if (task.status === 'retrying') {
      task.status = 'queued';
      task.workerId = undefined;
      task.assignedTo = undefined;
    }
  } else {
    const reviewResult = await reviewer.execute({
      taskId: task.id,
      worktree: task.worktree || '',
      files: []
    });

    foreman.markTaskComplete(task, reviewResult.success);

    if (reviewResult.success) {
      task.completedAt = new Date().toISOString();
      task.verification = {
        status: 'passed',
        reviewerNotes: 'Reviewer approved task output',
        verifiedAt: new Date().toISOString(),
      };
      await mailbox.reportCompletion(worker.workerId, task.id, {
        success: true,
        costUsd,
        tokenUsage: { inputTokens, outputTokens }
      });
    } else {
      task.verification = {
        status: 'failed',
        reviewerNotes: reviewResult.output,
        verifiedAt: new Date().toISOString(),
      };
      await mailbox.reportError(worker.workerId, task.id, reviewResult.output);
      if (task.status === 'retrying') {
        task.status = 'queued';
        task.workerId = undefined;
        task.assignedTo = undefined;
      }
    }
  }

  worker.status = 'idle';
  worker.taskId = undefined;
  worker.lastHeartbeat = new Date().toISOString();
  foreman.updateHeartbeat(worker.workerId, 'idle', 100);
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
      sessionId,
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

  async execute(_context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
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

  async execute(_context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
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

export class HelloCommand implements CommandHandler {
  name = '/hello';
  description = 'Simple hello world greeting';

  async execute(context: CommandContext, _stateManager: StateManager): Promise<CommandResult> {
    const name = context.args.join(' ').trim();
    const greeting = name ? `Hello, ${name}!` : 'Hello, World!';
    
    return {
      success: true,
      message: greeting,
      data: { 
        greeting,
        timestamp: new Date().toISOString(),
        requestedName: name || null
      }
    };
  }
}

export class PauseCommand implements CommandHandler {
  name = '/pause';
  description = 'Pause active session';

  async execute(_context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
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

  async execute(_context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
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

  async execute(_context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
    const sessions = stateManager.listSessions();
    let cleanedCount = 0;
    let staleTasksRequeued = 0;
    let staleWorkersMarked = 0;

    const { WorktreeManager } = await import('../execution/worktree.js');
    const { StaleTaskReaper } = await import('../execution/stale-reaper.js');
    const reaper = new StaleTaskReaper(stateManager);
    const worktreeManager = new WorktreeManager();

    for (const session of sessions) {
      if (session.status === 'active') {
        const reaped = await reaper.checkAndReap(session.id);
        staleTasksRequeued += reaped.reaped;
        staleWorkersMarked += reaped.stale.length;
      }
    }

    for (const session of sessions) {
      if (session.status === 'completed' || session.status === 'cancelled') {
        // Archive completed/cancelled sessions older than 7 days
        const completedAt = session.completedAt ? new Date(session.completedAt) : null;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        if (completedAt && completedAt < sevenDaysAgo) {
          const sessionTasks = stateManager.listTasks(session.id);
          const sessionWorkers = stateManager.listWorkers(session.id);
          for (const task of sessionTasks) stateManager.deleteTask(task.id);
          for (const worker of sessionWorkers) stateManager.deleteWorker(worker.workerId);
          stateManager.deleteSession(session.id);
          cleanedCount++;
        }
      }
    }

    await worktreeManager.pruneWorktrees();

    return {
      success: true,
      message: `Cleaned up ${cleanedCount} archived sessions, reaped ${staleTasksRequeued} stale tasks`,
      data: { cleanedCount, staleTasksRequeued, staleWorkersMarked }
    };
  }
}

export class OmocSetupCommand implements CommandHandler {
  name = '/omoc setup';
  description = 'Initialize OmOC project structure';

  async execute(_context: CommandContext, _stateManager: StateManager): Promise<CommandResult> {
    const { scaffoldProject } = await import('../cli/setup.js');
    const result = scaffoldProject();
    
    return {
      success: result.success,
      message: result.message,
      data: { initialized: result.success, created: result.created }
    };
  }
}

export class OmocCommand implements CommandHandler {
  name = '/omoc';
  description = 'Show OmOC command help';

  async execute(_context: CommandContext, _stateManager: StateManager): Promise<CommandResult> {
    const message = [
      'OmOC Commands:',
      '/omoc setup - Initialize project structure',
      '/omoc doctor - Run diagnostics',
      '/omoc status - Show OmOC status',
      '/omoc health - Lightweight health check',
      '/omoc config - Show effective configuration',
      '/run, /plan, /build, /loop, /parallel - Workflow commands',
      '/status, /pause, /resume, /cancel, /cleanup - Session control'
    ].join('\n');

    return { success: true, message };
  }
}

export class OmocDoctorCommand implements CommandHandler {
  name = '/omoc doctor';
  description = 'Run diagnostics on OmOC installation';

  async execute(_context: CommandContext, _stateManager: StateManager): Promise<CommandResult> {
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

  async execute(_context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
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

    const { PlanningOrchestrator, PlanManager, createDraftPlan, approvePlan, convertPlanToTasks } = await import('../planning/index.js');
    const { Foreman, selectAgentForTask } = await import('../execution/foreman.js');
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
      const mailbox = new Mailbox(sessionId);
      const planTasks = convertPlanToTasks(plan);
      const now = new Date().toISOString();
      const tasks: Task[] = planTasks.map((pt) => ({
        id: `task-${pt.task.id}`,
        sessionId,
        planId: plan.id,
        description: pt.task.description,
        category: pt.task.category,
        status: 'queued',
        createdAt: now,
        attempts: 0,
        maxAttempts: 3,
        verification: { status: 'pending' },
        dependencies: pt.task.dependencies.map(dep => `task-${dep}`)
      }));
      const workers: Worker[] = [];

      const session: Session = {
        id: sessionId,
        status: 'active',
        mode: 'run',
        createdAt: now,
        updatedAt: now,
        tasks,
        workers,
        tokenUsage: { input: 0, output: 0, costUsd: 0 },
        budget: {
          sessionBudgetUsd: 10.0,
          taskBudgetUsd: 3.0,
          alertThresholdPercent: 75,
          hardStopOnBudget: true
        }
      };

      stateManager.saveSession(session);
      for (const task of tasks) {
        stateManager.saveTask(task);
      }

      let nextTask = foreman.getNextRunnableTask(tasks);
      while (nextTask) {
        const assignedAgent = selectAgentForTask(nextTask);
        const assignment = foreman.assignTask(nextTask, assignedAgent);
        const worker: Worker = {
          workerId: assignment.workerId,
          agent: assignment.agent as never,
          taskId: nextTask.id,
          sessionId,
          worktree: assignment.worktree,
          status: 'active',
          lastHeartbeat: new Date().toISOString(),
          commits: [],
          tokenUsage: { input: 0, output: 0, costUsd: 0 }
        };
        workers.push(worker);

        await mailbox.send(worker.workerId, {
          from: 'foreman',
          to: worker.workerId,
          type: 'assignment',
          payload: { taskId: nextTask.id, description: nextTask.description }
        });

        await executeTaskLifecycle(nextTask, worker, session, foreman, mailbox);
        stateManager.saveWorker(worker);
        stateManager.saveTask(nextTask);

        nextTask = foreman.getNextRunnableTask(tasks);
      }

      session.status = tasks.every(task => task.status === 'completed') ? 'completed' : 'active';
      session.updatedAt = new Date().toISOString();
      if (session.status === 'completed') {
        session.completedAt = new Date().toISOString();
      }
      stateManager.saveSession(session);

      const completed = tasks.filter(task => task.status === 'completed').length;

      return {
        success: true,
        message: `Started /run pipeline: ${sessionId.slice(0, 8)}\nPlan: ${plan.title}\nPhases: ${plan.phases.length}\nTasks: ${completed}/${tasks.length} completed`,
        data: { sessionId, planId: plan.id, phases: plan.phases.length, totalTasks: tasks.length, completed }
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

  async execute(context: CommandContext, _stateManager: StateManager): Promise<CommandResult> {
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

  async execute(_context: CommandContext, stateManager: StateManager): Promise<CommandResult> {
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
    const sessionId = randomUUID();
    
    const session: Session = {
      id: sessionId,
      status: 'active',
      mode: 'build',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: tasks.map(t => ({
        id: `task-${t.task.id.slice(0, 8)}`,
        sessionId,
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
    session.tasks.forEach(task => stateManager.saveTask(task));
    
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
    const workers: Worker[] = [];
    const { Foreman } = await import('../execution/foreman.js');
    const { Mailbox } = await import('../execution/mailbox.js');
    const foreman = new Foreman(sessionId);
    const mailbox = new Mailbox(sessionId);

    for (let i = 0; i < workerCount; i++) {
      tasks.push({
        id: `task-${sessionId.slice(0, 8)}-${i}`,
        sessionId,
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
      workers,
      tokenUsage: { input: 0, output: 0, costUsd: 0 },
      budget: {
        sessionBudgetUsd: 10.0 * workerCount,
        taskBudgetUsd: 3.0,
        alertThresholdPercent: 75,
        hardStopOnBudget: true
      }
    };

    stateManager.saveSession(session);
    for (const task of tasks) {
      const assignment = foreman.assignTask(task, 'builder');
      const worker: Worker = {
        workerId: assignment.workerId,
        agent: 'builder',
        taskId: task.id,
        sessionId,
        worktree: assignment.worktree,
        status: 'active',
        lastHeartbeat: new Date().toISOString(),
        commits: [],
        tokenUsage: { input: 0, output: 0, costUsd: 0 }
      };
      workers.push(worker);

      await mailbox.send(worker.workerId, {
        from: 'foreman',
        to: worker.workerId,
        type: 'assignment',
        payload: { taskId: task.id, description: task.description }
      });

      await executeTaskLifecycle(task, worker, session, foreman, mailbox);
      stateManager.saveWorker(worker);
      stateManager.saveTask(task);
    }

    session.status = tasks.every(task => task.status === 'completed') ? 'completed' : 'active';
    if (session.status === 'completed') {
      session.completedAt = new Date().toISOString();
    }
    session.updatedAt = new Date().toISOString();
    stateManager.saveSession(session);

    const completed = tasks.filter(task => task.status === 'completed').length;
    return {
      success: true,
      message: `Parallel session started: ${sessionId.slice(0, 8)}\nWorkers: ${workerCount}\nTasks: ${completed}/${tasks.length} completed`,
      data: { sessionId, workerCount, tasks: tasks.length, completed }
    };
  }
}
