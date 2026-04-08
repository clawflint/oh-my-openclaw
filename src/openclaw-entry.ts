/**
 * OpenClaw Plugin Entry Point
 * Wires OmOC orchestration to OpenClaw's plugin system
 */

import { OmocPlugin } from './plugin.js';
import { AGENT_REGISTRY } from './agents/index.js';
import { OMOcPluginManifest } from './plugin/manifest.js';
import { SubagentBridge } from './bridge/subagent-bridge.js';
import { routeCategory } from './bridge/category-router.js';
import { runPipeline } from './pipeline/run-pipeline.js';
import type { AgentRole, WorkCategory } from './types/index.js';
import { contextInjectorHandler } from './hooks/context-injector.js';
import { keywordDetectorHandler } from './hooks/keyword-detector.js';
import { todoEnforcerHandler } from './hooks/todo-enforcer.js';
import { pipelineEnforcerHandler } from './hooks/pipeline-enforcer.js';

interface OpenClawPluginApi {
  registerCommand(opts: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    handler: (ctx: CommandContext) => Promise<string | void>;
  }): void;
  registerTool?(opts: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    execute: (toolCallId: string, params: Record<string, unknown>) => Promise<unknown>;
  }): void;
  runtime?: {
    subagent: {
      run(params: { sessionKey: string; message: string; model?: string; deliver?: boolean }): Promise<{ runId: string }>;
      waitForRun(params: { runId: string; timeoutMs?: number }): Promise<{ status: string; tokenStats?: { input: number; output: number } }>;
      getSessionMessages(params: { sessionKey: string; limit?: number }): Promise<Array<{ text: string }>>;
      deleteSession(params: { sessionKey: string }): Promise<void>;
    };
  };
}

interface CommandContext {
  args?: string;
  channel?: string;
  sender?: string;
  sessionId?: string;
  [key: string]: unknown;
}

let omocInstance: OmocPlugin | null = null;
let bridge: SubagentBridge | null = null;

async function getOmoc(): Promise<OmocPlugin> {
  if (!omocInstance) {
    omocInstance = await OmocPlugin.create({ mode: 'standalone' });
  }
  return omocInstance;
}

function register(api: OpenClawPluginApi): void {
  if (api.runtime?.subagent) {
    bridge = new SubagentBridge(api as any);
  }

  // Register hooks
  if ((api as any).registerHook) {
    (api as any).registerHook(['agent:bootstrap'], (context: any) => {
      contextInjectorHandler(context);
    });

    (api as any).registerHook(['message:received'], (context: any) => {
      keywordDetectorHandler(context);
    });

    (api as any).registerHook(['tool_result_persist'], (context: any) => {
      const directive = todoEnforcerHandler(context);
      if (directive && context.metadata) {
        context.metadata.omocDirective = directive;
      }
    });

    // Pipeline enforcer — rewrites /run and /plan messages
    (api as any).registerHook(['message:received'], (context: any) => {
      pipelineEnforcerHandler(context);
    });
  }

  api.registerCommand({
    name: 'omoc',
    description: 'Oh My OpenClaw - Multi-agent orchestration',
    acceptsArgs: true,
    handler: async (ctx: CommandContext) => {
      const args = ctx.args?.trim() ?? '';
      const subcommand = args.split(/\s+/)[0]?.toLowerCase() ?? 'status';
      const omoc = await getOmoc();

      switch (subcommand) {
        case 'doctor': {
          const config = omoc.getConfig();
          const mode = omoc.getMode();
          const agents = Object.keys(AGENT_REGISTRY);
          return [
            '🔧 OmOC Doctor',
            `Mode: ${mode}`,
            `Bridge: ${bridge ? 'CONNECTED (api.runtime.subagent)' : 'NOT CONNECTED (stub mode)'}`,
            `Project: ${config.project.name}`,
            `Agents: ${agents.length} registered (${agents.join(', ')})`,
            `Version: ${OMOcPluginManifest.version}`,
          ].join('\n');
        }
        case 'status': {
          const config = omoc.getConfig();
          return [
            '📊 OmOC Status',
            `Mode: ${omoc.getMode()}`,
            `Bridge: ${bridge ? 'active' : 'stub'}`,
            `Budget: $${config.costControls.sessionBudgetUsd} session / $${config.costControls.taskBudgetUsd} task`,
            `Max Workers: ${config.workflows.parallelMaxWorkers}`,
          ].join('\n');
        }
        case 'health':
          return `💚 OmOC Health: OK\nBridge: ${bridge ? 'connected' : 'disconnected'}`;
        case 'config': {
          const config = omoc.getConfig();
          return '⚙️ OmOC Config:\n' + JSON.stringify(config, null, 2).slice(0, 1000);
        }
        default:
          return [
            '🦞 Oh My OpenClaw (OmOC)',
            'Commands: /omoc doctor | status | health | config',
            'Orchestration: /run <task>',
            'Tools: delegate (category-based) | summon (by name)',
          ].join('\n');
      }
    },
  });

  api.registerCommand({
    name: 'run',
    description: 'Execute task through full OmOC pipeline (classify→plan→build→review)',
    acceptsArgs: true,
    handler: async (ctx: CommandContext) => {
      const task = ctx.args?.trim();
      if (!task) return 'Usage: /run <task description>';
      if (!bridge) return '❌ OmOC bridge not connected. api.runtime.subagent unavailable.';

      const omoc = await getOmoc();
      const result = await runPipeline(bridge, task, omoc.getConfig().costControls);

      const stageReport = result.stages
        .map((s) => `  ${s.stage}: ${s.agent} (${s.model}) — ${s.durationMs}ms`)
        .join('\n');

      return [
        `🦞 /run ${result.status === 'completed' ? '✅' : '❌'}`,
        `Task: ${task}`,
        `Stages:\n${stageReport}`,
        `Cost: $${result.totalCost.toFixed(4)} | Tokens: ${result.totalTokens}`,
        `Summary: ${result.summary}`,
      ].join('\n');
    },
  });

  api.registerCommand({
    name: 'omoc-status',
    description: 'Show OmOC orchestration status',
    handler: async () => {
      const omoc = await getOmoc();
      return `OmOC running in ${omoc.getMode()} mode | Bridge: ${bridge ? 'active' : 'stub'}`;
    },
  });

  api.registerCommand({
    name: 'hello',
    description: 'Simple hello command for OmOC',
    handler: async () => 'Hello World! OmOC is running.',
  });

  if (api.registerTool) {
    api.registerTool({
      name: 'delegate',
      description: 'Delegate a task to a specialized OmOC agent. Routes by work category to the right agent and model. Categories: quick (simple fixes), standard (moderate), deep (complex refactoring), strategic (architecture), visual (UI/UX), research (docs lookup), creative (writing).',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Work category: quick, standard, deep, strategic, visual, research, creative' },
          taskDescription: { type: 'string', description: 'Task to delegate' },
          preferAgent: { type: 'string', description: 'Optional: specific agent role (lead, builder, architect, reviewer, scout, researcher, observer)' },
        },
        required: ['category', 'taskDescription'],
      },
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        const category = (params.category as string) || 'standard';
        const task = params.taskDescription as string;
        const preferAgent = params.preferAgent as AgentRole | undefined;

        if (!bridge) {
          const route = routeCategory(category, preferAgent);
          return { content: [{ type: 'text', text: JSON.stringify({ status: 'stub', agent: route.agent, model: route.model, message: 'Bridge not connected. Would spawn: ' + route.agent }) }] };
        }

        const result = preferAgent
          ? await bridge.spawn(preferAgent, task)
          : await bridge.spawnByCategory(category as WorkCategory, task);

        return { content: [{ type: 'text', text: JSON.stringify({ status: 'completed', agent: result.agent, model: result.model, response: result.response, runId: result.runId }) }] };
      },
    });

    api.registerTool({
      name: 'summon',
      description: 'Summon a specific OmOC agent by name. Available agents: lead (orchestrator), foreman (execution manager), planner (strategic planning), builder (coding), architect (complex changes), reviewer (quality gate), scout (codebase search), researcher (docs lookup), observer (visual analysis).',
      parameters: {
        type: 'object',
        properties: {
          agent: { type: 'string', description: 'Agent role to summon' },
          taskDescription: { type: 'string', description: 'Task for the agent' },
        },
        required: ['agent', 'taskDescription'],
      },
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        const agentName = params.agent as AgentRole;
        const task = params.taskDescription as string;

        if (!AGENT_REGISTRY[agentName]) {
          return { content: [{ type: 'text', text: `Unknown agent: ${agentName}. Available: ${Object.keys(AGENT_REGISTRY).join(', ')}` }] };
        }

        if (!bridge) return { content: [{ type: 'text', text: JSON.stringify({ status: 'stub', agent: agentName, message: 'Bridge not connected.' }) }] };

        const result = await bridge.spawn(agentName, task);
        return { content: [{ type: 'text', text: JSON.stringify({ status: 'completed', agent: result.agent, model: result.model, response: result.response, runId: result.runId }) }] };
      },
    });

    api.registerTool({
      name: 'checkpoint',
      description: 'Save, load, or list execution checkpoints for OmOC sessions.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['save', 'load', 'list'], description: 'Action to perform' },
          checkpointId: { type: 'string', description: 'Checkpoint ID for load action' },
        },
        required: ['action'],
      },
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        return { content: [{ type: 'text', text: JSON.stringify({ status: 'not_implemented', action: params.action }) }] };
      },
    });
  }
}

export default {
  id: 'oh-my-openclaw',
  name: 'Oh My OpenClaw',
  description: 'Multi-agent orchestration for OpenClaw by ClawFlint',
  configSchema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      mode: { type: 'string', enum: ['standalone', 'clawflint'], default: 'standalone' },
    },
  },
  register,
};
