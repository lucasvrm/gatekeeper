# Microplans: Pipeline Development Decomposition

> Decomposição completa do pipeline-plan.md em microplans atômicos (≤3 files cada).
> Cada microplan é independentemente validável e commitável.

---

## Infrastructure Already Available

Before decomposing, these services already exist and will be **reused** (not rebuilt):

| Service | What It Does | Where |
|---------|-------------|-------|
| `GatekeeperValidationBridge` | Creates validation runs, polls results, builds rejection reports | `services/GatekeeperValidationBridge.ts` |
| `OrchestratorEventService` | SSE events, batched persistence, pipeline state updates | `services/OrchestratorEventService.ts` |
| `AgentRunnerService` | Provider-agnostic agent loop, fallback, token budgets | `services/AgentRunnerService.ts` |
| `AgentToolExecutor` | Sandboxed tool execution (READ_TOOLS, WRITE_TOOLS) | `services/AgentToolExecutor.ts` |
| `AgentPromptAssembler` | DB-driven prompt assembly per step | `services/AgentPromptAssembler.ts` |
| `AgentOrchestratorBridge` | Plan→Spec→Fix→Execute with artifact persistence | `services/AgentOrchestratorBridge.ts` |
| `LLMProviderRegistry` | Multi-provider registry (anthropic, openai, mistral, claude-code, codex-cli) | `services/providers/LLMProviderRegistry.ts` |
| `PipelineState` model | DB snapshot of pipeline state (outputId, status, stage, progress) | `prisma/schema.prisma` |
| `PipelineEvent` model | Granular pipeline events for SSE replay | `prisma/schema.prisma` |

---

## Dependency Graph

```
MP01 ──→ MP02 ──→ MP03 ──→ MP04
                              │
                              ▼
         MP05 ──→ MP06 ──→ MP07 ──→ MP08
                              │
                              ▼
         MP09 ──→ MP10 ──→ MP11 ──→ MP12
                              │
                              ▼
                  MP13 ──→ MP14 ──→ MP15
                              │
                              ▼
                  MP16 ──→ MP17 ──→ MP18
                              │
                              ▼
                  MP19 ──→ MP20 ──→ MP21
                              │
                              ▼
                  MP22 ──→ MP23 ──→ MP24
                              │
                              ▼
                           MP25 ──→ MP26
```

---

## PHASE 1: PLANNING Run Type (Foundation)

Everything depends on this — the pipeline needs a way to validate plans without a test file.

### MP01: PLANNING run type — schema + config
**Files (2):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/api/schemas/validation.schema.ts` | Add `'PLANNING'` to `runType` z.enum (line 70) |
| MODIFY | `src/config/gates.config.ts` | Add `PLANNING_GATE_NUMBERS = [0]` + `PLANNING_EXTRA_VALIDATORS` array (after line 97) |

**Contract:**
- `runType: z.enum(['CONTRACT', 'EXECUTION', 'PLANNING'])` compiles
- `PLANNING_GATE_NUMBERS` exports `[0]`
- `PLANNING_EXTRA_VALIDATORS` exports `['MANIFEST_FILE_LOCK', 'NO_IMPLICIT_FILES']`

---

### MP02: PLANNING run type — orchestrator logic
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/services/ValidationOrchestrator.ts` | Handle `PLANNING` in `allowedGates` (line 165-167): run Gate 0 + selectively run MANIFEST_FILE_LOCK and NO_IMPLICIT_FILES from Gate 1 |

**Contract:**
- When `runType === 'PLANNING'`: runs Gate 0 validators + MANIFEST_FILE_LOCK + NO_IMPLICIT_FILES
- When `runType === 'PLANNING'`: skips all test-content validators (TEST_SYNTAX_VALID, TEST_HAS_ASSERTIONS, etc.)
- Existing CONTRACT and EXECUTION behavior unchanged

**Depends on:** MP01

---

### MP03: PLANNING run type — controller update
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/api/controllers/RunsController.ts` | Update `rerunGate` valid gates for PLANNING (line 226): allow rerun of gate 0 for PLANNING runs |

**Contract:**
- `rerunGate` accepts gate 0 for PLANNING runs
- `rerunGate` rejects gates 1-3 for PLANNING runs
- Existing CONTRACT/EXECUTION rerun behavior unchanged

**Depends on:** MP01

---

### MP04: PLANNING run type — tests
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/__tests__/PlanningRunType.spec.ts` | Test PLANNING run type: schema validation, gate selection, orchestrator behavior, controller rerun |

**Contract:**
- Test: PLANNING run creates with valid schema
- Test: PLANNING run executes only Gate 0 + extra validators
- Test: PLANNING run skips Gate 1 test-content validators
- Test: rerunGate accepts gate 0 for PLANNING
- Test: rerunGate rejects gate 1+ for PLANNING

**Depends on:** MP02, MP03

---

## PHASE 2: Pipeline Types & Schemas

Core type definitions that all pipeline services depend on.

### MP05: Pipeline types — core interfaces
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/types/pipeline.types.ts` | All pipeline interfaces: `PipelineRequest`, `PipelineConfig`, `MicroPlan`, `PlannerOutput`, `ManifestFile` (pipeline-specific) |

**Interfaces to define:**
```typescript
PipelineRequest {
  taskDescription: string
  projectId?: string
  projectPath: string
  taskType?: 'feature' | 'bugfix' | 'refactor'
  config?: Partial<PipelineConfig>
}

PipelineConfig {
  maxFilesPerPlan: number       // default: 3
  maxRetries: number            // default: 3
  parallelism: number           // default: 3
  skipIntegration: boolean      // default: false
  explorerTimeout: number       // default: 30000
  maxExplorers: number          // default: 5
}

MicroPlan {
  id: number
  name: string
  taskPrompt: string
  manifest: { files: ManifestFileEntry[]; testFile: string }
  contract: ContractInput
  dependsOn: number[]
}

PlannerOutput {
  microPlans: MicroPlan[]
  executionOrder: number[][]
}
```

**Contract:**
- All interfaces compile with strict TypeScript
- Imports from existing `gates.types.ts` for `ManifestFileEntry` and `ContractInput`
- Exported from `types/index.ts`

---

### MP06: Pipeline types — state + explorer interfaces
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/types/pipeline.types.ts` | Add state and explorer interfaces: `PipelineState`, `PlanState`, `ExplorerReport`, `FileInfo`, pipeline events |

**Interfaces to add:**
```typescript
PipelineRunState {
  id: string
  outputId: string
  status: PipelineStatus
  taskDescription: string
  config: PipelineConfig
  plans: PlanState[]
  integration?: { runId: string; status: string }
  createdAt: string
  updatedAt: string
}

type PipelineStatus = 'planning' | 'validating_plans' | 'spec_writing' |
  'validating_specs' | 'implementing' | 'validating_impl' |
  'integrating' | 'completed' | 'failed'

PlanState {
  id: number
  name: string
  status: PlanStatus
  manifest: ManifestInput
  contract: ContractInput
  dependsOn: number[]
  validation: {
    planning?: ValidationRef
    contract?: ValidationRef
    execution?: ValidationRef
  }
}

type PlanStatus = 'pending' | 'planning_validated' | 'spec_writing' |
  'spec_validated' | 'implementing' | 'impl_validated' | 'failed'

ValidationRef { runId: string; status: string; attempts: number }

ExplorerReport {
  scope: string
  summary: string
  files: FileInfo[]
  dependencies: string[]
  conventions: string[]
}

FileInfo {
  path: string
  exports: string[]
  imports: string[]
  lineCount: number
  type: 'types' | 'utils' | 'service' | 'component' | 'test' | 'config'
}
```

**Contract:**
- All interfaces compile
- No circular dependencies with existing types

**Depends on:** MP05

---

### MP07: Pipeline Zod schemas
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/api/schemas/pipeline.schema.ts` | Zod schemas for pipeline API: `StartPipelineSchema`, `GetPipelineSchema`, `RetryPlanSchema` |

**Contract:**
- `StartPipelineSchema` validates: taskDescription (min 10), projectPath (min 1), optional config overrides
- `GetPipelineSchema` validates: pipelineId (string, min 1)
- `RetryPlanSchema` validates: planId (number, min 0)
- All schemas compile and export

**Depends on:** MP06

---

### MP08: Pipeline types — tests
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/types/__tests__/pipeline.types.spec.ts` | Type compilation tests + Zod schema validation tests |

**Contract:**
- Test: all pipeline types compile (type-level test)
- Test: StartPipelineSchema rejects missing taskDescription
- Test: StartPipelineSchema rejects taskDescription < 10 chars
- Test: StartPipelineSchema accepts valid input with defaults
- Test: config defaults are applied correctly

**Depends on:** MP07

---

## PHASE 3: Explorer Service

Sub-agent system for read-only codebase exploration.

### MP09: Explorer system prompt
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `artifacts/devin/explorer-system.md` | System prompt for Explorer sub-agent: role, constraints (READ-ONLY, 30s timeout), output format (ExplorerReport JSON) |

**Contract:**
- Prompt defines role as read-only code explorer
- Specifies output format matching ExplorerReport interface
- Lists available tools: read_file, list_directory, search_code
- Specifies 30s timeout and max 2000 tokens output
- Includes examples of well-formed ExplorerReport

---

### MP10: ExplorerService — core
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/ExplorerService.ts` | Explorer spawning service: `explore()` method that runs a single Explorer agent with timeout, parses ExplorerReport from output |

**Implementation:**
- `ExplorerService` class
- Constructor: receives `LLMProviderRegistry`, `AgentToolExecutor`
- `explore(scope: string, question: string, projectRoot: string, config: ExplorerConfig): Promise<ExplorerReport>`
- Uses `AgentRunnerService.run()` with READ_TOOLS only
- Parses JSON ExplorerReport from agent text output
- Handles timeout via `PhaseConfig.maxIterations` + low maxTokens
- Returns structured `ExplorerReport`
- `exploreParallel(tasks: ExplorerTask[], projectRoot: string, config: ExplorerConfig): Promise<ExplorerReport[]>`
- Runs multiple explorers concurrently (up to config.parallelism)
- Aggregates reports

**Contract:**
- `explore()` returns valid ExplorerReport
- `explore()` respects timeout (returns partial report on timeout)
- `exploreParallel()` runs up to N explorers concurrently
- Uses existing `AgentRunnerService` (no new LLM infrastructure)
- READ_TOOLS only (no write access)

**Depends on:** MP06, MP09

---

### MP11: ExplorerService — tests
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/__tests__/ExplorerService.spec.ts` | Tests for ExplorerService: mocked LLM responses, timeout handling, JSON parsing, parallel execution |

**Contract:**
- Test: explore() returns ExplorerReport from valid JSON response
- Test: explore() handles malformed JSON gracefully
- Test: explore() uses only READ_TOOLS
- Test: exploreParallel() respects concurrency limit
- Test: exploreParallel() aggregates reports correctly

**Depends on:** MP10

---

## PHASE 4: Planner Service

Orchestrates explorers, produces micro-plans.

### MP12: Planner system prompt
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `artifacts/devin/planner-system.md` | System prompt for Planner agent: role, rules (≤3 files per plan, dependency ordering, no splitting types from consumers), output format (PlannerOutput JSON), available tools (spawn_explorer, save_artifact) |

**Contract:**
- Defines Planner role as decomposition architect
- Rules: ≤3 files per plan, respect dependency order, group related files
- Output format: JSON matching PlannerOutput interface
- Tool: spawn_explorer(scope, question) → triggers ExplorerService
- Tool: save_artifact(filename, content) → saves output
- Examples of well-formed MicroPlan arrays

---

### MP13: PlannerService — core
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/PlannerService.ts` | Planner agent service: spawns explorers, collects reports, runs Planner LLM, parses MicroPlan output, validates scope |

**Implementation:**
- `PlannerService` class
- Constructor: receives `ExplorerService`, `LLMProviderRegistry`, `AgentToolExecutor`
- `plan(request: PipelineRequest): Promise<PlannerOutput>`
  1. Determine explorer tasks from request (which directories to scan, what to look for)
  2. Run `ExplorerService.exploreParallel()` to gather context
  3. Build Planner user message with explorer reports + task description
  4. Run Planner agent via `AgentRunnerService.run()`
  5. Parse PlannerOutput JSON from agent response
  6. Validate each MicroPlan has ≤ config.maxFilesPerPlan files
  7. Validate no file appears in multiple micro-plans
  8. Return validated PlannerOutput
- Custom tool executor that intercepts `spawn_explorer` calls and delegates to ExplorerService

**Contract:**
- `plan()` returns valid PlannerOutput
- Each MicroPlan has ≤ maxFilesPerPlan files
- No file appears in multiple micro-plans
- dependsOn references are valid (no cycles, no missing IDs)
- executionOrder groups respect dependsOn constraints

**Depends on:** MP10, MP12

---

### MP14: PlannerService — tests
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/__tests__/PlannerService.spec.ts` | Tests for PlannerService: mocked explorers + LLM, validation, scope checks |

**Contract:**
- Test: plan() returns valid PlannerOutput
- Test: plan() rejects micro-plan with > maxFilesPerPlan files
- Test: plan() rejects duplicate files across plans
- Test: plan() validates dependsOn references
- Test: plan() spawns explorers with correct scope

**Depends on:** MP13

---

## PHASE 5: Spec Writer Service

Parallel spec (test file) generation.

### MP15: Spec Writer system prompt
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `artifacts/devin/spec-writer-system.md` | System prompt for Spec Writer: role, validator-aware rules (TDD red phase, assertions, happy/sad paths, @clause tags, resilient patterns), output (test file only) |

**Contract:**
- Defines Spec Writer role: create test file from plan + contract
- Rules reference specific validators the test must pass:
  - TEST_SYNTAX_VALID — must compile
  - TEST_HAS_ASSERTIONS — must have expect()/assert()
  - TEST_COVERS_HAPPY_AND_SAD_PATH — both success and failure scenarios
  - TEST_FAILS_BEFORE_IMPLEMENTATION — must fail on baseRef (TDD red phase)
  - NO_DECORATIVE_TESTS — no empty/trivial tests
  - TEST_RESILIENCE_CHECK — getByRole/getByText not querySelector (if UI)
  - TEST_CLAUSE_MAPPING_VALID — each it() tagged with @clause
- Output: ONLY the test file, nothing else
- Tools: read_file (to check existing code), save_artifact

---

### MP16: SpecWriterService — core
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/SpecWriterService.ts` | Spec Writer service: receives micro-plan + contract, runs Spec Writer agent, outputs test file |

**Implementation:**
- `SpecWriterService` class
- Constructor: receives `LLMProviderRegistry`, `AgentToolExecutor`
- `writeSpec(plan: MicroPlan, projectRoot: string): Promise<{ testFilePath: string; content: string }>`
  1. Build user message with plan.taskPrompt + plan.manifest + plan.contract
  2. Run Spec Writer agent via `AgentRunnerService.run()` with READ_TOOLS + SAVE_ARTIFACT_TOOL
  3. Extract test file from saved artifacts
  4. Return test file path and content
- `writeSpecsParallel(plans: MicroPlan[], projectRoot: string, concurrency: number): Promise<Map<number, { testFilePath: string; content: string }>>`
  - Runs multiple spec writers concurrently, respecting dependsOn

**Contract:**
- `writeSpec()` returns test file content
- `writeSpec()` uses only READ_TOOLS + SAVE_ARTIFACT_TOOL (no write to project)
- `writeSpecsParallel()` respects concurrency limit
- `writeSpecsParallel()` respects dependsOn ordering

**Depends on:** MP06, MP15

---

### MP17: SpecWriterService — tests
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/__tests__/SpecWriterService.spec.ts` | Tests for SpecWriterService: mocked LLM responses, artifact extraction, parallel execution |

**Contract:**
- Test: writeSpec() returns test file from saved artifact
- Test: writeSpec() handles missing artifact gracefully
- Test: writeSpecsParallel() runs concurrently up to limit
- Test: writeSpecsParallel() respects dependency ordering

**Depends on:** MP16

---

## PHASE 6: Validation Client (Pipeline-specific)

Extends existing GatekeeperValidationBridge for pipeline-specific flows.

### MP18: PipelineValidationService
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/PipelineValidationService.ts` | Pipeline-specific validation client that wraps `GatekeeperValidationBridge` with PLANNING/CONTRACT/EXECUTION workflows and retry logic |

**Implementation:**
- `PipelineValidationService` class
- Constructor: receives `GatekeeperValidationBridge`
- `validatePlan(plan: MicroPlan, projectPath: string): Promise<PipelineValidationResult>`
  - Creates PLANNING run via bridge
  - Returns structured result
- `validateSpec(plan: MicroPlan, testFilePath: string, projectPath: string): Promise<PipelineValidationResult>`
  - Creates CONTRACT run via bridge
  - Uploads spec file
  - Returns structured result
- `validateImplementation(plan: MicroPlan, contractRunId: string, projectPath: string): Promise<PipelineValidationResult>`
  - Creates EXECUTION run via bridge
  - Returns structured result
- `validateIntegration(allPlans: MicroPlan[], projectPath: string): Promise<PipelineValidationResult>`
  - Creates EXECUTION run with merged manifest
  - Returns structured result

**Contract:**
- Each method creates the correct runType
- Each method returns structured PipelineValidationResult
- Reuses existing GatekeeperValidationBridge (no duplicated HTTP/DB logic)

**Depends on:** MP04, MP06

---

### MP19: PipelineValidationService — tests
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/__tests__/PipelineValidationService.spec.ts` | Tests for PipelineValidationService: correct runType per method, result parsing |

**Contract:**
- Test: validatePlan() creates PLANNING run
- Test: validateSpec() creates CONTRACT run
- Test: validateImplementation() creates EXECUTION run with contractRunId
- Test: validateIntegration() creates EXECUTION run with merged manifest

**Depends on:** MP18

---

## PHASE 7: Parallel Executor

Generic concurrency management for parallel agent execution.

### MP20: ParallelExecutor
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/ParallelExecutor.ts` | Generic parallel execution with concurrency limit and dependency ordering |

**Implementation:**
- `ParallelExecutor` class
- `execute<T>(tasks: ParallelTask<T>[], concurrency: number): Promise<Map<number, T>>`
  - `ParallelTask<T> { id: number; dependsOn: number[]; fn: () => Promise<T> }`
  - Respects dependency order: task only starts when all dependsOn tasks complete
  - Limits concurrent execution to `concurrency`
  - Returns results mapped by task ID
  - On task failure: marks dependents as skipped, continues others
- Uses Promise-based semaphore (no external dependencies)

**Contract:**
- Tasks execute in dependency order
- Concurrency limit is respected
- Failed task marks dependents as failed/skipped
- Independent tasks run in parallel
- Returns all results (success + failure)

**Depends on:** none (utility)

---

### MP21: ParallelExecutor — tests
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/__tests__/ParallelExecutor.spec.ts` | Tests for ParallelExecutor: concurrency, dependencies, failure propagation |

**Contract:**
- Test: respects concurrency limit (never exceeds N concurrent)
- Test: dependency order (B depends on A → B starts after A completes)
- Test: failure propagation (A fails → B skipped if B depends on A)
- Test: independent tasks run in parallel
- Test: handles empty task list

**Depends on:** MP20

---

## PHASE 8: Pipeline Orchestrator

The central service tying everything together.

### MP22: PipelineOrchestrator — core + planning stage
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/PipelineOrchestrator.ts` | Core orchestrator: constructor, `startPipeline()`, state management, planning stage (Planner + PLANNING validation) |

**Implementation:**
- `PipelineOrchestrator` class
- Constructor: receives all services (PlannerService, SpecWriterService, PipelineValidationService, ParallelExecutor, OrchestratorEventService)
- `startPipeline(request: PipelineRequest): Promise<PipelineRunState>`
  1. Generate outputId
  2. Initialize PipelineRunState with status='planning'
  3. Call `PlannerService.plan()` to get micro-plans
  4. Call `PipelineValidationService.validatePlan()` for each micro-plan
  5. Handle failures: retry up to maxRetries, feed rejection to Planner
  6. Update state to 'validating_plans' → 'spec_writing'
  7. Emit events via OrchestratorEventService
- State transitions and persistence (updates PipelineState in DB via OrchestratorEventService)

**Contract:**
- `startPipeline()` runs planning + validation stages
- Failed plans are retried up to maxRetries
- State transitions emit events
- Pipeline state is persisted to DB

**Depends on:** MP13, MP18, MP20

---

### MP23: PipelineOrchestrator — spec + implementation stages
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/services/PipelineOrchestrator.ts` | Add spec writing stage (parallel SpecWriters + CONTRACT validation) and implementation stage (parallel Coders + EXECUTION validation) |

**Implementation additions:**
- `private executeSpecStage(state: PipelineRunState): Promise<void>`
  1. Use ParallelExecutor to run SpecWriterService.writeSpecsParallel()
  2. For each spec: call PipelineValidationService.validateSpec()
  3. On failure: use existing fixArtifacts() infrastructure (via AgentOrchestratorBridge)
  4. Retry up to maxRetries
  5. Update plan states to 'spec_validated'
- `private executeImplementationStage(state: PipelineRunState): Promise<void>`
  1. Use ParallelExecutor to run Coder agents (via AgentRunnerService)
  2. Coder uses existing micro-task executor prompt (system.md)
  3. For each implementation: call PipelineValidationService.validateImplementation()
  4. On failure: feed rejection to Coder for fix
  5. Retry up to maxRetries
  6. Update plan states to 'impl_validated'

**Contract:**
- Spec stage runs parallel SpecWriters respecting dependsOn
- Spec stage validates each spec with CONTRACT run
- Implementation stage runs parallel Coders respecting dependsOn
- Implementation stage validates with EXECUTION run
- Failed specs/implementations are retried with fix loop

**Depends on:** MP22, MP16

---

### MP24: PipelineOrchestrator — integration + abort/retry
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/services/PipelineOrchestrator.ts` | Add integration stage (final EXECUTION run with full manifest) and abort/retry functionality |

**Implementation additions:**
- `private executeIntegrationStage(state: PipelineRunState): Promise<void>`
  1. Merge all manifests into one
  2. Call PipelineValidationService.validateIntegration()
  3. Gate 3: FULL_REGRESSION_PASS + PRODUCTION_BUILD_PASS
  4. On failure: identify which chunk broke integration
  5. Update state to 'completed' or 'failed'
- `abort(pipelineId: string): Promise<void>`
  - Sets state to 'failed', cancels pending tasks
- `retryPlan(pipelineId: string, planId: number): Promise<void>`
  - Re-runs a specific failed plan from its last successful stage

**Contract:**
- Integration runs EXECUTION validation with merged manifest
- Integration failure identifies problematic chunk
- abort() stops pipeline and sets state to 'failed'
- retryPlan() resumes from last successful stage

**Depends on:** MP23

---

### MP25: PipelineOrchestrator — tests
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/__tests__/PipelineOrchestrator.spec.ts` | Tests for PipelineOrchestrator: state transitions, stage execution, retry, abort |

**Contract:**
- Test: startPipeline() transitions through planning → spec_writing → implementing → completed
- Test: failed planning validation triggers retry
- Test: exceeded maxRetries sets status to 'failed'
- Test: abort() stops pipeline
- Test: retryPlan() resumes from correct stage
- Test: parallel execution respects dependsOn

**Depends on:** MP24

---

## PHASE 9: Pipeline API

HTTP routes and controller for pipeline management.

### MP26: Pipeline routes + controller — start, get state, list plans
**Files (2):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/api/routes/pipeline.routes.ts` | Routes: POST /start, GET /:id, GET /:id/plans, GET /:id/plans/:planId |
| CREATE | `src/api/controllers/PipelineController.ts` | Handlers: startPipeline, getState, getPlans, getPlanDetails |

**Contract:**
- POST /pipeline/start → 202 with pipelineId + eventsUrl
- GET /pipeline/:id → pipeline state
- GET /pipeline/:id/plans → list of plan states
- GET /pipeline/:id/plans/:planId → single plan state with validation details

**Depends on:** MP24, MP07

---

### MP27: Pipeline routes — SSE, abort, retry
**Files (2):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/api/routes/pipeline.routes.ts` | Add routes: GET /:id/events (SSE), POST /:id/abort, POST /:id/retry/:planId |
| MODIFY | `src/api/controllers/PipelineController.ts` | Add handlers: streamEvents (SSE), abort, retryPlan |

**Contract:**
- GET /pipeline/:id/events → SSE stream of pipeline events
- POST /pipeline/:id/abort → stops pipeline, returns updated state
- POST /pipeline/:id/retry/:planId → retries failed plan, returns updated state
- SSE uses existing OrchestratorEventService infrastructure

**Depends on:** MP26

---

### MP28: Register pipeline routes
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/api/routes/index.ts` | Import pipeline routes, mount on `/pipeline` path |

**Contract:**
- `router.use('/pipeline', pipelineRoutes)` added
- Import added at top of file
- Existing routes unchanged

**Depends on:** MP27

---

### MP29: Pipeline API — tests
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/api/controllers/__tests__/PipelineController.spec.ts` | Integration tests for pipeline API endpoints |

**Contract:**
- Test: POST /pipeline/start returns 202 with pipelineId
- Test: POST /pipeline/start rejects invalid input (Zod validation)
- Test: GET /pipeline/:id returns pipeline state
- Test: GET /pipeline/:id/plans returns plan list
- Test: POST /pipeline/:id/abort returns updated state

**Depends on:** MP28

---

## PHASE 10: End-to-End Integration

### MP30: End-to-end integration test
**Files (1):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/services/__tests__/PipelineIntegration.spec.ts` | End-to-end test: start pipeline → planning → spec writing → implementation → integration |

**Contract:**
- Test: full pipeline runs to completion with mocked LLM + mocked Gatekeeper
- Test: pipeline handles partial failures and retries
- Test: pipeline state is correct at each stage transition

**Depends on:** MP25, MP29

---

## Summary

| Phase | Microplans | Files Created | Files Modified | Description |
|-------|-----------|---------------|----------------|-------------|
| 1. PLANNING Run Type | MP01-MP04 | 1 | 4 | Foundation: new run type for plan validation |
| 2. Pipeline Types | MP05-MP08 | 3 | 1 | Type definitions + Zod schemas |
| 3. Explorer Service | MP09-MP11 | 3 | 0 | Read-only sub-agent exploration |
| 4. Planner Service | MP12-MP14 | 3 | 0 | Decomposition into micro-plans |
| 5. Spec Writer | MP15-MP17 | 3 | 0 | Parallel test generation |
| 6. Validation Client | MP18-MP19 | 2 | 0 | Pipeline-specific Gatekeeper wrapper |
| 7. Parallel Executor | MP20-MP21 | 2 | 0 | Concurrency + dependency management |
| 8. Pipeline Orchestrator | MP22-MP25 | 2 | 1* | Central state machine + stages |
| 9. Pipeline API | MP26-MP29 | 3 | 1 | HTTP routes + controller |
| 10. E2E Integration | MP30 | 1 | 0 | End-to-end integration test |
| **TOTAL** | **30** | **23** | **7** | |

*MP22 creates, MP23-MP24 modify the same file.

### Execution Time Estimate

| Phase | Microplans | Estimate |
|-------|-----------|----------|
| Phase 1 | 4 | 1-2 days |
| Phase 2 | 4 | 1 day |
| Phase 3 | 3 | 2-3 days |
| Phase 4 | 3 | 2-3 days |
| Phase 5 | 3 | 1-2 days |
| Phase 6 | 2 | 1 day |
| Phase 7 | 2 | 1 day |
| Phase 8 | 4 | 3-4 days |
| Phase 9 | 4 | 2-3 days |
| Phase 10 | 1 | 1 day |
| **Total** | **30** | **~15-22 days** |

### Critical Path

```
MP01 → MP02 → MP04 → MP18 → MP22 → MP23 → MP24 → MP26 → MP28 → MP30
                 ↑                ↑
            MP05 → MP06      MP10 → MP13
                                ↑
                           MP16 → MP20
```

The critical path runs through: PLANNING run type → Pipeline types → Explorer → Planner → Orchestrator → API → Integration.

Parallel work is possible:
- MP05-MP08 (types) can start alongside MP01-MP04 (PLANNING run type)
- MP09-MP11 (Explorer) can start alongside MP15-MP17 (Spec Writer) once types are done
- MP20-MP21 (ParallelExecutor) has no dependencies and can start anytime
