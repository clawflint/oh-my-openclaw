// src/agents/agent-executor.ts
import { AGENT_REGISTRY } from './registry.js';
import { resolveModel } from '../bridge/model-resolver.js';
import { adaptPromptForModel } from '../bridge/prompt-adapter.js';
import type { AgentRole } from '../types/index.js';

export interface LLMProvider {
  complete(params: {
    model: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ content: string; tokens: { input: number; output: number } }>;
}

export interface AgentExecutionResult {
  agent: AgentRole;
  model: string;
  response: string;
  tokens: { input: number; output: number };
  durationMs: number;
}

export async function executeAgent(
  role: AgentRole,
  task: string,
  provider: LLMProvider,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<AgentExecutionResult> {
  const agent = AGENT_REGISTRY[role];
  const model = options?.model || resolveModel(agent.defaultTier);
  const systemPrompt = adaptPromptForModel(agent.systemPrompt, model);

  const start = Date.now();
  const result = await provider.complete({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task },
    ],
    maxTokens: options?.maxTokens,
    temperature: options?.temperature,
  });

  return {
    agent: role,
    model,
    response: result.content,
    tokens: result.tokens,
    durationMs: Date.now() - start,
  };
}

// Stub provider for testing — returns a canned response
export class StubLLMProvider implements LLMProvider {
  private responses: Map<string, string> = new Map();
  public calls: Array<{ model: string; messages: any[] }> = [];

  setResponse(model: string, response: string): void {
    this.responses.set(model, response);
  }

  setDefaultResponse(response: string): void {
    this.responses.set('*', response);
  }

  async complete(params: { model: string; messages: any[] }): Promise<{ content: string; tokens: { input: number; output: number } }> {
    this.calls.push({ model: params.model, messages: params.messages });
    const response = this.responses.get(params.model) || this.responses.get('*') || `[${params.model}] Executed task.`;
    return { content: response, tokens: { input: 100, output: 50 } };
  }
}

// Anthropic provider — wraps the Anthropic API for standalone use
export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.anthropic.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async complete(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ content: string; tokens: { input: number; output: number } }> {
    const modelId = params.model.replace('anthropic/', '');
    const body = {
      model: modelId,
      max_tokens: params.maxTokens || 4096,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      system: params.messages.find(m => m.role === 'system')?.content || '',
      messages: params.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
    };

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    return {
      content: data.content?.[0]?.text || '',
      tokens: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0,
      },
    };
  }
}
