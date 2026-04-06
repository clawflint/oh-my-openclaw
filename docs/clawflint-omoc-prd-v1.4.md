# oh-my-openclaw (OmOC) — Product Requirements Document v1.4

> ClawFlint's Autonomous Agent Orchestration Plugin
> Document: clawflint-omoc-prd-v1.4.md
> Author: Mohamed Saleh / moelabs
> Date: April 6, 2026
> Status: Draft — Implementation-Ready
> Changelog:
> - v1.4: Adds Testing Strategy (§20) — five-tier test pyramid, simulation tests with recorded LLM responses, resilience/chaos tests, CI pipeline, test count targets per phase. Source-informed practices from OpenClaw (temp HOME isolation, contract tests, V8 coverage thresholds, per-provider flags, boot smoke tests), OmO (co-located tests, mock isolation, state inspection helpers), and OmX (version sync, install smoke).
> - v1.3.1: Adds merge conflict escalation matrix (§7.4.1), event summary mode for notification batching.
> - v1.3: Adds Security Architecture, three-tier state location model, mailbox atomicity, atomic operation definitions, AGENTS overlay precedence, Foreman permission rationale, write guards promoted to v1.x, north-star metric.
> - v1.2: State & Persistence Model, Lifecycle Management, Concurrency & Cost Controls, Operator Tooling, Lead/Foreman split, AGENTS overlay system, three-layer permission enforcement, worker supervision, reliability stance.

---

## 1. Executive Summary

oh-my-openclaw (OmOC) is ClawFlint's autonomous agent orchestration layer — an OpenClaw plugin that transforms a single AI assistant into a coordinated multi-agent development team, controllable entirely from messaging channels (Discord, Telegram, WhatsApp, Slack).

OmOC enables ClawFlint customers to deploy autonomous coding teams through ClawFlint's configuration-based dashboard. Instead of manually installing and wiring OmX, clawhip, and oh-my-openagent on a VPS, users configure an Agent Team in the ClawFlint dashboard, connect a repository, select models for each role, pick a channel, and deploy. The result: a fully orchestrated development team they can command from their phone.

### Problem Statement

Today, setting up an autonomous agent orchestration stack requires installing 4–5 separate tools, configuring TOML/JSON files across multiple directories, creating Discord bots, managing tmux sessions, and understanding the interplay between workflow decomposition, event routing, and multi-agent coordination. This is a 12-step manual process that takes hours and requires significant DevOps knowledge.

### Solution

OmOC packages proven orchestration patterns (3-layer agent hierarchy, category-based model routing, intent classification, plan→execute→verify loops, parallel worktree isolation, event-driven notification routing) into a single OpenClaw plugin that deploys through ClawFlint's existing infrastructure. Configuration replaces installation. Dashboard replaces TOML files. Managed Fly.io Machines replace DIY VPS setup.

### Strategic Fit

OmOC extends ClawFlint's core thesis — configuration-based deployment of OpenClaw agents to messaging channels — into the high-value autonomous development segment. It differentiates ClawFlint from commodity agent deployment platforms by offering managed multi-agent orchestration as a service.

### Naming

| Attribute | Value |
|-----------|-------|
| Full name | oh-my-openclaw |
| Short alias | OmOC |
| npm package | `@clawflint/oh-my-openclaw` |
| Plugin ID | `oh-my-openclaw` |
| Follows convention of | oh-my-codex (OmX), oh-my-openagent (OmO) |

---

## 2. Design Principles

### 2.1 — Configuration Over Installation

Every aspect of OmOC is configurable through ClawFlint's dashboard or a JSON configuration file. Users never SSH into a server, edit TOML files, or manage tmux sessions directly. The orchestration infrastructure is fully managed.

### 2.2 — Original Implementation, Informed by Public Patterns

OmOC is an original implementation informed by publicly documented multi-agent orchestration patterns across the OpenClaw, OmX, and OmO ecosystems. It does not copy, port, or derive from any restrictively licensed codebase. The architectural patterns it draws on — category-based routing, plan→execute→verify cycles, parallel worktree isolation, hook-driven lifecycle management — are well-established concepts documented across multiple open-source projects, blog posts, and technical references. OmOC's agent designs, prompts, workflow commands, naming, configuration schema, and runtime implementation are original to ClawFlint. Where specific design choices are informed by existing systems, this PRD cites the pattern source.

### 2.3 — OpenClaw Plugin API Native

OmOC is built as a standard OpenClaw plugin using the official Plugin SDK. This ensures compatibility with the OpenClaw ecosystem (skills, channels, tools, hooks) and future-proofs the integration as OpenClaw evolves.

### 2.4 — Separation of Concerns

Three distinct subsystems handle three distinct responsibilities:
- **Workflow Engine**: Decomposes human intent into structured agent tasks
- **Agent Runtime**: Executes tasks with role-appropriate models and tool permissions
- **Event Router + Worker Supervisor**: Monitors execution, delivers notifications, and manages worker lifecycle without polluting agent context

### 2.5 — Clarity Over Cleverness

Agent names, workflow commands, and configuration keys use plain, self-descriptive language. When a user reads a Discord notification saying "Builder committed to feature/auth" or "Reviewer rejected: tests failing," they instantly understand what happened. No metaphors to decode, no jargon to learn.

### 2.6 — Durability by Default

Sessions, tasks, plans, and worker state are persisted to disk. Crashes, rate limits, and network failures are recovered from automatically. Clean shutdown, resume, cancel, and stale-task cleanup are first-class operations, not afterthoughts.

### 2.7 — Verdigris Design Language

All dashboard UI, documentation, and branding follows ClawFlint's Verdigris design system (v3.0): `#0D9488` primary, Plus Jakarta Sans display, JetBrains Mono code, Zinc neutrals, Tailwind dark mode.

---

## 3. Agent Architecture

### 3.1 — Naming Philosophy

Every agent is named for exactly what it does. The name IS the role description. This eliminates onboarding friction — users never need to learn that "Hephaestus" means "deep worker" or that "Sisyphus" means "orchestrator."

### 3.2 — Agent Roster

| Agent | Role | Layer | Default Model Tier | One-Line Description |
|-------|------|-------|-------------------|----------------------|
| **Lead** | Strategic Orchestrator | Orchestration | Tier 1 (strongest) | Classifies intent, selects workflow, delegates to Planner or Foreman |
| **Foreman** | Execution Orchestrator | Orchestration | Tier 1 | Manages todo lists, decomposes plans into tasks, tracks worker completion |
| **Planner** | Strategic Planner | Planning | Tier 1 | Interviews user, produces phased plans, never writes code |
| **Auditor** | Plan Validator | Planning | Tier 2 | Gap analysis — finds missing context before execution begins |
| **Critic** | Plan Reviewer | Planning | Tier 2 | Challenges plans, surfaces blockers and risks |
| **Builder** | Primary Worker | Execution | Tier 2 | Standard implementations, bug fixes, routine coding |
| **Architect** | Deep Worker | Execution | Tier 1 | Complex refactoring, system redesigns, architecture-level changes |
| **Reviewer** | Quality Gate | Verification | Tier 2 | Inspects output, runs tests, catches problems |
| **Scout** | Codebase Explorer | Support | Tier 3 (fastest) | Grep, search, pattern discovery across the codebase |
| **Researcher** | Knowledge Agent | Support | Tier 3 | Documentation lookup, library research, web search |
| **Observer** | Visual Analyst | Support | Multimodal | Screenshots, PDFs, UI review, design inspection |

### 3.3 — Why Lead and Foreman Are Separate

The review of source systems revealed a critical design lesson: the strategic orchestrator (what to do) and the execution orchestrator (track it until done) must be separate agents with different failure modes and supervision semantics.

**Lead** handles intent classification, workflow selection, and high-level delegation. It decides whether to invoke the planning layer or go straight to execution. It does NOT manage todo lists or track individual task completion.

**Foreman** receives a decomposed plan from Lead and drives it to completion. It manages the task queue, assigns work to Builder/Architect, tracks progress via the state model, handles worker failures, and only reports back to Lead when everything is done or when it's blocked.

This separation matters because `/run` (strategic, multi-phase, planning-first) and `/parallel` (mechanical, decompose-and-distribute) have fundamentally different failure modes. A strategic orchestrator that also manages individual task heartbeats will either make poor strategic decisions when overwhelmed by task-level noise, or miss task-level failures when focused on strategy.

### 3.4 — Three-Layer Hierarchy

```
┌─────────────────────────────────────────┐
│           Layer 1: PLANNING             │
│                                         │
│  Planner ──→ Auditor ──→ Critic         │
│  (plan)      (gaps)      (review)       │
└──────────────────┬──────────────────────┘
                   │ approved plan
                   ▼
┌─────────────────────────────────────────┐
│        Layer 2: ORCHESTRATION           │
│                                         │
│    Lead ──→ Foreman                     │
│  (strategy)  (execution tracking)       │
└───┬──────┬──────┬──────┬───────────────┘
    │      │      │      │
    ▼      ▼      ▼      ▼
┌─────────────────────────────────────────┐
│         Layer 3: WORKERS                │
│                                         │
│  Builder  Architect  Scout  Researcher  │
│  (build)  (deep)     (grep) (docs)      │
│                                         │
│           Observer (vision)             │
│                                         │
│              Reviewer                   │
│          (verify all output)            │
└─────────────────────────────────────────┘
```

### 3.5 — Agent Modes

| Mode | Behavior | Agents |
|------|----------|--------|
| `commander` | Respects user's model selection from UI, uses own fallback chain | Lead |
| `operative` | Ignores UI selection, always uses configured model | Scout, Researcher, Observer, Auditor, Critic, Reviewer |
| `versatile` | Commander when invoked by user, operative when delegated | Builder, Architect, Planner, Foreman |

### 3.6 — Tool Permissions: Three-Layer Enforcement

Tool permissions are enforced at three layers, not just one. This addresses the real-world gap where prompt-level restrictions alone are insufficient.

**Layer 1 — Prompt Injection**: Each agent's system prompt explicitly states what it can and cannot do. This is the first line of defense and covers the majority of cases.

**Layer 2 — Plugin Enforcement**: The OmOC plugin intercepts tool calls via the `tool.execute.before` hook and blocks calls that violate the agent's permission matrix before they reach the host runtime. This is hard enforcement — the tool call is rejected with an error message, not just discouraged.

**Layer 3 — Host Runtime**: OpenClaw's own tool permission system provides the final backstop. Agent configs registered via `omoc-setup` include `allowed-tools` and `denied-tools` arrays that the OpenClaw runtime enforces independently of the plugin.

### 3.7 — Tool Permissions Matrix

| Agent | read | write | edit | delegate | summon | bash | test | web_search |
|-------|------|-------|------|----------|--------|------|------|------------|
| Lead | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Foreman | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Planner | ✅ | ❌ | ❌ | ❌ | ✅ (Auditor, Critic) | ❌ | ❌ | ✅ |
| Auditor | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Critic | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Builder | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Architect | ✅ | ✅ | ✅ | ❌ | ✅ (Scout, Researcher) | ✅ | ✅ | ✅ |
| Reviewer | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (test only) | ✅ | ❌ |
| Scout | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Researcher | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Observer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 3.8 — Foreman Permission Rationale

Foreman has `delegate` and `summon` but no `write`, `edit`, or `bash`. This is intentional. Foreman is a supervisor, not a worker. It tracks tasks, assigns work, and monitors completion — it never directly modifies code.

**Git integration**: Foreman needs to merge worker branches. This is handled through a dedicated `git_merge` tool (scoped to merge/cherry-pick operations only, no arbitrary git commands) rather than general `bash` access. This tool is registered separately from the general `bash` tool and is only available to Foreman and Lead.

**Test execution**: Foreman has `test` permission so it can run verification suites to confirm worker output before marking tasks complete, without needing to delegate this to Reviewer for every small check.

---

## 4. Project Guidance Overlays (AGENTS.md)

### 4.1 — AGENTS.md as Runtime Primitive

Project-level guidance is not just "a config file the user can optionally create." It is a first-class runtime mechanism. OmOC generates, maintains, and injects AGENTS.md content at multiple levels:

### 4.2 — Overlay Hierarchy and Precedence

| Priority | Level | File | Generated By | Injected Into |
|----------|-------|------|-------------|---------------|
| 1 (lowest) | System default | Built-in plugin defaults | OmOC plugin | All agents |
| 2 | Project root | `AGENTS.md` | `omoc setup` scaffolds; user maintains | All agents on session start |
| 3 | Subdirectory | `src/auth/AGENTS.md` | User creates for domain-specific rules | Agents working in that directory |
| 4 | Runtime | Dynamic overlay | Hooks inject at `agent:bootstrap` | Active agent during session |
| 5 (highest) | Task-specific | Ephemeral additions | Foreman injects per-task context | Worker executing a specific task |

**Conflict resolution**: Higher priority wins. When overlays conflict (e.g., project root says "use Vitest" but subdirectory says "use Jest"), the nearest/most-specific overlay takes precedence. Overlays are merged additively for non-conflicting content and replaced for conflicting keys. Specifically:

- **Constraints** (what NOT to do): Union — all constraints from all layers apply. A subdirectory cannot remove a project-level constraint.
- **Verification requirements**: Most-specific wins. Subdirectory verification overrides project-root verification for agents working in that directory.
- **Technology context**: Most-specific wins. Subdirectory stack info overrides project-root if explicitly stated.
- **Execution protocol**: Most-specific wins.
- **Cancellation protocol**: Project-root always wins. Cancellation must be consistent across the entire project.

### 4.3 — AGENTS.md Contract

The project-root AGENTS.md covers:

- **Execution protocol**: How agents should approach work in this project (e.g., "always run `pnpm test` before committing")
- **Constraints**: What agents must NOT do (e.g., "do not modify CI/CD configuration")
- **Verification requirements**: What constitutes "done" (e.g., "all tests pass, no TypeScript errors, lint clean")
- **Cancellation protocol**: How to safely stop work (e.g., "revert uncommitted changes, close open PRs")
- **State management**: Where persistent state lives (e.g., "plans go in `.omoc/plans/`, task records in `.omoc/state/`")
- **Technology context**: Stack details (e.g., "Next.js 15, React 19, Neon PostgreSQL, WorkOS AuthKit")

### 4.4 — Scaffold Command

```
/omoc setup
```

Generates:
- `AGENTS.md` at project root with template sections
- `.omoc/` directory with state, plans, and config subdirectories
- Project-level config merge point

---

## 5. Category-Based Model Routing

### 5.1 — Category System

When Lead or Foreman delegates work, it specifies a **category** (what kind of work), not a model name. The routing system maps categories to the optimal model based on the user's available API keys and configured preferences.

### 5.2 — Built-in Categories

| Category | Purpose | Default Model Tier | Example Tasks |
|----------|---------|-------------------|---------------|
| `quick` | Simple fixes, searches, small edits | Tier 3 (fast/cheap) | Bug fixes, typo corrections, grep operations |
| `standard` | Moderate complexity implementations | Tier 2 | Feature implementations, component builds |
| `deep` | Complex refactoring, multi-file changes | Tier 1 (strongest) | Architecture refactors, system redesigns |
| `strategic` | Architecture decisions, root cause analysis | Tier 1 + high reasoning | Design decisions, debugging complex issues |
| `visual` | UI/UX work, screenshot analysis, PDF review | Multimodal | Frontend development, visual QA |
| `research` | Documentation lookup, library investigation | Tier 3 | API research, dependency analysis |
| `creative` | Writing, documentation, content generation | Tier 2 | README writing, API docs, technical writing |

### 5.3 — Model Tier Mapping

```json
{
  "model_tiers": {
    "tier_1": {
      "model": "anthropic/claude-opus-4-6",
      "variant": "max",
      "fallback": ["openai/gpt-5.4", "google/gemini-3.1-pro"]
    },
    "tier_2": {
      "model": "anthropic/claude-sonnet-4-6",
      "fallback": ["openai/gpt-5.3-codex", "google/gemini-3-flash"]
    },
    "tier_3": {
      "model": "google/gemini-3-flash",
      "fallback": ["openai/gpt-5-nano"]
    },
    "multimodal": {
      "model": "google/gemini-3.1-pro",
      "fallback": ["anthropic/claude-opus-4-6"]
    }
  }
}
```

### 5.4 — Custom Categories

```json
{
  "custom_categories": {
    "arabic-content": {
      "model": "anthropic/claude-opus-4-6",
      "temperature": 0.7,
      "prompt_append": "All output must be in Modern Standard Arabic."
    },
    "travel-domain": {
      "model": "anthropic/claude-sonnet-4-6",
      "prompt_append": "You are working on a B2B2C Islamic travel marketplace."
    }
  }
}
```

### 5.5 — Fallback Chain Resolution

1. Check configured model for the category
2. If unavailable, try fallback models in order
3. If all fallbacks exhausted, check if a cheaper tier can substitute
4. If nothing available, queue the task and notify the user via the event router

---

## 6. Intent Classification

### 6.1 — Intent Gate Protocol

Before Lead takes any action, it classifies the user's intent into one of six categories:

| Intent | Detection Signals | Workflow Triggered |
|--------|-------------------|-------------------|
| `explain` | "explain", "how does", "what is", "describe" | Research → Synthesize → Report |
| `implement` | "build", "create", "implement", "add feature" | Plan → Delegate → Execute → Verify |
| `investigate` | "why is", "debug", "find the cause", "what's wrong" | Explore → Diagnose → Report |
| `refactor` | "refactor", "restructure", "clean up", "optimize" | Analyze → Plan → Execute → Verify |
| `evaluate` | "what do you think", "review", "assess", "compare" | Analyze → Report → Wait for confirmation |
| `operate` | "deploy", "run", "test", "build" | Execute → Report |

### 6.2 — Intent-Driven Agent Selection

- `explain` → Scout + Researcher (parallel) → Lead synthesizes
- `implement` → Planner (plan) → Lead → Foreman (decompose + track) → Builder/Architect (execute) → Reviewer (verify)
- `investigate` → Scout (explore) → Architect (deep analysis) → Lead (report)
- `refactor` → Scout (map state) → Planner (plan) → Foreman → Architect (execute) → Reviewer (verify)
- `evaluate` → Researcher (research) → Lead (synthesize) → wait for user
- `operate` → Builder (direct execution) → report result

---

## 7. Workflow Engine

### 7.1 — Mode-Specific Orchestration Semantics

Each workflow command activates a different orchestration mode with distinct supervision semantics, failure handling, and state management. These are not variations of the same loop — they are fundamentally different runtime behaviors.

| Mode | Orchestrator | State Model | Failure Recovery | Parallelism |
|------|-------------|-------------|-----------------|-------------|
| `/run` | Lead → Foreman | Full (plan + task records + worker state) | Resume from last completed task | Yes, via Foreman |
| `/plan` | Lead → Planner | Plan only | Re-plan from scratch | No |
| `/build` | Lead → Foreman | Task records (plan already exists) | Resume from last completed task | Yes, via Foreman |
| `/loop` | Builder (solo) | Iteration counter + checkpoint | Resume from checkpoint | No |
| `/parallel N` | Foreman (direct) | Worker state + merge state | Re-assign failed worker's task | Yes, N workers |

### 7.2 — `/run` (Full Autonomous Pipeline)

```
User: /run add OAuth2 authentication with Google and GitHub providers
```

1. Lead classifies intent → `implement`
2. Lead summons Planner for strategic planning
3. Planner interviews user if scope is ambiguous
4. Planner produces phased plan
5. Auditor checks for gaps
6. Critic reviews for risks
7. Plan persisted to `.omoc/plans/`
8. Plan returned to Lead → Lead hands to Foreman
9. Foreman decomposes plan into tasks, persists to `.omoc/state/tasks/`
10. Foreman assigns tasks to Builder/Architect (parallel where possible)
11. Workers execute in isolated git worktrees
12. Reviewer verifies each output
13. If verification fails → Foreman re-assigns with feedback
14. If verification passes → Foreman marks task complete
15. When all tasks done → Foreman reports to Lead → Lead notifies user

### 7.3 — `/loop` (Persistent Completion Loop)

```
User: /loop fix all failing tests in the auth module
```

1. Builder receives task
2. Executes → checks result → if incomplete, loops
3. Each iteration: re-reads current state, adjusts approach
4. Reviewer validates completion criteria
5. Stops when: all criteria met OR max_iterations OR user `/cancel`

### 7.4 — `/parallel N` (Parallel Team Execution)

```
User: /parallel 3 implement API endpoints for users, products, and orders
```

1. Foreman decomposes into N parallelizable tasks (skips planning layer)
2. N Builder instances spawn in isolated worktrees
3. Foreman monitors via heartbeats and mailbox
4. Workers commit to isolated branches
5. Foreman integrates via merge/cherry-pick
6. Conflicts handled per escalation matrix (§7.4.1)
7. Reviewer verifies integrated result

#### 7.4.1 — Merge Conflict Escalation

| Conflict Type | Auto-Resolve? | Notification | Fallback Action |
|--------------|---------------|-------------|-----------------|
| Non-overlapping files | ✅ Auto-merge | `#build-log` info only | — |
| Same-file, non-overlapping hunks | ✅ Auto-merge (git handles) | `#build-log` info only | — |
| Same-file, overlapping edits | ❌ | `#alerts` @mention with diff snippet | Pause session, await user `/resolve` or `/cancel` |
| Binary or file-lock conflicts | ❌ | `#alerts` "manual merge required" | Abort conflicting worker's branch, re-assign task sequentially |
| Conflict during Foreman merge | ❌ | `#alerts` @mention | `git merge --abort`, mark task `conflict`, notify user |

When a conflict pauses the session, the user has three options:
- `/resolve` — manually fix the conflict in the worktree, then resume
- `/cancel` — abort the session, merge only completed non-conflicting work
- `/reattempt` — discard the conflicting worker's branch and re-assign the task to a single Builder (sequential, avoids the conflict)

### 7.5 — Approval Gates

| Gate | Default | Options |
|------|---------|---------|
| Plan approval | `required` | required, auto, skip |
| Merge approval | `auto` | required, auto |
| Deploy approval | `required` | required, auto, skip |
| Destructive operations | `required` | required (cannot be overridden) |

---

## 8. State & Persistence Model

### 8.1 — Three-Tier State Location

OmOC state lives in three distinct locations depending on its purpose and the deployment tier:

| Tier | Location | Contents | Lifetime | Deployment Mode |
|------|----------|----------|----------|----------------|
| **Repo-adjacent** | `.omoc/` in project root | Plans, AGENTS.md, notepad, config | Persists across sessions, committed or gitignored per user choice | BYOM + Dedicated |
| **Machine-local** | `~/.omoc/` or ephemeral tmpdir | Active session state, worker heartbeats, mailbox, worktrees, logs, checkpoints | Ephemeral per session (archived after completion) | BYOM + Dedicated |
| **Control-plane** | ClawFlint's Neon PostgreSQL | Session history, cost records, team configs, dashboard state, audit logs | Permanent | Dedicated only |

**Why this split matters:**

- **Repo-adjacent state** (`.omoc/plans/`, `.omoc/notepad.md`, `.omoc/config.json`) travels with the repository. It's the project's memory. This is what makes `/resume` work after a machine migration.
- **Machine-local state** (active sessions, worker heartbeats, mailbox) is hot operational data that's meaningless after a session ends. Storing it in the repo would pollute git history. On Dedicated tier, Fly.io Machines handle this ephemerally.
- **Control-plane state** is what the ClawFlint dashboard reads. It provides cross-session history, cost analytics, and team management. BYOM users don't have this — their dashboard shows config only, not live session data.

**Recovery implications**: If a Fly.io Machine crashes during a Dedicated session, ClawFlint provisions a new machine, clones the repo (which includes `.omoc/plans/` and `.omoc/config.json`), reconstructs session state from the control-plane database, and resumes from the last completed task. The machine-local mailbox/heartbeat data is lost, but the task completion records in the control plane are durable.

### 8.2 — Repo-Adjacent Directory Structure

```
.omoc/                        # IN THE REPO (gitignored by default, optionally committed)
├── config.json               # Project-level OmOC configuration
├── plans/
│   ├── plan-20260406-1423.md # Timestamped plan documents
│   └── plan-latest.md       # Symlink to most recent plan
├── notepad.md                # Persistent memory (survives context pruning)
└── agents-overlay.md         # Runtime overlay additions discovered during execution
```

### 8.3 — Machine-Local State Structure

```
~/.omoc/sessions/<session-id>/   # MACHINE-LOCAL (ephemeral, archived on completion)
├── session.json                  # Active session metadata
├── tasks/
│   ├── task-001.json            # Individual task records
│   └── ...
├── workers/
│   ├── worker-1.json            # Worker heartbeat + status
│   └── ...
├── mailbox/
│   ├── inbox.jsonl              # Messages TO Foreman
│   └── outbox.jsonl             # Messages FROM Foreman
├── checkpoints/
│   ├── cp-iter-010.json         # Loop checkpoint
│   └── cp-latest.json
├── worktrees/
│   ├── worker-1/               # Git worktree for worker 1
│   └── ...
└── logs/
    └── session.jsonl            # Structured session log
```

### 8.4 — Task Record Schema

Each task is a JSON file with lifecycle state:

```json
{
  "id": "task-001",
  "plan_id": "plan-20260406-1423",
  "description": "Implement Google OAuth callback handler",
  "category": "standard",
  "status": "in_progress",
  "assigned_to": "builder",
  "worker_id": "worker-1",
  "worktree": ".omoc/worktrees/worker-1",
  "branch": "omoc/task-001",
  "created_at": "2026-04-06T14:23:00Z",
  "started_at": "2026-04-06T14:24:12Z",
  "completed_at": null,
  "attempts": 1,
  "max_attempts": 3,
  "verification": {
    "status": "pending",
    "reviewer_notes": null
  },
  "dependencies": [],
  "blocked_by": null
}
```

### 8.5 — Task Status Lifecycle

```
created → queued → assigned → in_progress → verifying → completed
                                    ↓              ↓
                                  failed        rejected
                                    ↓              ↓
                                  retrying     re_assigned
```

### 8.6 — Worker State Schema

```json
{
  "worker_id": "worker-1",
  "agent": "builder",
  "task_id": "task-001",
  "session_id": "sess-abc123",
  "worktree": ".omoc/worktrees/worker-1",
  "status": "active",
  "last_heartbeat": "2026-04-06T14:30:45Z",
  "commits": ["a1b2c3d", "e4f5g6h"],
  "token_usage": {
    "input": 12450,
    "output": 3200,
    "cost_usd": 0.42
  }
}
```

### 8.7 — Notepad (Persistent Memory)

`.omoc/notepad.md` survives context pruning and compaction. It is always injected into agent context on session start. Contents:
- Project conventions discovered during execution
- Key decisions made during planning
- Error patterns encountered and solutions found
- User preferences expressed during interactions

---

## 9. Lifecycle Management

### 9.1 — Session Lifecycle Commands

| Command | Behavior |
|---------|----------|
| `/run`, `/loop`, `/parallel` | Start a new session |
| `/status` | Show active session, task queue, worker states |
| `/pause` | Pause active session (workers finish current task, then stop) |
| `/resume` | Resume paused session from last completed task |
| `/cancel` | Cancel active session with clean shutdown |
| `/cleanup` | Remove stale state, prune worktrees, archive logs |

### 9.2 — Atomic Operation Definition

When `/pause` or `/cancel` is issued, workers complete their current "atomic operation" before stopping. An atomic operation is the smallest unit of work that must complete to leave the codebase in a consistent state:

| Context | Atomic Operation | Rationale |
|---------|-----------------|-----------|
| File write in progress | Complete the single file write | Partial file writes corrupt the codebase |
| Multi-file edit (e.g., rename across files) | Complete ALL files in the edit batch | Partial renames break imports |
| `bash` command running | Wait for command to exit (timeout: 60s) | Killing mid-command can leave locks/temp files |
| Test suite running | Wait for current test FILE to finish (not entire suite) | Suite-level is too coarse; file-level is safe |
| Git commit in progress | Complete the commit | Partial commits corrupt the index |
| Git merge in progress | **Abort the merge**, revert to pre-merge state | Partial merges are worse than no merge |
| Verification by Reviewer | Complete current verification check | Partial verification is meaningless |

**Timeout**: If an atomic operation doesn't complete within 120 seconds of the pause/cancel signal, the worker is force-killed and its task is marked `interrupted` with a note. The worktree preserves whatever state exists for manual recovery.

**During merge conflict resolution**: `/cancel` aborts the merge immediately (`git merge --abort`) and marks the affected tasks for re-assignment. Merge conflicts are never "half resolved."

### 9.3 — Cancel Semantics

Cancel is not just "kill everything." It follows a protocol:

1. **Signal**: Foreman receives cancel request
2. **Drain**: Active workers complete their current atomic operation (see §9.2)
3. **Revert**: Uncommitted changes are stashed or reverted per AGENTS.md cancellation protocol
4. **Cleanup**: Worker worktrees are pruned, branches deleted if incomplete
5. **Report**: Final status message sent to user via event router
6. **State**: Session marked `cancelled` with cleanup timestamp
7. **Audit**: Full cancel event logged to session log and control plane

### 9.4 — Resume Semantics

Resume picks up from the last known-good state:

1. **Load**: Read `.omoc/state/session.json` for the paused/crashed session
2. **Inventory**: Check which tasks are `completed`, `in_progress`, `queued`
3. **Recover**: Tasks that were `in_progress` are reset to `queued` (their partial work is in the worktree)
4. **Re-assign**: Foreman re-assigns queued tasks to available workers
5. **Continue**: Execution continues from the first incomplete task

### 9.5 — Stale State Detection

A background hook checks for stale state on session start and periodically:

| Condition | Detection | Action |
|-----------|-----------|--------|
| Worker heartbeat >5 min old | Heartbeat timestamp check | Mark worker `stale`, re-assign task |
| Session idle >30 min | Session last-activity check | Notify user, offer resume or cancel |
| Orphan worktrees | Worktrees without active task records | Prune after confirmation |
| Incomplete plans | Plans without associated sessions | Archive to `.omoc/plans/archive/` |

### 9.6 — Shutdown Protocol (Parallel Mode)

```
/cancel                       # User initiates
  → Foreman: signal all workers to drain
  → Workers: finish current commit or rollback
  → Foreman: collect final worker states
  → Foreman: merge completed work to main branch
  → Foreman: prune worker worktrees
  → Foreman: emit session.shutdown event
  → Lead: notify user with summary
```

---

## 10. Concurrency & Cost Controls

### 10.1 — Concurrency Policies

```json
{
  "concurrency": {
    "max_parallel_workers": 5,
    "max_background_tasks": 10,
    "per_provider_limit": 3,
    "per_model_limit": 2,
    "stale_task_timeout_seconds": 300
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `max_parallel_workers` | 5 | Maximum simultaneous workers in `/parallel` mode |
| `max_background_tasks` | 10 | Maximum background tasks across all agents |
| `per_provider_limit` | 3 | Maximum concurrent API calls to a single provider |
| `per_model_limit` | 2 | Maximum concurrent API calls to a single model |
| `stale_task_timeout_seconds` | 300 | Seconds before an unresponsive task is marked stale |

### 10.2 — Cost Controls

```json
{
  "cost_controls": {
    "session_budget_usd": 10.00,
    "task_budget_usd": 3.00,
    "alert_threshold_percent": 75,
    "hard_stop_on_budget": true,
    "loop_max_iterations": 100
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `session_budget_usd` | 10.00 | Maximum total spend per session; 0 = unlimited |
| `task_budget_usd` | 3.00 | Maximum spend per individual task |
| `alert_threshold_percent` | 75 | Alert user when this percentage of budget is used |
| `hard_stop_on_budget` | true | If true, halt execution when budget exceeded; if false, alert only |
| `loop_max_iterations` | 100 | Hard cap on `/loop` iterations |

### 10.3 — Cost Tracking

Each worker state record includes token usage. Foreman aggregates across all workers and checks against budgets before assigning new tasks. The event router emits `cost.alert` when thresholds are hit and `cost.exceeded` when budgets are blown.

### 10.4 — Stale Task Reaping

A background interval (every 60 seconds during active sessions) checks for:
- Workers that haven't sent a heartbeat within `stale_task_timeout_seconds`
- Background tasks that completed but whose results were never collected
- Orphaned sessions from crashed gateway processes

Stale tasks are logged, their workers marked inactive, and their tasks returned to the queue for re-assignment.

---

## 11. Hook Lifecycle System

### 11.1 — Hook Tiers

| Tier | Purpose | Example Hooks |
|------|---------|---------------|
| **Session** | Agent session lifecycle | `session-start`, `session-idle`, `session-end`, `session-recovery` |
| **Guard** | Pre-execution validation | `tool-permission-check`, `context-window-monitor`, `rate-limit-guard`, `cost-budget-check` |
| **Transform** | Message/context modification | `intent-classifier`, `category-router`, `prompt-injector`, `agents-md-injector` |
| **Continuation** | Completion enforcement | `todo-enforcer`, `loop-manager`, `verification-gate`, `stale-task-reaper` |
| **Skill** | Skill-specific behavior | `category-skill-reminder`, `auto-command-router` |

### 11.2 — Core Hooks

| Hook | Tier | Trigger | Behavior |
|------|------|---------|----------|
| `intent-classifier` | Transform | `chat.message` | Classifies user intent before any action |
| `agents-md-injector` | Transform | `agent:bootstrap` | Injects project + directory AGENTS.md overlays into agent context |
| `context-window-monitor` | Guard | `tool.execute.before` | Alerts when context usage exceeds threshold |
| `cost-budget-check` | Guard | `tool.execute.before` | Blocks execution if session/task budget exceeded |
| `tool-permission-check` | Guard | `tool.execute.before` | Enforces per-agent tool restrictions (Layer 2 enforcement) |
| `todo-enforcer` | Continuation | `agent:bootstrap` | Injects TODO continuation mandate |
| `loop-manager` | Continuation | `session.idle` | Manages persistent completion loops |
| `verification-gate` | Continuation | `tool.execute.after` | Ensures output passes quality checks |
| `comment-quality` | Guard | `tool.execute.after` (write/edit) | Detects and removes AI-generated boilerplate comments |
| `session-recovery` | Session | `session.error` | Automatic recovery from API errors, rate limits |
| `compaction-preserver` | Session | `session.compacting` | Preserves critical context (notepad, AGENTS.md, task state) during compression |
| `stale-task-reaper` | Continuation | Timer (60s) | Detects and recovers stale workers and tasks |
| `event-emitter` | Session | All events | Emits typed events to the event router |

### 11.3 — Hook Configuration

```json
{
  "disabled_hooks": ["comment-quality"],
  "hook_config": {
    "context-window-monitor": { "threshold": 0.85 },
    "loop-manager": { "max_iterations": 50 },
    "stale-task-reaper": { "interval_seconds": 60 },
    "cost-budget-check": { "warn_only": false }
  }
}
```

---

## 12. Event Router & Worker Supervision

### 12.1 — Design Principle

The event router operates entirely outside agent context windows. Agents never spend tokens on notification formatting, delivery tracking, or status reporting.

### 12.2 — Event Types

| Event | Source | Default Route |
|-------|--------|---------------|
| `session.start` | Session created | `#agent-status` |
| `session.idle` | Agent idle >30s | `#agent-status` |
| `session.complete` | All tasks done | `#agent-status` |
| `session.error` | Agent error | `#alerts` (@mention) |
| `session.blocked` | Needs human input | `#alerts` (@mention) |
| `git.commit` | Worker committed | `#build-log` |
| `git.merge` | Leader integrated branch | `#build-log` |
| `git.conflict` | Merge conflict | `#alerts` (@mention) |
| `test.pass` | All tests passing | `#build-log` |
| `test.fail` | Test failure | `#alerts` |
| `verification.pass` | Reviewer approved | `#agent-status` |
| `verification.fail` | Reviewer rejected | `#agent-status` |
| `plan.ready` | Plan awaiting approval | `#alerts` (@mention) |
| `cost.alert` | Budget threshold hit | `#alerts` (@mention) |
| `cost.exceeded` | Budget exceeded | `#alerts` (@mention) |
| `worker.stale` | Worker heartbeat lost | `#alerts` |
| `loop.iteration` | Loop count update | `#agent-status` (every 10th) |

### 12.3 — Worker Supervision (Beyond Events)

For durable parallel execution, the event router is necessary but not sufficient. OmOC also implements worker supervision semantics:

**Heartbeats**: Each worker writes a heartbeat timestamp to `.omoc/state/workers/<id>.json` every 30 seconds. Foreman checks heartbeats before assigning new tasks.

**Mailbox**: Workers and Foreman communicate via an append-only JSONL mailbox under the session's machine-local state directory. Workers post completion notices, error reports, and questions. Foreman posts assignments, nudges, and cancellation requests. This decouples worker communication from the event router.

**Mailbox atomicity guarantees**:
- Each message is a single line of JSON terminated by `\n`. Writers append one complete line per operation.
- Writes use the atomic pattern: write to a temp file in the same directory, `fsync`, then `rename` to append position. This prevents partial-line corruption from crashes.
- File locking: Writers acquire an advisory lock (`flock`) on a `.lock` file before appending. Lock is held only for the duration of the single-line write (microseconds). If lock acquisition fails after 5 seconds, the message is queued in memory and retried.
- Readers use line-based parsing and skip any trailing incomplete line (crash during write). A truncated final line is treated as "not yet committed" and ignored.
- Corruption recovery: On session start, `/omoc doctor` validates mailbox JSONL integrity. Lines that fail JSON parse are moved to a `.corrupted` sidecar file and logged. The mailbox continues from the last valid line.
- Ordering: Messages are ordered by append position. No global clock synchronization required. Workers read from their last-known position (tracked in worker state).

**Nudge Delivery**: If a worker appears idle but its heartbeat is fresh, Foreman sends a nudge via the mailbox: "task-001 is still assigned to you — are you blocked?" This prevents silent stalls.

**Monitor Snapshots**: Periodically, Foreman writes a snapshot of all worker states to `.omoc/state/monitor.json`. This provides a single-file view of the entire team for the `/status` command and the dashboard.

### 12.4 — Route Configuration

```json
{
  "event_routing": {
    "channels": {
      "agent-status": "discord:CHANNEL_ID_1",
      "build-log": "discord:CHANNEL_ID_2",
      "alerts": "discord:CHANNEL_ID_3"
    },
    "mention_policy": {
      "alerts": "@USER_ID",
      "plan.ready": "@USER_ID",
      "cost.alert": "@USER_ID"
    },
    "suppression": {
      "git.commit": { "cooldown_seconds": 30 },
      "loop.iteration": { "interval": 10 }
    },
    "summary_mode": {
      "enabled": false,
      "batch_interval_seconds": 60,
      "batch_events": ["git.commit", "verification.pass", "verification.fail", "loop.iteration"],
      "format": "✅ {{pass_count}} tasks completed, ⚠️ {{fail_count}} failed, 📝 {{commit_count}} commits"
    }
  }
}
```

When `summary_mode` is enabled, batched events are collected over the interval and delivered as a single digest message instead of individual notifications. Non-batched events (alerts, plan.ready, cost.exceeded) are always delivered immediately regardless of this setting.

---

## 13. Operator Tooling

### 13.1 — Setup

```
/omoc setup
```

Performs first-time project initialization:
- Scaffolds `.omoc/` directory structure
- Generates `AGENTS.md` template at project root
- Validates OpenClaw Plugin SDK version compatibility
- Checks for conflicting plugins
- Registers agent configs into `openclaw.json5`
- Reports setup status

### 13.2 — Doctor

```
/omoc doctor
```

Comprehensive diagnostic check:

| Check | What It Verifies |
|-------|-----------------|
| Plugin registration | OmOC is loaded and enabled in OpenClaw |
| Agent registration | All 11 agents are registered with correct configs |
| Model resolution | Each agent can resolve at least one available model |
| API key availability | Required provider keys are set |
| Config validation | JSON schema passes, no conflicting overrides |
| State integrity | `.omoc/state/` is readable, no corrupted task records |
| Worktree health | No orphan worktrees, all active worktrees have task records |
| Event router | clawhip daemon reachable (if configured) |
| Dependency check | Required CLIs available (git, tmux, codex/claude) |

Output: pass/warn/fail per check with actionable fix suggestions.

### 13.3 — Status

```
/omoc status
```

Live view of:
- Active session (if any): mode, elapsed time, token usage
- Task queue: N completed / N in progress / N queued / N failed
- Worker states: which agent is running, last heartbeat, current task
- Budget usage: $X.XX of $Y.YY spent (Z% of session budget)
- Recent events: last 5 events emitted

### 13.4 — Health

```
/omoc health
```

Lightweight ping that returns plugin version, uptime, and a single OK/WARN/ERROR status. Designed for automated monitoring.

### 13.5 — Config Inspection

```
/omoc config
```

Shows current effective configuration with sensitive values masked (API keys show `sk-...XXXX`). Highlights any overrides from project config vs user config vs defaults.

---

## 14. Security Architecture

### 14.1 — Threat Model

OmOC runs autonomous agents that can write code, execute shell commands, and push to git repositories. The security model must protect against: agents acting beyond their intended scope, credential exposure, unauthorized repository access, destructive operations, and malicious prompt injection from untrusted content.

### 14.2 — Secret Management

| Secret Type | Storage Location | Access Scope |
|-------------|-----------------|-------------|
| LLM API keys (OpenAI, Anthropic, Google) | Environment variables on host machine, never in config files | All agents (read-only, via OpenClaw gateway) |
| GitHub/Git repo tokens | Environment variable `OMOC_GIT_TOKEN` | Foreman and workers (scoped to configured repo only) |
| Discord bot token | clawhip config (`~/.clawhip/config.toml`), not in OmOC config | clawhip daemon only (never exposed to agents) |
| ClawFlint dashboard credentials | WorkOS AuthKit session (Dedicated tier) | Dashboard only, never passed to agents |

**Rules**:
- Secrets are NEVER written to `.omoc/` state files, logs, mailbox, or plans
- Secrets are NEVER included in agent prompts, tool call arguments, or tool results
- The `event-emitter` hook strips any detected secret patterns (API key prefixes, token formats) from event payloads before delivery
- `/omoc config` masks all secret values (`sk-...XXXX`)

### 14.3 — Repository Token Scoping

Git operations use a dedicated token with minimal permissions:

| Permission | Granted | Rationale |
|-----------|---------|-----------|
| Read repository contents | ✅ | Agents need to read code |
| Write/push to branches | ✅ (scoped branches only) | Workers push to `omoc/*` branches only |
| Push to `main`/`master` | ❌ | Protected by branch rules; merge requires approval gate |
| Delete branches | ✅ (scoped to `omoc/*` only) | Cleanup of worker branches |
| Create/merge pull requests | ✅ | Final output delivery |
| Modify repo settings | ❌ | No admin access |
| Access other repos | ❌ | Token scoped to single repo |

### 14.4 — Shell and Network Restrictions

| Agent | Shell Access | Network Access | Rationale |
|-------|-------------|---------------|-----------|
| Lead, Foreman | No general shell | Outbound API calls only | Orchestrators don't need shell |
| Builder, Architect | Sandboxed shell (project directory only) | Outbound for `npm install`, `pip install` (configurable allowlist) | Workers need shell for build/test |
| Reviewer | Test commands only (`npm test`, `pytest`, etc.) | No network | Reviewer runs tests, nothing else |
| Scout, Researcher, Observer | No shell | Web search only (via MCP/tool) | Read-only support agents |
| Planner, Auditor, Critic | No shell | Web search only | Planning agents don't execute |

Shell access is enforced at the OpenClaw level via `allowed-tools` configuration, not just prompts.

### 14.5 — Destructive Operation Protection

The following operations ALWAYS require human approval regardless of configuration:

- `git push --force` (blocked entirely — OmOC never force-pushes)
- `rm -rf` or recursive deletion outside `.omoc/worktrees/`
- Dropping database tables or destructive migrations
- Modifying CI/CD configuration files
- Pushing to protected branches
- Publishing packages to registries
- Any operation matching patterns defined in `AGENTS.md` constraints section

### 14.6 — Audit Trail

Every tool call, agent delegation, and workflow command is logged to:

| Destination | Contents | Retention |
|-------------|----------|-----------|
| Session log (`session.jsonl`) | All tool calls with arguments and results, agent messages, state transitions | Archived per session, machine-local |
| Control plane (Dedicated tier) | Session summaries, cost records, approval decisions, error events | Permanent |
| Event router | User-facing events (commits, completions, errors, alerts) | Per channel retention policy |

Audit records include: timestamp, session ID, agent name, tool name, tool arguments (secrets redacted), result summary, token usage, and cost.

### 14.7 — Channel Identity Verification

When OmOC receives commands from a messaging channel (Discord, Telegram, etc.), it relies on OpenClaw's existing pairing and allowlist system to verify the sender's identity. OmOC adds one additional check: only users listed in the `omoc_operators` config array can execute destructive or administrative commands (`/cancel`, `/cleanup`, `/omoc setup`). Regular paired users can trigger `/run`, `/plan`, `/loop`, and `/status`.

---

## 15. Reliability Stance

### 15.1 — Explicit Design Choice

OmOC targets a **managed-product reliability level** that sits between the lightweight OpenClaw port (happycastle114/oh-my-openclaw) and the full OmO harness (code-yeongyu/oh-my-openagent). This is a deliberate positioning choice, not a gap.

### 15.2 — What OmOC Includes (Production-Grade)

| Capability | Status | Rationale |
|-----------|--------|-----------|
| Durable state model with task records and worker state | ✅ Included | Required for resume, cancel, and managed product SLA |
| Session recovery from crashes and rate limits | ✅ Included | Non-negotiable for autonomous execution |
| Model fallback chains with automatic retry | ✅ Included | Required for multi-provider reliability |
| Cost budgets with hard stops | ✅ Included | Required for managed product where users pay per session |
| Compaction/context preservation | ✅ Included | Required for long-running sessions |
| Three-layer tool permission enforcement | ✅ Included | Required for safe autonomous execution |
| Operator diagnostics (setup, doctor, status) | ✅ Included | Required to reduce support burden |

### 15.3 — What OmOC Defers to Future Versions

| Capability | Status | Rationale |
|-----------|--------|-----------|
| Write guards and edit-error recovery | ⏳ **v1.x** (post-alpha, based on measured error rates) | Important for autonomous safety; promoted from v2.0 based on review feedback. Ship after measuring real-world error rates in alpha. |
| Hash-anchored edits (content-hash validation before writes) | ⏳ v2.0 | High value but complex; evaluate after core stability proven |
| LSP integration (rename, goto-definition, diagnostics) | ⏳ v2.0 | IDE-level precision; may not be needed in channel-first UX |
| AST-aware search/replace (AST-Grep) | ⏳ v2.0 | Powerful but niche; most tasks don't need it |
| Full 46-hook ecosystem | ⏳ Incremental | Start with core hooks, add based on real user demand |

### 15.4 — What OmOC Intentionally Omits

| Capability | Status | Rationale |
|-----------|--------|-----------|
| Terminal-only TUI | ❌ Not applicable | OmOC is channel-first (Discord/Telegram), not terminal-first |
| OpenCode plugin compatibility | ❌ Not applicable | OmOC is OpenClaw-native, not an OpenCode plugin |

---

## 16. Configuration Schema

### 16.1 — Top-Level Configuration

```json
{
  "$schema": "https://clawflint.com/schemas/omoc-v1.json",
  
  "project": {
    "name": "GoTogether Auth Module",
    "repo": "github.com/engmsaleh/gotogether",
    "branch": "feature/oauth",
    "working_directory": "src/auth"
  },
  
  "model_tiers": { },
  "agents": { },
  "categories": { },
  "custom_categories": { },
  
  "workflows": {
    "default_approval_gate": "required",
    "loop_max_iterations": 100,
    "parallel_max_workers": 5
  },
  
  "concurrency": { },
  "cost_controls": { },
  
  "disabled_hooks": [],
  "hook_config": { },
  
  "event_routing": { },
  
  "disabled_agents": []
}
```

---

## 17. OpenClaw Plugin Architecture

### 17.1 — Plugin Manifest

```json
{
  "name": "oh-my-openclaw",
  "version": "1.0.0",
  "description": "Multi-agent orchestration for OpenClaw by ClawFlint",
  "author": "ClawFlint (clawflint.com)",
  "license": "MIT",
  "main": "dist/index.js",
  "hooks": [
    { "event": "gateway:startup", "handler": "onGatewayStartup" },
    { "event": "agent:bootstrap", "handler": "onAgentBootstrap" },
    { "event": "message:received", "handler": "onMessageReceived" },
    { "event": "message:sent", "handler": "onMessageSent" },
    { "event": "tool_result_persist", "handler": "onToolResult" }
  ],
  "tools": [
    { "name": "delegate", "description": "Category-based task delegation with model routing" },
    { "name": "summon", "description": "Direct agent invocation by name" },
    { "name": "checkpoint", "description": "Save/load/list execution checkpoints" }
  ],
  "commands": [
    "/run", "/plan", "/build", "/loop", "/parallel",
    "/omoc", "/omoc setup", "/omoc doctor", "/omoc status",
    "/omoc health", "/omoc config",
    "/status", "/pause", "/resume", "/cancel", "/cleanup"
  ]
}
```

### 17.2 — Initialization Pipeline

```
1. loadConfig()        → Parse JSON config, merge user + project overrides, validate with Zod
2. createManagers()    → BackgroundManager, WorktreeManager, StateManager, EventRouter, CostTracker
3. createAgents()      → Build agent configs with model resolution + prompt assembly + AGENTS.md overlay
4. createTools()       → Register delegate, summon, checkpoint tools
5. createHooks()       → Compose hook pipeline (session → guard → transform → continuation)
6. createInterface()   → Map to OpenClaw Plugin API handlers
```

### 17.3 — Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript |
| Runtime | Bun (consistent with ClawFlint) |
| Package Manager | pnpm |
| Testing | Vitest |
| Schema Validation | Zod |
| Plugin API | OpenClaw Plugin SDK |
| Event Routing | clawhip integration via native bridge |
| Parallel Execution | tmux sessions + git worktrees |
| State Persistence | JSON files under `.omoc/state/` |
| Configuration | JSONC (comments, trailing commas) |

---

## 18. ClawFlint Tier Integration

| Tier | OmOC Capability |
|------|----------------|
| **Hosted ($29/mo)** | Single-agent deployment only. No OmOC orchestration. |
| **Dedicated ($99/mo)** | Full OmOC orchestration. Agent teams on ClawFlint-managed Fly.io Machines. Dashboard config. Up to 5 parallel workers. |
| **BYOM ($19/mo)** | OmOC plugin installable on customer's own VPS. ClawFlint provides config UI only. Unlimited workers. |

---

## 19. Phased Build Plan

### Phase 1 — Foundation (Weeks 1–3)

- [ ] Plugin scaffold (TypeScript + Bun + Vitest)
- [ ] Configuration schema with Zod validation
- [ ] State model: `.omoc/` directory structure, session/task persistence
- [ ] Lead agent with intent classification
- [ ] Builder agent with write permissions
- [ ] `delegate()` tool with category routing
- [ ] `/loop` command (single-agent persistent loop)
- [ ] `/cancel` and `/status` commands
- [ ] AGENTS.md scaffolding via `/omoc setup`
- [ ] `/omoc doctor` basic diagnostics
- [ ] Event emission to clawhip
- [ ] Testing: 80 unit + 20 integration + 5 simulation + 3 live (see §20.8)

**Deliverable**: `/loop fix the tests` works end-to-end with durable state, cancel, resume, and Discord notifications.

### Phase 2 — Planning Layer (Weeks 4–5)

- [ ] Planner, Auditor, Critic agents
- [ ] `/plan` and `/build` commands
- [ ] Approval gate system
- [ ] Plan persistence in `.omoc/plans/`
- [ ] AGENTS.md overlay injection hook
- [ ] Testing: cumulative 120 unit + 40 integration + 10 simulation + 5 live (see §20.8)

### Phase 3 — Parallel Execution (Weeks 6–9)

**⚠️ Timeline risk: This is the densest phase.** It introduces Foreman, worktrees, parallel workers, heartbeats, mailbox, merge strategy, stale-task reaper, Reviewer, `/run`, budgets, pause/resume/cleanup, and monitor snapshots. Consider splitting into Phase 3a (Foreman + worktrees + `/parallel`, weeks 6–7) and Phase 3b (full `/run` pipeline + lifecycle commands, weeks 8–9) if velocity is slower than projected.

- [ ] Foreman agent (execution orchestrator, separate from Lead)
- [ ] Architect agent (deep worker)
- [ ] WorktreeManager with git worktree lifecycle
- [ ] `/parallel` command with N workers
- [ ] Worker heartbeats, mailbox, nudge delivery
- [ ] Leader/worker merge strategy
- [ ] Stale task reaper
- [ ] Reviewer agent (verification gate)
- [ ] `/run` command (full pipeline)
- [ ] Cost tracking and budget enforcement
- [ ] `/pause`, `/resume`, `/cleanup` commands
- [ ] Monitor snapshots for `/status`
- [ ] Testing: cumulative 180 unit + 70 integration + 15 simulation + 10 live + 3 E2E (see §20.8)
- [ ] All 9 resilience test scenarios passing (see §20.7)

### Phase 4 — Support Agents & Polish (Weeks 9–10)

- [ ] Scout, Researcher, Observer agents
- [ ] Comment quality hook
- [ ] Context window monitor
- [ ] Session recovery hook
- [ ] Compaction preserver
- [ ] Custom categories
- [ ] `/omoc health`, `/omoc config`
- [ ] Three-layer permission enforcement (prompt + plugin + host)
- [ ] Documentation
- [ ] Testing: cumulative 220 unit + 90 integration + 20 simulation + 15 live + 7 E2E (see §20.8)

### Phase 5 — Dashboard Integration (Weeks 11–14)

- [ ] Team Builder, Workflow Designer, Event Router UI
- [ ] Session Monitor live view
- [ ] Cost Dashboard
- [ ] Fly.io Machine provisioning (Dedicated tier)
- [ ] BYOM installation flow
- [ ] Testing: cumulative 250 unit + 100 integration + 20 simulation + 15 live + 10 E2E (see §20.8)

---

## 20. Testing Strategy

### 20.1 — Testing Layers

OmOC spans LLM API calls, file system state, git operations, messaging channels, and inter-agent communication. Each layer requires a different testing approach. The testing strategy is organized into five tiers of increasing realism and cost.

| Tier | What It Tests | LLM Calls | Git Ops | Channels | Speed | Cost |
|------|--------------|-----------|---------|----------|-------|------|
| **Unit** | Individual functions, schema validation, config merging | Mocked | Mocked | None | Fast (seconds) | Free |
| **Integration** | Tool pipelines, hook chains, state transitions | Mocked | Real (temp repos) | Mocked | Medium (seconds) | Free |
| **Simulation** | Full workflows with deterministic LLM responses | Recorded/replayed | Real (temp repos) | Mocked | Medium (minutes) | Free |
| **Live** | Full workflows with real LLM providers | Real API calls | Real (temp repos) | Mocked | Slow (minutes) | Tokens |
| **End-to-End** | Complete user journeys from Discord to merged PR | Real API calls | Real (test repos) | Real (test channels) | Slow (minutes) | Tokens + infra |

### 20.2 — Tier 1: Unit Tests

Pure function tests with no external dependencies. All LLM responses, file system operations, and git commands are mocked.

**What to test:**
- Config loading, merging, Zod schema validation
- Category → model tier resolution logic
- Fallback chain walking
- Task status lifecycle state machine (valid transitions only)
- Intent classification keyword matching
- Tool permission matrix enforcement (given agent X calling tool Y, allow or deny?)
- Cost budget arithmetic (accumulation, threshold checks, hard stop logic)
- Mailbox JSONL line parsing and corruption handling
- AGENTS.md overlay merge logic and precedence rules
- Heartbeat staleness detection
- Event suppression and summary mode batching logic
- Secret pattern detection and redaction

**Target:** 200+ unit tests by Phase 2. Run on every commit.

**Framework:** Vitest with in-memory fixtures. No file system, no network, no git.

### 20.3 — Tier 2: Integration Tests

Tests that exercise real file system and real git operations against temporary repositories, but mock all LLM calls.

**What to test:**
- `.omoc/` directory scaffolding via `/omoc setup`
- Task record creation, update, and lifecycle transitions on disk
- Worker state file writes and heartbeat updates
- Mailbox append atomicity (concurrent writes from multiple workers)
- Git worktree creation, isolation, and cleanup
- Git branch creation, commit, merge (non-conflicting)
- Git merge conflict detection and abort
- Checkpoint save/load/restore
- Session state persistence across simulated crash (kill process, restart, verify state)
- Resume logic: load session → inventory tasks → recover in-progress → re-assign
- Cancel protocol: signal → drain → revert → cleanup → verify clean state
- `/omoc doctor` diagnostic checks against known-good and known-bad states
- AGENTS.md file discovery across directory hierarchy

**Environment setup:**
```bash
# Each integration test gets a fresh temporary repo
const tmpDir = await mkdtemp('/tmp/omoc-test-');
await exec('git init', { cwd: tmpDir });
await writeFile(join(tmpDir, 'AGENTS.md'), scaffoldTemplate);
// Test runs here
// Cleanup: rm -rf tmpDir
```

**Target:** 100+ integration tests by Phase 3. Run on every PR.

### 20.4 — Tier 3: Simulation Tests (Recorded LLM Responses)

Full workflow tests using recorded/replayed LLM responses. This tests the orchestration logic end-to-end without spending tokens.

**How it works:**
1. Run a real session once with `OMOC_RECORD_MODE=true`
2. All LLM API calls and responses are captured to `.omoc/recordings/<session-id>.jsonl`
3. Subsequent test runs replay the recorded responses deterministically
4. Assertions check: correct agent invocations, correct tool calls, correct state transitions, correct event emissions

**What to test:**
- `/loop` full lifecycle: start → iterate → verify → complete
- `/plan` full lifecycle: intent → Planner → Auditor → Critic → approval
- `/run` full pipeline: plan → approve → Foreman decompose → Builder execute → Reviewer verify → complete
- `/parallel` with 2 workers: decompose → parallel execution → merge → verify
- `/cancel` mid-execution: verify clean shutdown and state consistency
- `/resume` after simulated crash: verify pickup from correct task
- Cost budget exceeded mid-session: verify hard stop and notification
- Model fallback: primary model returns 429 → fallback model used → task completes
- Context window compaction: session exceeds 80% → compaction fires → critical context preserved

**Recording management:**
- Recordings are committed to the test suite (they're deterministic fixtures)
- When agent prompts change significantly, recordings need re-capture
- A CI job flags stale recordings (prompt hash mismatch) as warnings

**Target:** 20+ simulation tests covering all five workflow commands. Run on every PR.

### 20.5 — Tier 4: Live Tests (Real LLM Calls)

Tests against real LLM providers using real API keys. These are expensive and slow, so they run on a schedule (nightly) or manually before releases.

**Environment variables:**
```bash
OMOC_LIVE_TEST=1
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
OMOC_LIVE_TEST_BUDGET=2.00  # Hard cap: $2 per test run
```

**What to test:**
- `/loop "create a file called hello.txt with the text hello world"` → verify file exists with correct content
- `/loop "fix the intentional bug in src/math.ts"` (test repo with planted bug) → verify bug fixed, tests pass
- `/plan "add user authentication"` → verify plan is produced, is coherent, contains phases
- Category routing: `quick` task actually uses Tier 3 model, `deep` task uses Tier 1 model
- Fallback chain: artificially invalid API key for primary → verify fallback model activates
- Intent classification: 10 sample prompts → verify correct intent categorization

**Budget protection:**
- Each live test has a per-test token budget (default: $0.50)
- Test runner aborts if cumulative spend exceeds `OMOC_LIVE_TEST_BUDGET`
- Results include cost-per-test reporting for monitoring spend drift

**Target:** 15+ live tests. Run nightly and before releases. Skip in normal CI.

### 20.6 — Tier 5: End-to-End Tests (Full Channel Integration)

Complete user journeys from a real messaging channel through to a real git repository. These validate that the entire stack works — OpenClaw gateway, OmOC plugin, agents, git operations, event routing, and channel delivery.

**Infrastructure:**
- Dedicated test Discord server with bot and channels
- Test GitHub repository (private, ClawFlint-owned)
- clawhip instance pointed at test Discord channels
- OpenClaw gateway with OmOC plugin loaded

**Test scenarios:**

| Scenario | Steps | Assertions |
|----------|-------|------------|
| **Happy path: /loop** | Send `/loop create hello.txt` in Discord → wait for completion notification | File exists in repo, `#agent-status` shows completion, `#build-log` shows commit |
| **Happy path: /plan + /build** | Send `/plan add a README` → wait for plan → send `/build` → wait for completion | README.md exists, plan archived in `.omoc/plans/` |
| **Cancel mid-execution** | Send `/loop long running task` → wait 30s → send `/cancel` | Session state is `cancelled`, no orphan worktrees, `#alerts` shows cancel confirmation |
| **Resume after crash** | Start `/loop`, kill gateway process mid-task, restart gateway, send `/resume` | Task resumes from checkpoint, completes successfully |
| **Parallel merge conflict** | `/parallel 2 edit the same file differently` | Conflict detected, `#alerts` shows diff, session paused awaiting `/resolve` |
| **Budget exceeded** | Set `session_budget_usd: 0.50`, run expensive task | Session halts, `#alerts` shows budget exceeded, cost dashboard reflects spend |
| **Doctor on fresh install** | Send `/omoc doctor` | All checks pass, response in channel lists results |

**Execution:** Manual before major releases. Automated version runs weekly on a schedule using a Discord bot that sends commands and verifies responses programmatically.

**Target:** 10+ E2E scenarios. Run weekly and before releases.

### 20.7 — Resilience Tests

Targeted chaos tests that verify recovery from failure conditions. These run as part of integration and simulation tiers.

| Failure Scenario | How Simulated | Expected Recovery |
|-----------------|---------------|-------------------|
| Worker killed mid-commit | `process.kill(worker.pid)` during file write | Task marked `interrupted`, worktree preserved, task re-queued on resume |
| API rate limit (429) | Mock 429 response from primary model | Fallback model activated, task continues, event `model.fallback` emitted |
| Mailbox corruption | Append partial JSON line to inbox.jsonl | Doctor detects corruption, moves to `.corrupted`, session continues from last valid line |
| Task JSON corruption | Write invalid JSON to a task record | Session start skips corrupted task with warning, doctor reports it |
| Git worktree left behind | Create orphan worktree with no task record | `/cleanup` detects and prunes, doctor reports it |
| Gateway crash during merge | Kill process during `git merge` | Merge is aborted (incomplete merges detected on startup), task marked `conflict` |
| Disk full during state write | Mock `ENOSPC` on file write | Atomic write pattern prevents partial writes, error surfaced to user |
| Heartbeat timeout | Freeze worker process for >5 min (no heartbeat) | Stale-task reaper marks worker stale, re-assigns task |
| All fallback models unavailable | Mock failures for entire fallback chain | Task queued with `model_unavailable` status, user notified, session paused |

**Target:** All 9 resilience scenarios covered by Phase 4.

### 20.8 — Test Infrastructure

**Test repo template:**
A minimal repository with intentional characteristics for testing:
```
omoc-test-repo/
├── AGENTS.md             # Pre-configured for tests
├── src/
│   ├── math.ts           # Contains planted bug for /loop fix tests
│   ├── auth/
│   │   ├── AGENTS.md     # Subdirectory overlay for precedence tests
│   │   └── handler.ts
│   └── index.ts
├── tests/
│   └── math.test.ts      # Verifies planted bug is fixed
├── package.json
├── tsconfig.json
└── .gitignore            # Includes .omoc/
```

**CI pipeline:**
```
On every commit:
  → Tier 1 (unit tests)        ~10 seconds

On every PR:
  → Tier 1 (unit tests)        ~10 seconds
  → Tier 2 (integration tests) ~60 seconds
  → Tier 3 (simulation tests)  ~3 minutes

Nightly:
  → Tier 4 (live tests)        ~10 minutes, $2 budget cap

Weekly + pre-release:
  → Tier 5 (E2E tests)         ~30 minutes, manual trigger
```

**Test count targets by phase:**

| Phase | Unit | Integration | Simulation | Live | E2E | Total |
|-------|------|-------------|-----------|------|-----|-------|
| Phase 1 | 80 | 20 | 5 | 3 | 0 | 108 |
| Phase 2 | 120 | 40 | 10 | 5 | 0 | 175 |
| Phase 3 | 180 | 70 | 15 | 10 | 3 | 278 |
| Phase 4 | 220 | 90 | 20 | 15 | 7 | 352 |
| Phase 5 | 250 | 100 | 20 | 15 | 10 | 395 |

### 20.9 — Practices Adopted from Source Ecosystems

The following practices are informed by how OpenClaw (247K stars), oh-my-openagent, and oh-my-codex handle testing at scale:

**Temporary HOME isolation (from OpenClaw):**
Every non-live test creates a temporary HOME directory. Tests never read or write to the real `~/.omoc/` or `~/.openclaw/`. This prevents test pollution and makes CI deterministic.
```typescript
// test/test-env.ts
beforeEach(async () => {
  const tmpHome = await mkdtemp(join(tmpdir(), 'omoc-test-'));
  process.env.HOME = tmpHome;
  process.env.OMOC_HOME = join(tmpHome, '.omoc');
});
afterEach(async () => {
  await rm(tmpHome, { recursive: true });
});
```

**Co-located test files (from OmO):**
Tests live next to their implementation. `src/tools/delegate/delegate.ts` has `src/tools/delegate/delegate.test.ts`. This keeps the relationship visible and makes it natural to update tests alongside code.

**Module isolation for mock-heavy tests (from OmO):**
Bun's `mock.module()` can pollute the module cache and affect subsequent tests. Tests that heavily mock dependencies (state manager, background manager, event router) run in separate processes in CI:
```yaml
# CI strategy: isolated groups prevent cross-contamination
- bun test src/state/        # isolated
- bun test src/workers/      # isolated
- bun test --exclude src/state --exclude src/workers  # batched
```

**Contract tests (from OpenClaw):**
A dedicated test suite verifies that the OmOC plugin conforms to the OpenClaw Plugin SDK interface contract. These tests iterate over all registered hooks, tools, and commands and assert they match the expected shape. Run on every PR — catches interface drift early.
```typescript
test('all registered hooks have valid event names', () => {
  const plugin = loadOmOCPlugin();
  for (const hook of plugin.hooks) {
    expect(VALID_HOOK_EVENTS).toContain(hook.event);
    expect(typeof hook.handler).toBe('function');
  }
});
```

**Coverage thresholds (from OpenClaw):**
V8 coverage enforced via Vitest config with a **70% minimum** for lines, branches, functions, and statements. Only exercised files count — no ever-growing exclude list:
```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  thresholds: { lines: 70, branches: 70, functions: 70, statements: 70 },
  all: false  // only count files that are actually imported by tests
}
```

**Per-provider live test flags (from OpenClaw):**
Live tests are granular. Each provider can be tested independently:
```bash
OMOC_LIVE_TEST=1 bun test:live                           # all providers
OMOC_LIVE_ANTHROPIC=1 bun test:live                      # Anthropic only
OMOC_LIVE_OPENAI=1 bun test:live                         # OpenAI only
OMOC_LIVE_TEST_BUDGET=2.00 bun test:live                 # hard cap
OMOC_LIVE_MODELS="anthropic/claude-sonnet-4-6" bun test:live  # specific model
```

**Boot/install smoke tests (from OmX):**
Before every release, a smoke test verifies the plugin can be installed from a packed tarball, loaded by OpenClaw, and respond to `/omoc health` without errors. This catches packaging issues that unit tests miss:
```bash
npm pack                                            # create tarball
openclaw plugins install ./clawflint-oh-my-openclaw-1.0.0.tgz
openclaw gateway &                                  # start gateway
sleep 5
openclaw agent --message "/omoc health" --timeout 30  # verify response
```

**State inspection helpers (from OmO):**
Complex managers expose internal state for testing via helper functions. These are test-only exports, not public API:
```typescript
// Only exported in test builds
export function _testGetTaskMap(foreman: Foreman): Map<string, Task> { ... }
export function _testGetWorkerStates(foreman: Foreman): WorkerState[] { ... }
export function _testGetMailboxSize(foreman: Foreman): number { ... }
```

**Gateway/port isolation (from OpenClaw):**
Integration tests that start a gateway or daemon allocate unique ports to avoid collisions. Gateway tests run serially by default:
```typescript
const port = 25294 + parseInt(process.env.VITEST_WORKER_ID || '0');
```

**Version sync verification (from OmX):**
A pre-publish script verifies that `package.json` version, git tag, changelog entry, and plugin manifest version all match:
```bash
node scripts/check-version-sync.mjs --tag v1.0.0
```

---

## 21. Success Metrics

### North-Star Metric

**Verified mergeable completion rate without human intervention beyond approvals.**

This is the single metric that captures whether OmOC is delivering autonomous value. It measures: of all `/run` sessions that complete, what percentage produce code that passes Reviewer verification and merges cleanly — with the only human touchpoint being the plan approval gate.

### Operational Metrics

| Metric | Target |
|--------|--------|
| Verified mergeable completion rate | > 60% |
| Plugin install to first `/loop` | < 5 minutes |
| `/run` end-to-end completion rate | > 70% |
| `/cancel` clean shutdown rate | > 95% |
| Resume success rate (after crash/pause) | > 85% |
| Average token cost per session | < $5 median |
| `/omoc doctor` all-pass rate on fresh install | > 98% |
| Dedicated tier conversion | > 10% of Hosted users |

---

## 22. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| API rate limits during parallel execution | High | Medium | Per-provider/model concurrency limits, fallback chains, exponential backoff |
| Runaway token costs | Medium | High | Session/task budgets with hard stops, user alerts at 75% threshold |
| Git merge conflicts | Medium | Low | Conflict detection, user notification, approval gate |
| State corruption from crash during write | Low | High | Atomic writes (write-to-temp, rename), fsync |
| Stale workers consuming budget | Medium | Medium | Heartbeat monitoring, stale task reaper, automatic re-assignment |
| OpenClaw Plugin API changes | Low | High | Pin to stable version, compatibility shims |
| Agent producing destructive code | Low | High | Destructive operation gate (always required), sandboxed execution |

---

## 23. Open Questions

1. **Pricing**: $99/mo Dedicated includes OmOC — correct given token costs users also pay?
2. **Event router**: Ship lightweight built-in router, or require clawhip?
3. **Execution engines**: Support both Claude Code and Codex CLI?
4. **MCP integration**: Expose OmOC as an MCP server for CI/CD triggers?
5. **Name collision**: Differentiate via `@clawflint/oh-my-openclaw` scoped package?
6. **Foreman as separate agent vs mode**: Should Foreman be a distinct agent config, or a mode of Lead with a different prompt? Source systems argue for separation; simplicity argues for mode.

---

## Appendix A: Competitive Landscape

| Product | License | Strength | OmOC Advantage |
|---------|---------|----------|----------------|
| oh-my-openagent | Elastic License 2.0 | 11 agents, 46 hooks, full reliability stack | MIT, managed deployment, config-over-code |
| oh-my-codex (OmX) | MIT | Team mode, worktree isolation, durable state | Higher-level orchestration, multi-engine |
| oh-my-openclaw (happycastle114) | MIT | First OmO port to OpenClaw | Active development, commercial backing, durable state model |
| openclaw-claude-code | TBD | Multi-engine sessions, council orchestration | Full agent hierarchy, managed deployment |
| ClawTeam | TBD | Self-organizing teams, web dashboard | Tighter OpenClaw integration |

## Appendix B: Reference Architecture Sources

OmOC is an original implementation informed by publicly documented multi-agent orchestration patterns. Architectural patterns are drawn from:
- OpenClaw Plugin SDK documentation (MIT)
- OmX workflow and team-mode documentation (MIT)
- clawhip event routing documentation (MIT)
- Published blog posts, README files, and technical references
- General software engineering patterns for multi-agent systems, task scheduling, and distributed worker supervision

The implementation — including agent designs, prompts, naming, configuration schema, state model, and runtime code — is original to ClawFlint. Where specific design choices are informed by patterns observed in existing systems, this PRD documents the rationale.

No restrictively licensed source code was studied or reproduced.

---

*Document version: 1.4 | Last updated: April 6, 2026*
