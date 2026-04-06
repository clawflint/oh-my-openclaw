/**
 * OpenClaw Plugin Manifest
 * Defines how OmOC integrates with the OpenClaw Plugin SDK
 */

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  main: string;
  hooks: PluginHook[];
  tools: PluginTool[];
  commands: string[];
  configSchema: ConfigSchema;
}

export interface PluginHook {
  event: string;
  handler: string;
}

export interface PluginTool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface ConfigSchema {
  type: "object";
  properties: Record<string, ConfigProperty>;
  required?: string[];
}

export interface ConfigProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  properties?: Record<string, ConfigProperty>;
  required?: string[];
}

export const OMOcPluginManifest: PluginManifest = {
  name: "oh-my-openclaw",
  version: "1.0.0",
  description: "Multi-agent orchestration for OpenClaw by ClawFlint",
  author: "ClawFlint (clawflint.com)",
  license: "MIT",
  main: "dist/index.js",
  hooks: [
    { event: "gateway:startup", handler: "onGatewayStartup" },
    { event: "agent:bootstrap", handler: "onAgentBootstrap" },
    { event: "message:received", handler: "onMessageReceived" },
    { event: "message:sent", handler: "onMessageSent" },
    { event: "tool_result_persist", handler: "onToolResult" },
  ],
  tools: [
    {
      name: "delegate",
      description: "Category-based task delegation with model routing",
      parameters: {
        category: {
          type: "string",
          description: "Work category (quick, standard, deep, etc.)",
        },
        taskDescription: {
          type: "string",
          description: "Description of the task",
        },
        preferAgent: {
          type: "string",
          description: "Optional preferred agent",
        },
      },
    },
    {
      name: "summon",
      description: "Direct agent invocation by name",
      parameters: {
        agent: { type: "string", description: "Agent name to summon" },
        taskDescription: { type: "string", description: "Task description" },
      },
    },
    {
      name: "checkpoint",
      description: "Save/load/list execution checkpoints",
      parameters: {
        action: { type: "string", enum: ["save", "load", "list"] },
        checkpointId: {
          type: "string",
          description: "Checkpoint ID for load action",
        },
      },
    },
  ],
  commands: [
    "/run",
    "/plan",
    "/build",
    "/loop",
    "/parallel",
    "/omoc",
    "/omoc setup",
    "/omoc doctor",
    "/omoc status",
    "/omoc health",
    "/omoc config",
    "/status",
    "/pause",
    "/resume",
    "/cancel",
    "/cleanup",
  ],
  configSchema: {
    type: "object",
    properties: {
      project: {
        type: "object",
        description: "Project configuration",
        properties: {
          name: { type: "string", description: "Project name" },
          repo: { type: "string", description: "Repository URL" },
        },
        required: ["name", "repo"],
      },
      modelTiers: {
        type: "object",
        description: "Model tier configuration",
      },
      workflows: {
        type: "object",
        properties: {
          defaultApprovalGate: {
            type: "string",
            enum: ["required", "auto", "skip"],
            default: "required",
          },
          loopMaxIterations: { type: "number", default: 100 },
          parallelMaxWorkers: { type: "number", default: 5 },
        },
      },
      costControls: {
        type: "object",
        properties: {
          sessionBudgetUsd: { type: "number", default: 10.0 },
          taskBudgetUsd: { type: "number", default: 3.0 },
          alertThresholdPercent: { type: "number", default: 75 },
          hardStopOnBudget: { type: "boolean", default: true },
        },
      },
    },
    required: ["project"],
  },
};

export function generateOpenClawConfig(): string {
  return `{
  "mcpServers": {
    "omoc": {
      "command": "bun",
      "args": ["run", "${process.cwd()}/dist/index.js"],
      "env": {
        "OMOC_MODE": "openclaw"
      }
    }
  },
  "plugins": ["${OMOcPluginManifest.name}"]
}`;
}
