# Pipeline Plan: Gatekeeper-Validated Development Pipeline

## 1. Architecture Overview

### Current State

The codebase has two orchestration layers:

1. **`gatekeeper-orchestrator`** — LLM-based pipeline (Step 1→2→fix→4) with human-in-the-loop
2. **`AgentRunnerController`** — 3-phase agent runner (Planner→Spec→Coder) with LLM provider abstraction

Both are sequential and single-task. The new pipeline adds:
- **Sub-agent exploration** for the Planner (Claude Code pattern)
- **Recursive micro-plan generation** (≤3 files per plan)
- **Parallel fan-out** for Spec Writers and Coders
- **Automated Gatekeeper validation** between every phase transition

### Target Architecture

```
User Request
    │
    ▼
┌─────────────────────────────────────────────┐
│  PLANNER (orchestrator agent)               │
│                                             │
│  Spawns sub-agents in parallel:             │
│  ├── Explorer 1: read src/domain/           │
│  ├── Explorer 2: read src/services/         │
│  ├── Explorer 3: analyze dependency graph   │
│  └── Explorer 4: read existing tests        │
│                                             │
│  Receives structured reports                │
│  Outputs: N micro-plans (≤3 files each)     │
│  + contract.md per micro-plan               │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  GATEKEEPER — PLANNING VALIDATION           │
│  Gate 0 only (SANITIZATION)                 │
│  Per micro-plan:                            │
│  • TASK_SCOPE_SIZE ≤ 3                      │
│  • TOKEN_BUDGET_FIT                         │
│  • TASK_CLARITY_CHECK                       │
│  • SENSITIVE_FILES_LOCK                     │
│  • MANIFEST_FILE_LOCK (structure only)      │
│  • DELETE_DEPENDENCY_CHECK                  │
│                                             │
│  FAIL → feedback to Planner (max 3 retries) │
│  PASS → proceed to Spec Writing             │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  SPEC WRITERS (parallel, 1 per micro-plan)  │
│                                             │
│  Input: micro-plan + contract               │
│  Output: spec.test file only                │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  GATEKEEPER — CONTRACT VALIDATION           │
│  Gates 0 + 1 (full CONTRACT run)            │
│  Per micro-plan:                            │
│  • All Gate 0 validators                    │
│  • TEST_SYNTAX_VALID                        │
│  • TEST_HAS_ASSERTIONS                      │
│  • TEST_COVERS_HAPPY_AND_SAD_PATH           │
│  • TEST_FAILS_BEFORE_IMPLEMENTATION         │
│  • NO_DECORATIVE_TESTS                      │
│  • TEST_RESILIENCE_CHECK                    │
│  • IMPORT_REALITY_CHECK                     │
│  • TEST_INTENT_ALIGNMENT (soft)             │
│  • TEST_CLAUSE_MAPPING_VALID                │
│                                             │
│  FAIL → fixArtifacts() loop (max 3 retries) │
│  PASS → proceed to Coding                   │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  CODERS (parallel, 1 per micro-plan)        │
│                                             │
│  Uses: Micro-Task Executor prompt           │
│  Input: micro-plan + contract + spec.test   │
│  Output: implemented files                  │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  GATEKEEPER — EXECUTION VALIDATION          │
│  Gates 2 + 3 (full EXECUTION run)           │
│  Per micro-plan:                            │
│  • DIFF_SCOPE_ENFORCEMENT                   │
│  • TEST_READ_ONLY_ENFORCEMENT               │
│  • UI_COMPONENT_REGISTRY (if UI)            │
│  • UI_PROPS_COMPLIANCE (if UI)              │
│  • TASK_TEST_PASSES                         │
│  • STRICT_COMPILATION                       │
│  • STYLE_CONSISTENCY_LINT                   │
│  • FULL_REGRESSION_PASS                     │
│  • PRODUCTION_BUILD_PASS                    │
│                                             │
│  FAIL → Coder fix loop (max 3 retries)      │
│  PASS → merge chunk                         │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  INTEGRATION                                │
│  Final EXECUTION run (full manifest)        │
│  Gate 3: FULL_REGRESSION + PRODUCTION_BUILD │
└─────────────────────────────────────────────┘
```

---

## 2. Pipeline Stages (Detailed)

### Stage 0: Input Parsing

**Input**: User's natural-language task description
**Output**: Structured `PipelineRequest`

```typescript
interface PipelineRequest {
  taskDescription: string
  projectId: string
  projectPath: string
  taskType?: 'feature' | 'bugfix' | 'refactor'
  config?: {
    maxFilesPerPlan: number       // default: 3
    maxRetries: number            // default: 3
    parallelism: number           // default: 3 (max concurrent agents)
    skipIntegration: boolean      // default: false
  }
}
```

### Stage 1: Planning with Sub-Agents

**Agent**: Planner
**Model**: High-capability (claude-sonnet/opus)

#### Sub-Agent Pattern

The Planner doesn't read code directly. It spawns lightweight exploration sub-agents:

```
Planner
├── spawn(Explorer, "List all files in src/ with their exports")
├── spawn(Explorer, "Analyze import graph for src/domain/")
├── spawn(Explorer, "Read test conventions from existing tests")
└── spawn(Explorer, "Read package.json dependencies")
```

Each Explorer:
- Has READ-ONLY tools (Read, Glob, Grep)
- Has a focused scope (1 directory, 1 concern)
- Returns a structured report (max 2000 tokens)
- Has a hard timeout (30s)

#### Sub-Agent Report Format

```typescript
interface ExplorerReport {
  scope: string          // what was explored
  summary: string        // 1-paragraph overview
  files: FileInfo[]      // relevant files found
  dependencies: string[] // import relationships
  conventions: string[]  // patterns detected
}

interface FileInfo {
  path: string
  exports: string[]      // exported symbols
  imports: string[]      // import sources
  lineCount: number
  type: 'types' | 'utils' | 'service' | 'component' | 'test' | 'config'
}
```

#### Planner Output

After receiving all Explorer reports, the Planner produces:

```typescript
interface PlannerOutput {
  microPlans: MicroPlan[]
  executionOrder: number[][] // groups of micro-plan IDs that can run in parallel
}

interface MicroPlan {
  id: number
  name: string
  taskPrompt: string        // ≥10 chars, specific instruction for this micro-plan
  manifest: {
    files: ManifestFile[]   // ≤3 files
    testFile: string        // planned test file path
  }
  contract: Contract        // clauses for this micro-plan
  dependsOn: number[]       // IDs of micro-plans that must complete first
}
```

#### Why No Replanner

The Planner already has enough context from sub-agents to decompose correctly. Benefits:
- **No wasted cycles**: plan→reject→replan loop eliminated
- **Real context**: dependency graph known before planning
- **Clean memory**: sub-agents absorb file contents, Planner only sees summaries
- **Better decomposition**: import graph informs which files should be grouped

### Stage 2: Planning Validation

**Run Type**: `PLANNING` (new — Gate 0 only)

For each micro-plan, create a Gatekeeper validation run:

```bash
POST /api/runs
{
  "projectId": "{{PROJECT_ID}}",
  "outputId": "{{OUTPUT_ID}}_plan_{{PLAN_ID}}",
  "taskPrompt": "{{MICRO_PLAN.taskPrompt}}",
  "manifest": {
    "files": [...],
    "testFile": "{{MICRO_PLAN.manifest.testFile}}"
  },
  "contract": { ... },
  "runType": "PLANNING"    // NEW: only runs Gate 0
}
```

#### Validators Active at This Stage

| Validator | Gate | Active | Rationale |
|-----------|------|--------|-----------|
| TOKEN_BUDGET_FIT | 0 | YES | Context must fit LLM window |
| TASK_SCOPE_SIZE | 0 | YES | ≤3 files enforced |
| TASK_CLARITY_CHECK | 0 | YES | No ambiguous terms |
| SENSITIVE_FILES_LOCK | 0 | YES | Block sensitive files |
| DANGER_MODE_EXPLICIT | 0 | YES | Validate danger mode |
| PATH_CONVENTION | 0 | SKIP | No test file exists yet |
| DELETE_DEPENDENCY_CHECK | 0 | YES | Validate delete impact |
| MANIFEST_FILE_LOCK | 1* | YES | Validate manifest structure |
| NO_IMPLICIT_FILES | 1* | YES | No vague references |
| All other Gate 1 | 1 | SKIP | Test file doesn't exist yet |

*MANIFEST_FILE_LOCK and NO_IMPLICIT_FILES run even in PLANNING mode because they validate the plan, not the test.

#### On Failure

If a micro-plan fails validation:
1. Gatekeeper returns failed validator codes + messages
2. Orchestrator feeds rejection report back to Planner
3. Planner regenerates only the failed micro-plans
4. Max 3 retries per micro-plan; after that, escalate to user

### Stage 3: Spec Writing (Parallel)

**Agent**: Spec Writer (1 per micro-plan)
**Model**: Mid-capability (claude-sonnet)

Each Spec Writer receives:
- `microPlan.taskPrompt`
- `microPlan.manifest`
- `microPlan.contract`
- Reference to project codebase (READ-ONLY tools)

Each Spec Writer outputs:
- **Only the test file** (`spec.test.ts`)
- Written to `artifacts/{{OUTPUT_ID}}/{{PLAN_ID}}/spec.test.ts`

Parallelism: Up to `config.parallelism` Spec Writers run concurrently. Micro-plans with `dependsOn` wait for their dependencies.

### Stage 4: Contract Validation

**Run Type**: `CONTRACT` (existing — Gates 0 + 1)

For each micro-plan, after spec is written:

```bash
POST /api/runs
{
  "projectId": "{{PROJECT_ID}}",
  "outputId": "{{OUTPUT_ID}}_spec_{{PLAN_ID}}",
  "taskPrompt": "{{MICRO_PLAN.taskPrompt}}",
  "manifest": {
    "files": [...],
    "testFile": "{{SPEC_FILE_PATH}}"
  },
  "contract": { ... },
  "runType": "CONTRACT"
}
```

Then upload the spec file:

```bash
PUT /api/runs/{{RUN_ID}}/files
Content-Type: multipart/form-data
- planJson: plan.json
- specFile: spec.test.ts
```

#### Validators Active at This Stage

ALL 18 Gate 0 + Gate 1 validators run. Key ones:

| Validator | What It Checks |
|-----------|---------------|
| TEST_SYNTAX_VALID | Spec compiles |
| TEST_HAS_ASSERTIONS | Spec has expect()/assert() |
| TEST_COVERS_HAPPY_AND_SAD_PATH | Both success and failure scenarios |
| TEST_FAILS_BEFORE_IMPLEMENTATION | **CLÁUSULA PÉTREA** — test must fail on baseRef (TDD red phase) |
| NO_DECORATIVE_TESTS | No empty/trivial tests |
| TEST_RESILIENCE_CHECK | Resilient patterns (getByRole, not querySelector) |
| IMPORT_REALITY_CHECK | All imports resolve |
| TEST_INTENT_ALIGNMENT | Test aligns with taskPrompt (soft-block, ≥30% overlap) |
| TEST_CLAUSE_MAPPING_VALID | Each it() tagged with @clause |

#### On Failure

1. Orchestrator calls existing `fixArtifacts()` endpoint with rejection report
2. LLM corrects the spec based on validator feedback
3. Re-submit to Gatekeeper
4. Max 3 retries; then escalate

### Stage 5: Implementation (Parallel)

**Agent**: Coder (1 per micro-plan)
**Model**: Mid-capability (claude-sonnet)
**System Prompt**: `artifacts/devin/system.md` (Micro-Task Executor)

Each Coder receives:
- `microPlan.taskPrompt` + `microPlan.manifest`
- `microPlan.contract`
- The approved spec.test file
- WRITE tools enabled

The Coder follows the Micro-Task Executor workflow:
1. Read dependencies (max 5 files)
2. Implement (max 2 files per step within the micro-plan)
3. Commit after each step

### Stage 6: Execution Validation

**Run Type**: `EXECUTION` (existing — Gates 2 + 3)

For each micro-plan, after implementation:

```bash
POST /api/runs
{
  "projectId": "{{PROJECT_ID}}",
  "outputId": "{{OUTPUT_ID}}_exec_{{PLAN_ID}}",
  "taskPrompt": "{{MICRO_PLAN.taskPrompt}}",
  "manifest": { ... },
  "runType": "EXECUTION",
  "contractRunId": "{{CONTRACT_RUN_ID_THAT_PASSED}}"
}
```

#### Validators Active at This Stage

ALL 9 Gate 2 + Gate 3 validators run:

| Validator | What It Checks |
|-----------|---------------|
| DIFF_SCOPE_ENFORCEMENT | Only manifest files changed, all manifest files implemented |
| TEST_READ_ONLY_ENFORCEMENT | Existing tests not modified |
| UI_COMPONENT_REGISTRY | JSX components exist in registry (if TSX) |
| UI_PROPS_COMPLIANCE | Component props are correct (if TSX) |
| TASK_TEST_PASSES | Spec test passes (TDD green phase) |
| STRICT_COMPILATION | Zero TypeScript errors |
| STYLE_CONSISTENCY_LINT | ESLint passes |
| FULL_REGRESSION_PASS | All tests pass |
| PRODUCTION_BUILD_PASS | Build succeeds |

#### On Failure

1. Orchestrator feeds rejection report to Coder
2. Coder fixes only what validators identified
3. Re-commit and re-submit EXECUTION run
4. Max 3 retries; then escalate

### Stage 7: Integration

After all micro-plans pass individually:

1. Run final `EXECUTION` validation with complete manifest (all files from all micro-plans)
2. Gate 3 validators ensure everything works together:
   - `FULL_REGRESSION_PASS` — all tests pass
   - `PRODUCTION_BUILD_PASS` — production build succeeds
3. If any chunk introduced a regression, orchestrator identifies which chunk broke it

---

## 3. Gatekeeper Integration Map

### Validator × Stage Matrix

```
                          Planning  Spec   Coding  Integration
                          (Gate 0)  (0+1)  (2+3)  (2+3)
Gate 0 ─────────────────
TOKEN_BUDGET_FIT            ✓        ✓       -       -
TASK_SCOPE_SIZE             ✓        ✓       -       -
TASK_CLARITY_CHECK          ✓        ✓       -       -
SENSITIVE_FILES_LOCK        ✓        ✓       -       -
DANGER_MODE_EXPLICIT        ✓        ✓       -       -
PATH_CONVENTION             -        ✓       -       -
DELETE_DEPENDENCY_CHECK     ✓        ✓       -       -

Gate 1 ─────────────────
TEST_SYNTAX_VALID           -        ✓       -       -
TEST_HAS_ASSERTIONS         -        ✓       -       -
TEST_COVERS_HAPPY_SAD       -        ✓       -       -
TEST_FAILS_BEFORE_IMPL     -        ✓       -       -
NO_DECORATIVE_TESTS         -        ✓       -       -
TEST_RESILIENCE_CHECK       -        ✓       -       -
MANIFEST_FILE_LOCK          ✓*       ✓       -       -
NO_IMPLICIT_FILES           ✓*       ✓       -       -
IMPORT_REALITY_CHECK        -        ✓       -       -
TEST_INTENT_ALIGNMENT       -        ✓~      -       -
TEST_CLAUSE_MAPPING         -        ✓       -       -

Gate 2 ─────────────────
DIFF_SCOPE_ENFORCEMENT      -        -       ✓       ✓
TEST_READ_ONLY              -        -       ✓       ✓
UI_COMPONENT_REGISTRY       -        -       ✓       ✓
UI_PROPS_COMPLIANCE         -        -       ✓       ✓
TASK_TEST_PASSES            -        -       ✓       ✓
STRICT_COMPILATION          -        -       ✓       ✓
STYLE_CONSISTENCY_LINT      -        -       ✓       ✓

Gate 3 ─────────────────
FULL_REGRESSION_PASS        -        -       ✓       ✓
PRODUCTION_BUILD_PASS       -        -       ✓       ✓

✓  = active (hard-block)
✓~ = active (soft-block / warning)
✓* = promoted from Gate 1 to PLANNING run type
-  = not applicable
```

### New Run Type: PLANNING

**Current run types**: `CONTRACT` (gates 0-1), `EXECUTION` (gates 2-3)

**New**: `PLANNING` (gate 0 + selected gate 1 validators)

Changes needed in `gates.config.ts`:

```typescript
export const PLANNING_GATE_NUMBERS = [0]
export const PLANNING_EXTRA_VALIDATORS: ValidatorCode[] = [
  'MANIFEST_FILE_LOCK',
  'NO_IMPLICIT_FILES',
]
```

Changes needed in `validation.schema.ts`:

```typescript
runType: z.enum(['CONTRACT', 'EXECUTION', 'PLANNING']).default('CONTRACT')
```

Changes needed in `ValidationOrchestrator`:
- When `runType === 'PLANNING'`: run Gate 0 + MANIFEST_FILE_LOCK + NO_IMPLICIT_FILES
- Skip all test-content validators (no test file exists yet)

### Config Override: MAX_FILES_PER_TASK

For the pipeline, `TASK_SCOPE_SIZE` needs to enforce ≤3 files (not the default 10).

Options:
1. **Per-project config**: Set `MAX_FILES_PER_TASK=3` in the project's validation config
2. **Per-run config**: Pass config overrides in the run creation payload (new feature)
3. **Orchestrator-side check**: Validate scope before sending to Gatekeeper

Recommended: Option 1 (per-project config) since it uses existing infrastructure.

---

## 4. Agent Definitions

### 4.1 Planner Agent

**Role**: Decompose user task into micro-plans using sub-agent exploration.

**System Prompt Structure**:
```
You are a Development Planner. Your job is to decompose a task into
micro-plans of maximum 3 files each.

You have access to Explorer sub-agents that can read the codebase.
Spawn them to gather context, then produce micro-plans.

RULES:
- Each micro-plan has ≤3 files in the manifest
- Each micro-plan has a contract with testable clauses
- Respect dependency order (types → utils → services → components)
- Group related files that share imports
- Never split a type definition from its primary consumer
```

**Tools Available**:
- `spawn_explorer(scope, question)` — spawns a sub-agent
- `save_artifact(filename, content)` — saves output

**Output Format**: JSON with `microPlans[]` and `executionOrder[][]`

### 4.2 Explorer Sub-Agent

**Role**: Read-only codebase exploration, returns structured report.

**System Prompt**:
```
You are a Code Explorer. Read the specified scope and return a
structured report. You have 30 seconds and READ-ONLY access.
```

**Tools Available**: Read, Glob, Grep (READ-ONLY)

**Output Format**: `ExplorerReport` JSON

### 4.3 Spec Writer Agent

**Role**: Create test file from micro-plan + contract.

**System Prompt Structure**:
```
You are a Spec Writer. Given a development plan and contract,
create a test file that:
- Compiles (TEST_SYNTAX_VALID)
- Has assertions (TEST_HAS_ASSERTIONS)
- Covers happy + sad paths (TEST_COVERS_HAPPY_AND_SAD_PATH)
- Fails before implementation (TEST_FAILS_BEFORE_IMPLEMENTATION)
- Uses resilient patterns (TEST_RESILIENCE_CHECK)
- Tags each it() with @clause (TEST_CLAUSE_MAPPING_VALID)
- Has no decorative tests (NO_DECORATIVE_TESTS)

Output ONLY the test file. Nothing else.
```

**Tools Available**: Read (to check existing code), save_artifact

### 4.4 Coder Agent

**Role**: Implement micro-plan using existing Micro-Task Executor prompt.

**System Prompt**: `artifacts/devin/system.md` (already created)
**User Prompt**: `artifacts/devin/user.md` template filled with micro-plan data

**Tools Available**: Read, Write, Edit, Bash, Glob, Grep

---

## 5. Data Flow

### Artifact Directory Structure

```
artifacts/
└── {outputId}/
    ├── pipeline-state.json          # orchestrator state
    ├── planner-output.json          # raw planner output
    ├── plans/
    │   ├── plan-001/
    │   │   ├── plan.json            # micro-plan
    │   │   ├── contract.md          # contract
    │   │   ├── spec.test.ts         # test file (after spec writer)
    │   │   └── micro-steps.json     # execution steps (after coder)
    │   ├── plan-002/
    │   │   ├── plan.json
    │   │   ├── contract.md
    │   │   ├── spec.test.ts
    │   │   └── micro-steps.json
    │   └── ...
    └── reports/
        ├── explorer-001.json        # sub-agent reports
        ├── explorer-002.json
        └── ...
```

### Pipeline State

```typescript
interface PipelineState {
  id: string
  outputId: string
  status: 'planning' | 'validating_plans' | 'spec_writing' |
          'validating_specs' | 'implementing' | 'validating_impl' |
          'integrating' | 'completed' | 'failed'
  taskDescription: string
  config: PipelineConfig
  plans: PlanState[]
  integration?: {
    runId: string
    status: 'pending' | 'running' | 'passed' | 'failed'
  }
  createdAt: string
  updatedAt: string
}

interface PlanState {
  id: number
  name: string
  status: 'pending' | 'planning_validated' | 'spec_writing' |
          'spec_validated' | 'implementing' | 'impl_validated' | 'failed'
  manifest: ManifestInput
  contract: ContractInput
  dependsOn: number[]
  validation: {
    planning?: { runId: string; status: string; attempts: number }
    contract?: { runId: string; status: string; attempts: number }
    execution?: { runId: string; status: string; attempts: number }
  }
}
```

### Gatekeeper API Call Sequences

**Per micro-plan lifecycle**:

```
1. PLANNING validation
   POST /api/runs { runType: "PLANNING", ... }
   GET  /api/runs/{id}/results → poll until complete

2. SPEC WRITING
   (LLM generates spec.test)

3. CONTRACT validation
   POST /api/runs { runType: "CONTRACT", ... }
   PUT  /api/runs/{id}/files (upload spec + plan)
   GET  /api/runs/{id}/results → poll until complete
   
   If FAILED:
     GET  /api/runs/{id}/results → extract failed validators
     POST /api/orchestrator/fix { target: "spec", failedValidators: [...] }
     (re-upload corrected spec)
     POST /api/runs/{id}/rerun/0 → re-run validation

4. IMPLEMENTATION
   (LLM implements via Micro-Task Executor)

5. EXECUTION validation
   POST /api/runs { runType: "EXECUTION", contractRunId: "...", ... }
   GET  /api/runs/{id}/results → poll until complete
```

---

## 6. Required Changes to Gatekeeper

### 6.1 New Run Type: PLANNING

**Files to change**:

| File | Change |
|------|--------|
| `types/gates.types.ts` | Add `'PLANNING'` to `RunType` |
| `api/schemas/validation.schema.ts` | Add `'PLANNING'` to `runType` enum |
| `config/gates.config.ts` | Add `PLANNING_GATE_NUMBERS` + `PLANNING_EXTRA_VALIDATORS` |
| `services/ValidationOrchestrator.ts` | Handle `PLANNING` run type: run Gate 0 + extra validators |
| `api/controllers/ValidationController.ts` | Update gate validation for `PLANNING` runs |
| `api/controllers/RunsController.ts` | Update `rerunGate` valid gates for `PLANNING` |

Estimated: ~50 lines of changes across 6 files.

### 6.2 Pipeline Orchestrator Service

New file: `services/PipelineOrchestrator.ts`

Responsibilities:
- Manage pipeline state
- Coordinate Planner → Spec Writers → Coders
- Call Gatekeeper between phases
- Handle retry logic
- Manage parallelism

### 6.3 Pipeline API Routes

New routes under `/api/pipeline/`:

| Route | Method | Description |
|-------|--------|-------------|
| `/pipeline/start` | POST | Start a new pipeline run |
| `/pipeline/{id}` | GET | Get pipeline state |
| `/pipeline/{id}/plans` | GET | List micro-plans |
| `/pipeline/{id}/plans/{planId}` | GET | Get micro-plan details |
| `/pipeline/{id}/events` | GET (SSE) | Stream pipeline events |
| `/pipeline/{id}/abort` | POST | Abort pipeline |
| `/pipeline/{id}/retry/{planId}` | POST | Retry a failed micro-plan |

### 6.4 Explorer Sub-Agent Service

New file: `services/ExplorerService.ts`

Responsibilities:
- Spawn sub-agents with READ-ONLY tools
- Enforce timeout (30s)
- Parse and validate reports
- Aggregate reports for Planner

---

## 7. Implementation Phases

### Phase 1: PLANNING Run Type (Foundation)

**Goal**: Enable Gatekeeper to validate plans without requiring a test file.

**Tasks**:
1. Add `PLANNING` to run type enum in types + schema
2. Update `ValidationOrchestrator` to handle `PLANNING` runs (Gate 0 + MANIFEST_FILE_LOCK + NO_IMPLICIT_FILES)
3. Update `RunsController.rerunGate` valid gates
4. Add tests for PLANNING run type
5. Configure `MAX_FILES_PER_TASK=3` for pipeline projects

**Estimated effort**: 1-2 days

### Phase 2: Explorer Sub-Agent (Context Gathering)

**Goal**: Planner can spawn read-only sub-agents to explore codebase.

**Tasks**:
1. Create `ExplorerService` with spawn/timeout/report logic
2. Define `ExplorerReport` schema
3. Create explorer system prompt
4. Integrate with `AgentRunnerService` (reuse LLM provider infrastructure)
5. Add tool definitions for explorer (Read, Glob, Grep)
6. Test explorer with sample codebase

**Estimated effort**: 2-3 days

### Phase 3: Planner Agent (Micro-Plan Generation)

**Goal**: Planner produces micro-plans using explorer reports.

**Tasks**:
1. Create Planner system prompt
2. Define `MicroPlan` and `PlannerOutput` schemas
3. Implement Planner agent (spawns explorers, produces plans)
4. Wire up PLANNING validation (Stage 2)
5. Implement retry loop for failed planning validation
6. Test planner with real tasks

**Estimated effort**: 3-4 days

### Phase 4: Spec Writer + Contract Validation

**Goal**: Parallel spec writers produce test files validated by Gatekeeper.

**Tasks**:
1. Create Spec Writer system prompt (incorporating validator rules)
2. Implement parallel spec writing with concurrency control
3. Wire up CONTRACT validation (Stage 4)
4. Implement fix loop using existing `fixArtifacts()` infrastructure
5. Test with multiple concurrent spec writers

**Estimated effort**: 2-3 days

### Phase 5: Coder + Execution Validation

**Goal**: Parallel coders implement micro-plans validated by Gatekeeper.

**Tasks**:
1. Wire up Micro-Task Executor prompt (already exists) as Coder
2. Implement parallel coding with dependency ordering
3. Wire up EXECUTION validation (Stage 6)
4. Implement fix loop for execution failures
5. Test with concurrent implementations

**Estimated effort**: 2-3 days

### Phase 6: Integration + Pipeline Orchestrator

**Goal**: End-to-end pipeline from user request to validated implementation.

**Tasks**:
1. Create `PipelineOrchestrator` service
2. Implement pipeline state management
3. Wire up all stages (Planning → Spec → Code → Integration)
4. Add pipeline API routes + SSE events
5. Implement integration validation (Stage 7)
6. Add pipeline abort/retry functionality
7. End-to-end testing

**Estimated effort**: 3-4 days

### Phase 7: UI + Observability

**Goal**: Frontend visibility into pipeline execution.

**Tasks**:
1. Pipeline dashboard view
2. Per-plan status cards
3. Real-time SSE event streaming
4. Validator result display per stage
5. Retry/abort controls

**Estimated effort**: 3-5 days

---

## 8. Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|-----------|
| TEST_FAILS_BEFORE_IMPLEMENTATION creates worktrees per chunk — parallel chunks may conflict | HIGH | Sequential worktree creation, or unique worktree paths per chunk |
| FULL_REGRESSION_PASS on each chunk runs full test suite — slow for many chunks | MEDIUM | Run Gate 3 only on final integration, not per-chunk. Per-chunk uses TASK_TEST_PASSES only |
| Planner produces overlapping manifests (same file in multiple micro-plans) | HIGH | Validation rule: no file appears in more than one micro-plan's manifest |
| Spec Writer imports from files that don't exist yet (other chunk's output) | MEDIUM | Ensure dependency ordering is respected; manifest CREATE files are considered "will exist" by IMPORT_REALITY_CHECK |
| Token budget exceeded by Planner with many explorer reports | LOW | Hard cap on report size (2000 tokens each), max 5 explorers |

---

## 9. Configuration

### Per-Project Settings

```json
{
  "MAX_FILES_PER_TASK": 3,
  "PIPELINE_MAX_RETRIES": 3,
  "PIPELINE_PARALLELISM": 3,
  "PIPELINE_EXPLORER_TIMEOUT_MS": 30000,
  "PIPELINE_EXPLORER_MAX_COUNT": 5,
  "PIPELINE_SKIP_GATE3_PER_CHUNK": true,
  "INCOMPLETE_FAIL_MODE": "WARNING"
}
```

### Phase Configs (AgentPhaseConfig)

| Step | Role | Default Provider | Default Model |
|------|------|-----------------|---------------|
| 1 | Planner | claude-code | opus |
| 2 | Spec Writer | anthropic | claude-sonnet |
| 3 | Fix (existing) | anthropic | claude-sonnet |
| 4 | Coder | claude-code | sonnet |
| 5 | Explorer | anthropic | claude-haiku |

---

## 10. Summary

Total estimated effort: **~16-24 days** across 7 phases.

Core changes to Gatekeeper:
- 1 new run type (`PLANNING`)
- 1 new service (`PipelineOrchestrator`)
- 1 new service (`ExplorerService`)
- 4 new prompts (Planner, Explorer, Spec Writer system prompts + updated Coder)
- ~6 new API routes
- ~50 lines of changes to existing validator infrastructure

The pipeline reuses heavily from existing infrastructure:
- `gatekeeper-orchestrator` package (artifact management, LLM client, prompt builder, executor)
- `AgentRunnerService` (LLM provider abstraction, tool execution)
- `ValidationOrchestrator` (run execution, gate processing)
- Micro-Task Executor prompt (`artifacts/devin/system.md`)
