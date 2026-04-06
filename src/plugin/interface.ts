import { OmocPlugin } from '../plugin.js';
import { OMOcPluginManifest } from './manifest.js';
import {
  onGatewayStartup,
  onAgentBootstrap,
  onMessageReceived,
  onMessageSent,
  onToolResult,
  type PluginEventContext
} from './handlers.js';
import {
  BuildCommand,
  CancelCommand,
  CleanupCommand,
  LoopCommand,
  OmocCommand,
  OmocConfigCommand,
  OmocDoctorCommand,
  OmocHealthCommand,
  OmocSetupCommand,
  OmocStatusCommand,
  ParallelCommand,
  PauseCommand,
  PlanCommand,
  ResumeCommand,
  RunCommand,
  StatusCommand,
  type CommandHandler
} from '../commands/index.js';
import { createCheckpointTool, createDelegationTool, createSummonTool } from '../tools/index.js';

type PluginToolRuntime = {
  name: string;
  description: string;
  execute: (...args: any[]) => unknown;
};

export interface OpenClawPluginRuntime {
  manifest: typeof OMOcPluginManifest;
  plugin: OmocPlugin;
  hooks: Record<string, (context: PluginEventContext) => Promise<unknown>>;
  commands: Record<string, CommandHandler>;
  tools: PluginToolRuntime[];
}

export async function createOpenClawPluginRuntime(plugin?: OmocPlugin): Promise<OpenClawPluginRuntime> {
  const runtimePlugin = plugin || (await OmocPlugin.create());

  const commands: Record<string, CommandHandler> = {};
  const commandHandlers: CommandHandler[] = [
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
  for (const command of commandHandlers) {
    commands[command.name] = command;
  }

  return {
    manifest: OMOcPluginManifest,
    plugin: runtimePlugin,
    hooks: {
      'gateway:startup': async (context) => onGatewayStartup({ ...context, plugin: runtimePlugin }),
      'agent:bootstrap': async (context) => onAgentBootstrap({ ...context, plugin: runtimePlugin }),
      'message:received': async (context) => onMessageReceived({ ...context, plugin: runtimePlugin }),
      'message:sent': async (context) => onMessageSent({ ...context, plugin: runtimePlugin }),
      tool_result_persist: async (context) => onToolResult({ ...context, plugin: runtimePlugin }),
    },
    commands,
    tools: [createDelegationTool(), createSummonTool(), createCheckpointTool()],
  };
}
