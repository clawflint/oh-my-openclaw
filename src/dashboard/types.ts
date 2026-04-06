/**
 * Dashboard API Types for ClawFlint Integration
 * These types enable the ClawFlint dashboard to consume OmOC data
 */

export interface DashboardSession {
  id: string;
  status: "created" | "active" | "paused" | "cancelled" | "completed";
  mode: "run" | "plan" | "build" | "loop" | "parallel";
  createdAt: string;
  updatedAt: string;
  elapsedMinutes: number;
  progress: {
    completedTasks: number;
    totalTasks: number;
    percentage: number;
  };
  cost: {
    spent: number;
    budget: number;
    percentUsed: number;
  };
  workers: DashboardWorker[];
  currentTask?: DashboardTask;
}

export interface DashboardWorker {
  workerId: string;
  agent: string;
  status: "idle" | "working" | "stale" | "terminated";
  currentTaskId?: string;
  lastHeartbeat: string;
  commits: number;
  cost: number;
}

export interface DashboardTask {
  id: string;
  description: string;
  status: string;
  assignedTo?: string;
  workerId?: string;
  startedAt?: string;
  estimatedCompletion?: string;
}

export interface DashboardEvent {
  id: string;
  sessionId: string;
  type: DashboardEventType;
  timestamp: string;
  payload: Record<string, unknown>;
  channel: string;
}

export type DashboardEventType =
  | "session.start"
  | "session.complete"
  | "session.error"
  | "task.assigned"
  | "task.completed"
  | "task.failed"
  | "worker.heartbeat"
  | "worker.stale"
  | "git.commit"
  | "git.merge"
  | "verification.pass"
  | "verification.fail"
  | "cost.alert"
  | "plan.ready";

export interface CostBreakdown {
  sessionId: string;
  totalCost: number;
  byAgent: Record<string, number>;
  byModel: Record<string, number>;
  byTask: Array<{ taskId: string; cost: number; description: string }>;
  timeline: Array<{ timestamp: string; cumulativeCost: number }>;
}

export interface TeamConfiguration {
  id: string;
  name: string;
  agents: Array<{
    role: string;
    enabled: boolean;
    modelTier: string;
    customModel?: string;
  }>;
  workflowDefaults: {
    approvalGate: "required" | "auto" | "skip";
    maxWorkers: number;
    sessionBudget: number;
  };
  eventRouting: {
    channels: Record<string, string>;
    mentionPolicy: Record<string, string>;
  };
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "feature" | "bugfix" | "refactor" | "research";
  defaultAgents: string[];
  suggestedPrompt: string;
}

export interface SessionFilters {
  status?: ("active" | "paused" | "completed" | "cancelled")[];
  mode?: ("run" | "plan" | "loop" | "parallel")[];
  dateRange?: { from: string; to: string };
  minCost?: number;
  maxCost?: number;
}

export interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  totalCost: number;
  averageCostPerSession: number;
  averageCompletionRate: number;
  topAgents: Array<{ agent: string; taskCount: number }>;
}
