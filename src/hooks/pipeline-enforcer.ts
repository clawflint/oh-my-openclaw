import { AGENT_REGISTRY } from '../agents/index.js';
import { DEFAULT_MODEL_TIERS } from '../config/index.js';

export interface PipelineMessageContext {
  body: string;
  bodyForAgent?: string;
  metadata?: Record<string, unknown>;
}

function getModelForAgent(role: string): string {
  const agent = AGENT_REGISTRY[role as keyof typeof AGENT_REGISTRY];
  if (!agent) return 'anthropic/claude-sonnet-4-20250514';
  const tier = DEFAULT_MODEL_TIERS[agent.defaultTier];
  return tier.model;
}

function getPersona(role: string): string {
  const agent = AGENT_REGISTRY[role as keyof typeof AGENT_REGISTRY];
  return agent?.systemPrompt || '';
}

export function enforceRunPipeline(task: string): string {
  const leadModel = getModelForAgent('lead');
  const plannerModel = getModelForAgent('planner');
  const builderModel = getModelForAgent('builder');
  const reviewerModel = getModelForAgent('reviewer');

  return `Execute this task using the OmOC multi-agent pipeline. You MUST follow these stages IN ORDER using sessions_spawn for each:

**STAGE 1 — CLASSIFY (Lead Agent)**
sessions_spawn with:
- label: "omoc-lead"
- model: "${leadModel}"
- task: "${getPersona('lead').substring(0, 200)}\\n\\nClassify this task: ${task}\\n\\nReturn JSON: {intent, complexity, suggestedWorkflow}"

Wait for result, then proceed to Stage 2.

**STAGE 2 — PLAN (Planner Agent)**
sessions_spawn with:
- label: "omoc-planner"
- model: "${plannerModel}"
- task: "${getPersona('planner').substring(0, 200)}\\n\\nCreate a phased plan for: ${task}\\n\\nClassification from Stage 1: [paste lead's response]"

Wait for result, then proceed to Stage 3.

**STAGE 3 — BUILD (Builder Agent)**
sessions_spawn with:
- label: "omoc-builder"
- model: "${builderModel}"
- task: "${getPersona('builder').substring(0, 200)}\\n\\nImplement this plan:\\n[paste planner's response]\\n\\nOriginal task: ${task}"

Wait for result, then proceed to Stage 4.

**STAGE 4 — REVIEW (Reviewer Agent)**
sessions_spawn with:
- label: "omoc-reviewer"
- model: "${reviewerModel}"
- task: "${getPersona('reviewer').substring(0, 200)}\\n\\nReview the implementation:\\n[paste builder's response]\\n\\nOriginal task: ${task}\\n\\nRespond with APPROVED or REJECTED with specific feedback."

After all stages complete, summarize the results including which models were used and total cost estimate.`;
}

export function enforcePlanPipeline(task: string): string {
  const leadModel = getModelForAgent('lead');
  const plannerModel = getModelForAgent('planner');
  const auditorModel = getModelForAgent('auditor');

  return `Create a plan for this task using OmOC agents. DO NOT implement — only plan. Use sessions_spawn for each:

**STAGE 1 — CLASSIFY (Lead)**
sessions_spawn: label="omoc-lead", model="${leadModel}", task="Classify: ${task}"

**STAGE 2 — PLAN (Planner)**
sessions_spawn: label="omoc-planner", model="${plannerModel}", task="Create detailed phased plan for: ${task}"

**STAGE 3 — AUDIT (Auditor)**
sessions_spawn: label="omoc-auditor", model="${auditorModel}", task="Review this plan for gaps, missing context, and risks: [paste planner's response]"

Present the final plan to the user for approval.`;
}

export function pipelineEnforcerHandler(context: PipelineMessageContext): void {
  const body = context.body?.trim() || '';

  if (body.startsWith('/run ')) {
    const task = body.slice(5).trim();
    if (task) {
      context.bodyForAgent = enforceRunPipeline(task);
    }
  } else if (body.startsWith('/plan ')) {
    const task = body.slice(6).trim();
    if (task) {
      context.bodyForAgent = enforcePlanPipeline(task);
    }
  }
}
