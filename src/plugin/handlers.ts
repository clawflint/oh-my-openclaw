import type { StateManager, CommandResult } from '../types/index.js';
import { FileStateManager } from '../state/index.js';
import { OmocPlugin } from '../plugin.js';
import {
  BuildCommand,
  CancelCommand,
  CleanupCommand,
  LoopCommand,
  OmocCommand,
  OmocDoctorCommand,
  OmocHealthCommand,
  OmocSetupCommand,
  OmocStatusCommand,
  OmocConfigCommand,
  ParallelCommand,
  PauseCommand,
  PlanCommand,
  ResumeCommand,
  RunCommand,
  StatusCommand,
  type CommandHandler
} from '../commands/index.js';
import { AgentsMdLoader, injectAgentsOverlay } from '../agents/overlay.js';

export interface PluginEventContext {
  plugin?: OmocPlugin;
  stateManager?: StateManager;
  sessionId?: string;
  userId?: string;
  channelId?: string;
  message?: {
    content?: string;
    userId?: string;
    channelId?: string;
  };
  systemPrompt?: string;
  workingDirectory?: string;
}

type CommandMatch = {
  handler: CommandHandler;
  args: string[];
};

function getStateManager(context: PluginEventContext): StateManager {
  return context.stateManager || context.plugin?.getStateManager() || new FileStateManager();
}

function getCommandRegistry(): CommandHandler[] {
  return [
    new OmocCommand(),
    new OmocSetupCommand(),
    new OmocDoctorCommand(),
    new OmocStatusCommand(),
    new OmocHealthCommand(),
    new OmocConfigCommand(),
    new RunCommand(),
    new PlanCommand(),
    new BuildCommand(),
    new LoopCommand(),
    new ParallelCommand(),
    new StatusCommand(),
    new PauseCommand(),
    new ResumeCommand(),
    new CancelCommand(),
    new CleanupCommand()
  ];
}

function matchCommand(content: string): CommandMatch | null {
  const registry = getCommandRegistry();
  const ordered = [...registry].sort((a, b) => b.name.length - a.name.length);
  const trimmed = content.trim();

  for (const handler of ordered) {
    if (trimmed === handler.name) {
      return { handler, args: [] };
    }

    if (trimmed.startsWith(`${handler.name} `)) {
      const args = trimmed.slice(handler.name.length).trim().split(/\s+/).filter(Boolean);
      return { handler, args };
    }
  }

  return null;
}

export async function onGatewayStartup(context: PluginEventContext): Promise<{ status: string; mode?: string }> {
  const plugin = context.plugin || (await OmocPlugin.create());
  return {
    status: 'ready',
    mode: plugin.getMode()
  };
}

export async function onAgentBootstrap(context: PluginEventContext): Promise<{ systemPrompt?: string }> {
  if (!context.systemPrompt) {
    return {};
  }

  const loader = new AgentsMdLoader(context.workingDirectory || process.cwd());
  const projectOverlay = loader.loadProjectOverlay();

  if (!projectOverlay) {
    return { systemPrompt: context.systemPrompt };
  }

  const systemPrompt = injectAgentsOverlay(context.systemPrompt, projectOverlay);
  return { systemPrompt };
}

export async function onMessageReceived(context: PluginEventContext): Promise<{ handled: boolean; result?: CommandResult }> {
  const content = context.message?.content || '';
  if (!content.startsWith('/')) {
    return { handled: false };
  }

  const matched = matchCommand(content);
  if (!matched) {
    return { handled: false };
  }

  const stateManager = getStateManager(context);
  const result = await matched.handler.execute(
    {
      sessionId: context.sessionId || 'plugin-session',
      userId: context.message?.userId || context.userId || 'unknown-user',
      channelId: context.message?.channelId || context.channelId || 'unknown-channel',
      args: matched.args
    },
    stateManager
  );

  return { handled: true, result };
}

export async function onMessageSent(context: PluginEventContext): Promise<{ delivered: boolean }> {
  if (!context.plugin || !context.sessionId) {
    return { delivered: true };
  }

  context.plugin.emitEvent(context.sessionId, 'session.complete', { source: 'message:sent' });
  return { delivered: true };
}

export async function onToolResult(context: PluginEventContext): Promise<{ persisted: boolean }> {
  if (!context.plugin || !context.sessionId) {
    return { persisted: true };
  }

  context.plugin.emitEvent(context.sessionId, 'task.completed', { source: 'tool_result_persist' });
  return { persisted: true };
}
