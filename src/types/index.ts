/**
 * Core types for OmOC plugin
 */

// Agent types
export type AgentRole = 
  | 'lead'
  | 'foreman'
  | 'planner'
  | 'auditor'
  | 'critic'
  | 'builder'
  | 'architect'
  | 'reviewer'
  | 'scout'
  | 'researcher'
  | 'observer';

export type AgentMode = 'commander' | 'operative' | 'versatile';

export type AgentLayer = 'planning' | 'orchestration' | 'execution' | 'verification' | 'support';

export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  layer: AgentLayer;
  mode: AgentMode;
  defaultTier: ModelTier;
  allowedTools: ToolName[];
  deniedTools: ToolName[];
  systemPrompt: string;
}

// Model types
export type ModelTier = 'tier_1' | 'tier_2' | 'tier_3' | 'multimodal';

export interface ModelConfig {
  model: string;
  variant?: string;
  fallback: string[];
  temperature?: number;
  maxTokens?: number;
}

// Category types
export type WorkCategory = 
  | 'quick'
  | 'standard'
  | 'deep'
  | 'strategic'
  | 'visual'
  | 'research'
  | 'creative'
  | string; // Custom categories

export interface CategoryConfig {
  purpose: string;
  defaultTier: ModelTier;
  model?: string;
  temperature?: number;
  promptAppend?: string;
}

// Tool types
export type ToolName = 
  | 'read'
  | 'write'
  | 'edit'
  | 'delegate'
  | 'summon'
  | 'bash'
  | 'test'
  | 'web_search'
  | 'git_merge';

// Intent types
export type UserIntent =
  | 'explain'
  | 'implement'
  | 'investigate'
  | 'refactor'
  | 'evaluate'
  | 'operate';

// Session types
export type SessionStatus = 
  | 'created'
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'completed';

export interface Session {
  id: string;
  status: SessionStatus;
  mode: SessionMode;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  tasks: Task[];
  workers: Worker[];
  tokenUsage: TokenUsage;
  budget: BudgetConfig;
}

export type SessionMode = 'run' | 'plan' | 'build' | 'loop' | 'parallel';

// Task types
export type TaskStatus =
  | 'created'
  | 'queued'
  | 'assigned'
  | 'in_progress'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'retrying'
  | 're_assigned'
  | 'conflict'
  | 'interrupted';

export interface Task {
  id: string;
  sessionId?: string;
  planId?: string;
  description: string;
  category: WorkCategory;
  status: TaskStatus;
  assignedTo?: AgentRole;
  workerId?: string;
  worktree?: string;
  branch?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  attempts: number;
  maxAttempts: number;
  verification: VerificationState;
  dependencies: string[];
  blockedBy?: string;
}

export interface VerificationState {
  status: 'pending' | 'passed' | 'failed';
  reviewerNotes?: string;
  verifiedAt?: string;
}

// Worker types
export type WorkerStatus = 'active' | 'idle' | 'stale' | 'terminated';

export interface Worker {
  workerId: string;
  agent: AgentRole;
  taskId?: string;
  sessionId: string;
  worktree?: string;
  status: WorkerStatus;
  lastHeartbeat: string;
  commits: string[];
  tokenUsage: TokenUsage;
}

// Budget types
export interface TokenUsage {
  input: number;
  output: number;
  costUsd: number;
}

export interface BudgetConfig {
  sessionBudgetUsd: number;
  taskBudgetUsd: number;
  alertThresholdPercent: number;
  hardStopOnBudget: boolean;
}

// Configuration types
export interface OmocConfig {
  $schema?: string;
  project: ProjectConfig;
  modelTiers: Record<ModelTier, ModelConfig>;
  agents: Partial<Record<AgentRole, Partial<AgentConfig>>>;
  categories: Record<WorkCategory, CategoryConfig>;
  customCategories?: Record<string, CategoryConfig>;
  workflows: WorkflowConfig;
  concurrency: ConcurrencyConfig;
  costControls: CostControlsConfig;
  disabledHooks?: string[];
  hookConfig?: Record<string, unknown>;
  eventRouting: EventRoutingConfig;
  disabledAgents?: AgentRole[];
}

export interface ProjectConfig {
  name: string;
  repo: string;
  branch?: string;
  workingDirectory?: string;
}

export interface WorkflowConfig {
  defaultApprovalGate: 'required' | 'auto' | 'skip';
  loopMaxIterations: number;
  parallelMaxWorkers: number;
}

export interface ConcurrencyConfig {
  maxParallelWorkers: number;
  maxBackgroundTasks: number;
  perProviderLimit: number;
  perModelLimit: number;
  staleTaskTimeoutSeconds: number;
}

export interface CostControlsConfig {
  sessionBudgetUsd: number;
  taskBudgetUsd: number;
  alertThresholdPercent: number;
  hardStopOnBudget: boolean;
}

export interface EventRoutingConfig {
  channels: Record<string, string>;
  mentionPolicy: Record<string, string>;
  suppression?: Record<string, { cooldownSeconds?: number; interval?: number }>;
  summaryMode?: {
    enabled: boolean;
    batchIntervalSeconds: number;
    batchEvents: string[];
    format: string;
  };
}

// Plugin types
export interface PluginContext {
  config: OmocConfig;
  stateManager: StateManager;
  eventRouter: EventRouter;
}

export interface StateManager {
  getSession(sessionId: string): Session | null;
  saveSession(session: Session): void;
  deleteSession(sessionId: string): void;
  getTask(taskId: string): Task | null;
  saveTask(task: Task): void;
  deleteTask(taskId: string): void;
  getWorker(workerId: string): Worker | null;
  saveWorker(worker: Worker): void;
  deleteWorker(workerId: string): void;
  listSessions(): Session[];
  listTasks(sessionId: string): Task[];
  listWorkers(sessionId: string): Worker[];
}

export interface EventRouter {
  emit(eventType: string, payload: unknown): void;
  route(eventType: string, payload: unknown, route: string): void;
}

// Command types
export interface CommandContext {
  sessionId: string;
  userId: string;
  channelId: string;
  args: string[];
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// AGENTS.md types
export interface AgentsOverlay {
  executionProtocol?: string;
  constraints: string[];
  verificationRequirements?: string;
  cancellationProtocol?: string;
  stateManagement?: string;
  technologyContext?: string;
}
