# ClawFlint Platform Integration Tasks

## Overview

This document details what needs to be implemented in the ClawFlint platform to fully integrate with the oh-my-openclaw (OmOC) plugin.

## Current Status

✅ **Already Exists:**

- Config bundle endpoint (`/internal/workers/{id}/config/bundle`)
- Worker management API
- Config version management

❌ **Needs Implementation:**

- OmOC session API endpoints
- Dashboard data aggregation
- Real-time event streaming
- Plugin initialization system

---

## Phase 1: Dashboard API Routes

### 1.1 Create New Route File

**File:** `apps/api/src/routes/omocSessions.ts`

```typescript
import { Hono } from "hono";
import { authMiddleware } from "../auth/middleware";
import { getCurrentUser, getMembership } from "../lib/workspace";
import { db } from "@clawflint/db";
import { and, eq, desc } from "drizzle-orm";

export const omocSessionsRouter = new Hono();

// GET /:wid/omoc/sessions - List all OmOC sessions for workspace
omocSessionsRouter.get("/:wid/omoc/sessions", authMiddleware, async (c) => {
  // Implementation needed:
  // 1. Verify user membership in workspace
  // 2. Query OmOC session data from database
  // 3. Return formatted session list
});

// GET /:wid/omoc/sessions/:sid - Get specific session details
omocSessionsRouter.get(
  "/:wid/omoc/sessions/:sid",
  authMiddleware,
  async (c) => {
    // Implementation needed:
    // 1. Verify user membership
    // 2. Fetch session with tasks and workers
    // 3. Return detailed session view
  },
);

// GET /:wid/omoc/stats - Get aggregate statistics
omocSessionsRouter.get("/:wid/omoc/stats", authMiddleware, async (c) => {
  // Implementation needed:
  // 1. Calculate total sessions, costs, completion rates
  // 2. Aggregate by agent
  // 3. Return dashboard stats
});

// POST /:wid/omoc/sessions/:sid/cancel - Cancel a session
omocSessionsRouter.post(
  "/:wid/omoc/sessions/:sid/cancel",
  authMiddleware,
  async (c) => {
    // Implementation needed:
    // 1. Send cancel command to worker
    // 2. Update session status
  },
);
```

### 1.2 Register Routes

**File:** `apps/api/src/index.ts` (or wherever routes are registered)

```typescript
import { omocSessionsRouter } from "./routes/omocSessions";

// Add to router mounting
app.route("/", omocSessionsRouter);
```

### 1.3 Database Schema (if needed)

**File:** `@clawflint/db/schema.ts` (or wherever schemas are defined)

```typescript
// Add to existing schema or create new file
export const omocSessions = pgTable("omoc_sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  workerId: varchar("worker_id", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  mode: varchar("mode", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  completedAt: timestamp("completed_at"),
  costUsd: decimal("cost_usd", { precision: 10, scale: 2 }),
  budgetUsd: decimal("budget_usd", { precision: 10, scale: 2 }),
  metadata: json("metadata"),
});

export const omocTasks = pgTable("omoc_tasks", {
  id: varchar("id", { length: 255 }).primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  assignedTo: varchar("assigned_to", { length: 100 }),
  workerId: varchar("worker_id", { length: 255 }),
  createdAt: timestamp("created_at").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  costUsd: decimal("cost_usd", { precision: 10, scale: 2 }),
});
```

---

## Phase 2: Real-Time Event Streaming

### 2.1 WebSocket Handler for OmOC Events

**File:** `apps/api/src/routes/omocEvents.ts`

```typescript
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";

export const omocEventsRouter = new Hono();
const { upgradeWebSocket, websocket } = createBunWebSocket();

// WebSocket endpoint for real-time OmOC events
omocEventsRouter.get(
  "/:wid/omoc/events",
  upgradeWebSocket((c) => {
    const workspaceId = c.req.param("wid");

    return {
      onOpen(ws) {
        // Subscribe to workspace events
        ws.subscribe(`workspace:${workspaceId}:omoc`);
      },
      onMessage(ws, message) {
        // Handle incoming messages from clients
      },
      onClose(ws) {
        // Unsubscribe
        ws.unsubscribe(`workspace:${workspaceId}:omoc`);
      },
    };
  }),
);

export { websocket };
```

### 2.2 Event Ingestion from Workers

**File:** `apps/api/src/routes/internal.ts` (or create `apps/api/src/routes/omocInternal.ts`)

```typescript
import { Hono } from "hono";
import { db } from "@clawflint/db";

export const omocInternalRouter = new Hono();

// POST /internal/omoc/events - Workers send events here
omocInternalRouter.post("/internal/omoc/events", async (c) => {
  const event = await c.req.json();

  // 1. Validate worker credentials
  // 2. Store event in database
  // 3. Broadcast to WebSocket subscribers
  // 4. Update dashboard metrics

  return c.json({ ok: true });
});

// POST /internal/omoc/sessions - Workers report session state
omocInternalRouter.post("/internal/omoc/sessions", async (c) => {
  const session = await c.req.json();

  // 1. Validate worker
  // 2. Upsert session in database
  // 3. Update related stats

  return c.json({ ok: true });
});
```

---

## Phase 3: Worker Plugin Integration

### 3.1 Extend Worker Startup to Initialize OmOC

**File:** `apps/worker/src/index.ts` (or wherever worker starts)

```typescript
import { ConfigManager } from "@clawflint/omoc/core/config-manager";
import { OmocPlugin } from "@clawflint/omoc/plugin";

async function startWorker() {
  // Existing worker startup code...

  // Initialize OmOC plugin
  const configManager = new ConfigManager();
  await configManager.initialize();

  const omoc = new OmocPlugin({
    config: configManager.getConfig(),
  });

  // Register OmOC commands with OpenClaw
  registerOmocCommands(omoc);

  // Start event reporting to ClawFlint
  startEventReporting(omoc);
}

function registerOmocCommands(omoc: OmocPlugin) {
  // Register /loop, /run, /plan, etc. with OpenClaw
  // This depends on your OpenClaw plugin API
}

function startEventReporting(omoc: OmocPlugin) {
  // Subscribe to OmOC events and forward to ClawFlint API
  const eventEmitter = omoc.getEventEmitter();

  eventEmitter.on("*", (event) => {
    // Send to /internal/omoc/events
    reportEventToClawFlint(event);
  });
}
```

### 3.2 Add OmOC to Worker Dependencies

**File:** `apps/worker/package.json`

```json
{
  "dependencies": {
    "@clawflint/omoc": "^1.0.0"
  }
}
```

---

## Phase 4: Dashboard UI Components

### 4.1 Create Dashboard Components

**Files to create in your dashboard app:**

```
apps/dashboard/src/components/omoc/
├── SessionList.tsx          # List of all sessions
├── SessionDetail.tsx        # Individual session view
├── SessionStats.tsx         # Aggregate statistics
├── CostChart.tsx            # Cost tracking visualization
├── WorkerStatus.tsx         # Worker heartbeat display
├── LiveLog.tsx              # Real-time event log
└── TeamBuilder.tsx          # Configure agent teams
```

### 4.2 Example Component Structure

**File:** `apps/dashboard/src/components/omoc/SessionList.tsx`

```typescript
import { useEffect, useState } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'

export function SessionList({ workspaceId }: { workspaceId: string }) {
  const [sessions, setSessions] = useState([])
  const { lastMessage } = useWebSocket(`wss://api.clawflint.com/${workspaceId}/omoc/events`)

  useEffect(() => {
    // Fetch initial sessions
    fetch(`/api/${workspaceId}/omoc/sessions`)
      .then(r => r.json())
      .then(data => setSessions(data.sessions))
  }, [workspaceId])

  useEffect(() => {
    // Update on real-time events
    if (lastMessage) {
      const event = JSON.parse(lastMessage)
      updateSessionFromEvent(event)
    }
  }, [lastMessage])

  return (
    <div className="session-list">
      {sessions.map(session => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  )
}
```

---

## Phase 5: Configuration UI

### 5.1 Team Builder Page

**File:** `apps/dashboard/src/pages/TeamBuilder.tsx`

```typescript
export function TeamBuilder() {
  // UI for configuring:
  // - Which agents are enabled
  // - Model tiers per agent
  // - Default workflows
  // - Cost budgets
  // - Event routing channels

  const saveConfig = async (config: TeamConfiguration) => {
    await fetch(`/api/${workspaceId}/configs`, {
      method: "POST",
      body: JSON.stringify({
        name: "OmOC Team Config",
        openclawConfig: "", // OpenClaw-specific config
        systemPrompt: "", // System prompt
        envVars: {}, // Environment variables
        onboardConfig: {
          omoc: config, // OmOC-specific config
        },
      }),
    });
  };
}
```

---

## Phase 6: Cost Tracking & Billing

### 6.1 Cost Aggregation

**File:** `apps/api/src/lib/omocBilling.ts`

```typescript
export async function aggregateOmocCosts(
  workspaceId: string,
  startDate: Date,
  endDate: Date,
) {
  // Query omoc_sessions table
  // Aggregate by session, agent, model
  // Return cost breakdown for billing
}

export async function checkOmocBudget(workspaceId: string, sessionId: string) {
  // Check if session has exceeded budget
  // Alert if approaching limit
}
```

### 6.2 Billing Integration

**File:** `apps/api/src/routes/billing.ts` (extend existing)

Add OmOC costs to existing billing endpoints:

```typescript
// Extend existing billing aggregation
const omocCosts = await aggregateOmocCosts(workspaceId, startDate, endDate);
totalCosts += omocCosts.total;
```

---

## Implementation Priority

### Week 1: Core API

1. Create `omocSessions.ts` route with 4 endpoints
2. Add database schema for sessions/tasks
3. Test with OmOC plugin

### Week 2: Real-Time

1. Implement WebSocket endpoint
2. Create event ingestion API
3. Add event broadcasting

### Week 3: Worker Integration

1. Update worker to initialize OmOC
2. Add event reporting from worker
3. Test end-to-end flow

### Week 4: Dashboard UI

1. Build SessionList component
2. Add SessionDetail view
3. Create CostChart
4. Implement TeamBuilder

### Week 5: Polish

1. Add cost tracking
2. Budget alerts
3. Performance optimization
4. Documentation

---

## API Contract

### Expected from ClawFlint API

OmOC plugin expects these endpoints to exist:

```
GET  /:wid/omoc/sessions          # List sessions
GET  /:wid/omoc/sessions/:sid     # Get session details
GET  /:wid/omoc/stats             # Aggregate stats
POST /:wid/omoc/sessions/:sid/cancel  # Cancel session
WS   /:wid/omoc/events            # Real-time events

POST /internal/omoc/events        # Workers report events
POST /internal/omoc/sessions      # Workers report state
```

### Provided by OmOC

OmOC provides these for ClawFlint to use:

```typescript
// Dashboard types
import { DashboardSession, DashboardStats } from "@clawflint/omoc/dashboard";

// Event types
import { DashboardEvent, DashboardEventType } from "@clawflint/omoc/dashboard";

// Config management
import { ConfigManager } from "@clawflint/omoc/core/config-manager";

// Session monitoring
import { SessionMonitor } from "@clawflint/omoc/dashboard/monitor";
```

---

## Testing Checklist

- [ ] Can list OmOC sessions via API
- [ ] Can view session details with tasks
- [ ] Real-time events appear in dashboard
- [ ] Cancel command works via API
- [ ] Costs are tracked and aggregated
- [ ] Budget alerts trigger correctly
- [ ] Team configuration saves and loads
- [ ] Worker starts with OmOC initialized
- [ ] Events flow from OmOC → Worker → ClawFlint API → Dashboard

---

## Files Summary

### New Files to Create:

1. `apps/api/src/routes/omocSessions.ts` (150 lines)
2. `apps/api/src/routes/omocEvents.ts` (80 lines)
3. `apps/api/src/routes/omocInternal.ts` (100 lines)
4. `apps/api/src/lib/omocBilling.ts` (80 lines)
5. `@clawflint/db/schema/omoc.ts` (schema definitions)

### Files to Modify:

1. `apps/api/src/index.ts` - Register new routes
2. `apps/worker/src/index.ts` - Initialize OmOC
3. `apps/worker/package.json` - Add dependency
4. `apps/dashboard/src/App.tsx` - Add OmOC routes
5. Existing billing routes - Add OmOC costs

### Estimated Effort:

- Backend API: 2-3 days
- WebSocket/Events: 2 days
- Worker Integration: 1-2 days
- Dashboard UI: 3-4 days
- Testing/Polish: 2 days
- **Total: 2-3 weeks for full integration**

---

## Questions?

Refer to the OmOC repository for:

- Dashboard type definitions: `src/dashboard/types.ts`
- Event system: `src/events/emitter.ts`
- Config management: `src/core/config-manager.ts`
- Plugin manifest: `src/plugin/manifest.ts`
