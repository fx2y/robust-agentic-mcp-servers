# AgenticMCP_Server_V2.1_Consolidated

This document provides tactical guidance for developing the `AgenticMCP_Server_V2.1`. Adhere strictly to these patterns and interfaces.

## 1. Core Tactical Principles

*   **Tool Purity:** Tools are pure, stateless functions. They receive arguments and return a result. They **never** modify external state or context directly.
*   **State Mediation:** The `WorkflowManager` and `PlanExecutor` are the *only* components that interact with the `IStateStore`. They read state, pass it to executors, and write the results back.
*   **Unified IR:** All workflows are defined as `AgenticPlan` JSON/YAML structures. Simple "prompts" are just named `AgenticPlan`s. There is no separate `PromptDefinition`.
*   **Deconstructed State:** Session state is not a single document. It's composed of `SessionCore` (fast KV), `HistoryEntry` (append-only log), and `SessionContext` (KV store). Large data objects are stored in a blob store (e.g., S3) with URIs in the context.
*   **Event-Driven Correction:** Failures are not handled with `try/catch` inside the executor. The executor pauses the workflow, sets status to `paused_on_error`, and emits an event. The `Supervisor` service listens for these events to trigger a correction plan.
*   **Secure Execution:** Arbitrary code execution (`execute_python_code`) is **never** run in-process. It is delegated via RPC to a separate, sandboxed microservice (`ISandboxService`).
*   **Dependency Injection:** All services (`*Manager`, `*Executor`, `*Registry`) are classes that receive their dependencies (like `IStateStore`, `ICapabilityRegistry`) in their constructor. The main `server.ts` file is responsible for wiring everything together.

## 2. Directory Structure

```
src/
├── api/                  # Express/Fastify routes and controllers
│   ├── index.ts
│   └── session.routes.ts
├── capabilities/         # All user-facing capabilities
│   ├── plans/            # AgenticPlan definitions (.json)
│   │   └── quick-data/
│   │       ├── correlation_investigation.plan.json
│   │       └── find_data_sources.plan.json
│   └── tools/            # PureTool implementations (.ts)
│       └── quick-data/
│           ├── load_dataset.tool.ts
│           └── execute_python_code.tool.ts
├── core/                 # Core interfaces and implementations
│   ├── agentic-plan.ts   # AgenticPlan IR interfaces
│   ├── capability-registry.ts # ICapabilityRegistry impl
│   ├── plan-executor.ts  # IPlanExecutor impl
│   ├── state-store.ts    # IStateStore interface and impls (in-memory, redis)
│   ├── tool-executor.ts  # IToolExecutor impl
│   └── workflow-manager.ts # IWorkflowManager impl
├── services/             # Background services and external integrations
│   ├── sandbox.service.ts # ISandboxService interface/client
│   └── supervisor.service.ts # ISupervisorService impl
├── shared/               # Shared types, utils, config
│   ├── config.ts         # Configuration loader (dotenv, etc.)
│   ├── logger.ts         # Structured logger (pino) setup
│   └── types.ts          # Common types (e.g., SessionCore, HistoryEntry)
└── server.ts             # Main application entrypoint
```

## 3. Key Data Models & Interfaces

### 3.1. Tool Definition

*File: `src/core/tool-executor.ts`*
A tool is a definition (`ToolDefinition`) and a pure function (`PureToolImplementation`).

```typescript
import { JSONSchema7 } from 'json-schema';

export interface ToolDefinition {
  id: string; // "quick-data::load_dataset"
  description: string;
  parameters: JSONSchema7;
  outputSchema: JSONSchema7;
}
export type PureToolImplementation = (args: any) => Promise<any>;
```

### 3.2. Agentic Plan IR

*File: `src/core/agentic-plan.ts`*
The single source of truth for all workflows. It's a graph of `PlanStep`s.

```typescript
export interface ContextValuePointer {
  jsonPath: string; // '$.context.dataset.columns' or '$.history[?(@.planStepId=="step1")].result.output'
}

export type PlanStep =
  | { type: 'tool_call'; toolId: string; arguments: { [key: string]: any | ContextValuePointer }; ... }
  | { type: 'conditional_branch'; condition: { left: any, operator: string, right: any }; onTrue: { nextStepId: string }; onFalse: { nextStepId: string }; ... }
  | { type: 'parallel_branch'; branches: { steps: PlanStep[] }[]; nextStepId: string; ... }
  | { type: 'loop_over_items'; collectionPath: ContextValuePointer; itemAlias: string; loopPlan: PlanStep[]; nextStepId: string; ... }
  | { type: 'human_in_the_loop'; message: string; nextStepIdOnInput: string; ... }
  | { type: 'final_response'; message: string | ContextValuePointer; ... };

export interface AgenticPlan {
  planId: string;
  description: string;
  parameters: JSONSchema7; // Inputs for the whole plan
  startStepId: string;
  steps: PlanStep[];
}
```

### 3.3. Durable State

*File: `src/shared/types.ts`*
The deconstructed state model.

```typescript
export interface SessionCore {
  sessionId: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'paused_on_error' | 'paused_on_human';
  createdAt: string;
  updatedAt: string;
  currentPlanId?: string;
  currentStepId?: string;
  lastError?: any;
}

export interface HistoryEntry {
  timestamp: string;
  toolId: string;
  request: any;
  result: any;
  planStepId?: string;
}

// SessionContext is Record<string, any> managed by IStateStore
```

### 3.4. Core Service Contracts

```typescript
// src/core/state-store.ts
export interface IStateStore {
  createSession(core: SessionCore): Promise<void>;
  readSessionCore(sessionId: string): Promise<SessionCore | null>;
  updateSessionStatus(sessionId: string, status: SessionCore['status'], error?: any): Promise<void>;
  appendToHistory(sessionId: string, entry: HistoryEntry): Promise<void>;
  getContext(sessionId: string): Promise<Record<string, any>>;
  updateContext(sessionId: string, updates: Record<string, any>): Promise<void>; // Atomic partial update
  // ... blob storage methods
}

// src/core/plan-executor.ts
export interface IPlanExecutor {
  execute(sessionId: string, plan: AgenticPlan): Promise<SessionCore>;
  resume(sessionId: string, input?: Record<string, any>): Promise<SessionCore>;
}

// src/services/sandbox.service.ts
export interface ISandboxService {
  execute(request: { language: string, code: string, inputs?: any }): Promise<{ status: string, stdout?: string, stderr?: string, returnValue?: any }>;
}
```

## 4. Development Workflow

### 4.1. Adding a New Tool

1.  Create `src/capabilities/tools/<domain>/<tool_name>.tool.ts`.
2.  Export a `ToolDefinition` constant named `definition`.
3.  Export a `PureToolImplementation` async function named `implementation`.
4.  The implementation must not have side effects. It takes `args` and returns a JSON-serializable object.
5.  The `server.ts` startup script will auto-discover and register it.
6.  Write a unit test for the pure implementation function in a corresponding `*.test.ts` file.

**Example: `load_dataset.tool.ts`**
```typescript
// implementation:
export const implementation: PureToolImplementation = async (args) => {
  const fileContent = fs.readFileSync(args.filePath, 'utf-8');
  const data = JSON.parse(fileContent);
  // Return data, let the WorkflowManager handle saving it to context.
  return { datasetName: args.datasetName, data: data, columns: Object.keys(data[0]) };
};
```

### 4.2. Adding a New Plan

1.  Create `src/capabilities/plans/<domain>/<plan_name>.plan.json`.
2.  Define the `AgenticPlan` structure in this JSON file.
3.  Use `ContextValuePointer` (`{"jsonPath": "..."}`) to reference data from context or previous steps.
    *   `$.context.someKey`: Access the session context.
    *   `$.history[0].result.output`: Access the most recent tool output.
    *   `$.promptInput.someParam`: Access the initial parameters passed to the plan.
4.  The `server.ts` startup script will auto-discover and register it.
5.  Write an integration test that executes the plan via the API and asserts the final state.

### 4.3. Logging

Use the structured logger available via dependency injection. Always include context.

```typescript
// In a service constructor
constructor(private logger: pino.Logger) {}

// In a method
this.logger.info({ sessionId, planId, stepId }, "Executing tool call step");
```

### 4.4. Testing

*   **Unit Tests (`*.test.ts`):** Use `jest`. Test pure functions and individual service methods in isolation. Mock all dependencies (e.g., mock `IStateStore` when testing `WorkflowManager`).
*   **Integration Tests (`*.spec.ts`):** Use `jest` and `supertest`. Test the full API flow. Spin up an in-memory version of the server. Test that a `POST /sessions/{id}/execute-plan` with a complex plan results in the correct final `SessionCore` status and `SessionContext`.