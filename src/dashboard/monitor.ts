import type { Session, Task, Worker } from "../types/index.js";
import type { StateManager } from "../types/index.js";
import type { DashboardSession, DashboardStats } from "../dashboard/types.js";

export class SessionMonitor {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  getLiveSession(sessionId: string): DashboardSession | null {
    const session = this.stateManager.getSession(sessionId);
    if (!session) return null;

    const tasks = this.stateManager.listTasks(sessionId);
    const workers = this.stateManager.listWorkers(sessionId);

    return this.transformToDashboard(session, tasks, workers);
  }

  getAllActiveSessions(): DashboardSession[] {
    const sessions = this.stateManager.listSessions();
    const activeSessions = sessions.filter((s) => s.status === "active");

    return activeSessions.map((session) => {
      const tasks = this.stateManager.listTasks(session.id);
      const workers = this.stateManager.listWorkers(session.id);
      return this.transformToDashboard(session, tasks, workers);
    });
  }

  getStats(): DashboardStats {
    const sessions = this.stateManager.listSessions();
    const tasks = sessions.flatMap((s) => this.stateManager.listTasks(s.id));

    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const totalTasks = tasks.length;

    const agentCounts: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.assignedTo) {
        agentCounts[t.assignedTo] = (agentCounts[t.assignedTo] || 0) + 1;
      }
    });

    const topAgents = Object.entries(agentCounts)
      .map(([agent, taskCount]) => ({ agent, taskCount }))
      .sort((a, b) => b.taskCount - a.taskCount)
      .slice(0, 5);

    const totalCost = sessions.reduce(
      (sum, s) => sum + s.tokenUsage.costUsd,
      0,
    );

    const failedSessions = sessions.filter((session) => {
      if (session.status === "cancelled") {
        return false;
      }
      const sessionTasks = this.stateManager.listTasks(session.id);
      return sessionTasks.some((task) =>
        task.status === "failed" || task.status === "rejected"
      );
    }).length;

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === "active").length,
      completedSessions: sessions.filter((s) => s.status === "completed")
        .length,
      failedSessions,
      totalCost,
      averageCostPerSession:
        sessions.length > 0 ? totalCost / sessions.length : 0,
      averageCompletionRate:
        totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      topAgents,
    };
  }

  private transformToDashboard(
    session: Session,
    tasks: Task[],
    workers: Worker[],
  ): DashboardSession {
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const now = new Date();
    const start = new Date(session.createdAt);
    const elapsedMinutes = Math.floor(
      (now.getTime() - start.getTime()) / 60000,
    );

    const currentTask = tasks.find((t) => t.status === "in_progress");

    const sessionBudget = session.budget.sessionBudgetUsd;
    const percentUsed = sessionBudget > 0
      ? (session.tokenUsage.costUsd / sessionBudget) * 100
      : 0;

    return {
      id: session.id,
      status: session.status,
      mode: session.mode,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      elapsedMinutes,
      progress: {
        completedTasks,
        totalTasks: tasks.length,
        percentage:
          tasks.length > 0
            ? Math.round((completedTasks / tasks.length) * 100)
            : 0,
      },
      cost: {
        spent: session.tokenUsage.costUsd,
        budget: sessionBudget,
        percentUsed,
      },
      workers: workers.map((w) => ({
        workerId: w.workerId,
        agent: w.agent,
        status: w.status === "active" ? "working" : w.status,
        currentTaskId: w.taskId,
        lastHeartbeat: w.lastHeartbeat,
        commits: w.commits.length,
        cost: w.tokenUsage.costUsd,
      })),
      currentTask: currentTask
        ? {
            id: currentTask.id,
            description: currentTask.description,
            status: currentTask.status,
            assignedTo: currentTask.assignedTo,
            workerId: currentTask.workerId,
            startedAt: currentTask.startedAt,
            estimatedCompletion: undefined,
          }
        : undefined,
    };
  }
}
