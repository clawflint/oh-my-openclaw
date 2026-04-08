import { AGENT_REGISTRY } from '../agents/index.js';
import { resolveModel } from './model-resolver.js';
import { routeCategory } from './category-router.js';
import type { AgentRole, WorkCategory } from '../types/index.js';

interface SubagentApi {
  runtime: {
    subagent: {
      run(params: { sessionKey: string; message: string; model?: string; deliver?: boolean }): Promise<{ runId: string }>;
      waitForRun(params: { runId: string; timeoutMs?: number }): Promise<{ status: string; tokenStats?: { input: number; output: number } }>;
      getSessionMessages(params: { sessionKey: string; limit?: number }): Promise<Array<{ text: string }>>;
      deleteSession(params: { sessionKey: string }): Promise<void>;
    };
  };
}

export interface SpawnResult {
  runId: string;
  sessionKey: string;
  agent: AgentRole;
  model: string;
  response: string;
  tokens: { input: number; output: number };
}

export interface SpawnOptions {
  category?: WorkCategory;
  timeout?: number;
  background?: boolean;
}

let spawnCounter = 0;

function makeSessionKey(role: AgentRole): string {
  spawnCounter++;
  return `agent:main:omoc:${role}-${Date.now().toString(36)}-${spawnCounter}`;
}

export class SubagentBridge {
  private api: SubagentApi;
  constructor(api: SubagentApi) { this.api = api; }

  async spawn(role: AgentRole, task: string, options?: SpawnOptions): Promise<SpawnResult> {
    const agentConfig = AGENT_REGISTRY[role];
    const model = resolveModel(agentConfig.defaultTier);
    const sessionKey = makeSessionKey(role);
    const timeout = options?.timeout || 120000;
    const message = `${agentConfig.systemPrompt}\n\n---\n\nTask: ${task}`;

    const { runId } = await this.api.runtime.subagent.run({ sessionKey, message, model, deliver: false });
    const completion = await this.api.runtime.subagent.waitForRun({ runId, timeoutMs: timeout });
    const messages = await this.api.runtime.subagent.getSessionMessages({ sessionKey, limit: 1 });
    const responseText = messages.length > 0 ? messages[0].text : '(no response)';
    const tokens = completion.tokenStats || { input: 0, output: 0 };

    return { runId, sessionKey, agent: role, model, response: responseText, tokens };
  }

  async spawnByCategory(category: WorkCategory, task: string, options?: SpawnOptions): Promise<SpawnResult> {
    const route = routeCategory(category);
    return this.spawn(route.agent, task, options);
  }
}
