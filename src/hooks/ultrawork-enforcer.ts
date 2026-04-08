import { AGENT_REGISTRY } from '../agents/index.js';
import { DEFAULT_MODEL_TIERS } from '../config/index.js';

function getModel(role: string): string {
  const agent = AGENT_REGISTRY[role as keyof typeof AGENT_REGISTRY];
  if (!agent) return 'anthropic/claude-sonnet-4-20250514';
  return DEFAULT_MODEL_TIERS[agent.defaultTier].model;
}

export function enforceUltraworkPipeline(task: string): string {
  return `Execute this task using the FULL OmOC team (ultrawork mode). This is a complex task requiring multiple specialized agents working in sequence and parallel.

**PHASE 1 — PLANNING (Sequential)**

Step 1: Classify with Lead
sessions_spawn: label="omoc-lead", model="${getModel('lead')}", task="Classify and decompose: ${task}. Return JSON: {intent, complexity, phases: [{name, description, canParallelize}]}"

Step 2: Detailed Plan with Planner
sessions_spawn: label="omoc-planner", model="${getModel('planner')}", task="Create detailed phased plan based on Lead's classification. Include files to change, acceptance criteria, dependencies."

Step 3: Gap Analysis with Auditor
sessions_spawn: label="omoc-auditor", model="${getModel('auditor')}", task="Review this plan for gaps, missing context, risks, and blockers. Return structured gap analysis."

Step 4: Plan Review with Critic
sessions_spawn: label="omoc-critic", model="${getModel('critic')}", task="Challenge this plan. Surface hidden risks, optimistic estimates, and simpler alternatives."

**PHASE 2 — EXECUTION (Parallel where possible)**

For each independent phase in the plan, spawn a builder:
sessions_spawn: label="omoc-builder-N", model="${getModel('builder')}", task="Implement phase N of the plan."

For architecture-level changes, use the architect instead:
sessions_spawn: label="omoc-architect", model="${getModel('architect')}", task="Handle complex architectural change."

Use scout for codebase research:
sessions_spawn: label="omoc-scout", model="${getModel('scout')}", task="Search codebase for patterns/files needed."

**PHASE 3 — VERIFICATION (Sequential)**

Step 1: Review each builder's output
sessions_spawn: label="omoc-reviewer", model="${getModel('reviewer')}", task="Review implementation. APPROVED or REJECTED."

Step 2: Final integration check
Verify all phases work together, tests pass, no conflicts.

**PHASE 4 — REPORT**
Summarize all stages, models used, costs, and final status.

IMPORTANT: Wait for each stage to complete before moving to the next. For parallel builders, spawn all and wait for all to announce back.`;
}

export interface UltraworkContext {
  body: string;
  bodyForAgent?: string;
}

export function ultraworkEnforcerHandler(context: UltraworkContext): void {
  const body = context.body?.trim() || '';
  if (body.startsWith('/ultrawork ')) {
    const task = body.slice(11).trim();
    if (task) context.bodyForAgent = enforceUltraworkPipeline(task);
  }
}
