# Gatekeeper API Reference

**Version:** 1.0.0
**Last Updated:** 2026-01-18

This document is the **source of truth** for all Gatekeeper API schemas, validators, and operational behavior.

---

## Table of Contents

1. [plan.json Schema](#planjson-schema)
2. [contract Field (Optional)](#contract-field-optional)
3. [Validator-Contract Mapping](#validator-contract-mapping)
4. [Git Ref Defaults](#git-ref-defaults)
5. [Validation Pipeline](#validation-pipeline)
6. [Complete Validator Catalog](#complete-validator-catalog)

---

## plan.json Schema

### Overview

The `plan.json` file is the primary input to Gatekeeper validation. It contains:
- Task metadata (outputId, taskPrompt, projectPath)
- Git references (baseRef, targetRef)
- Manifest (files to be changed + test file)
- **Optional:** Contract specification

### Complete Schema

```typescript
interface PlanJson {
  // Required fields
  outputId: string              // Unique identifier for this task
  projectPath: string           // Absolute path to project root
  taskPrompt: string            // Task description (min 10 characters)
  testFilePath: string          // Path to test file
  manifest: {
    files: Array<{
      path: string              // File path relative to projectPath
      action: 'CREATE' | 'MODIFY' | 'DELETE'
      reason?: string           // Optional justification
    }>
    testFile: string            // Test file path (must match testFilePath)
  }

  // Optional fields (with defaults)
  baseRef?: string              // Default: 'origin/main'
  targetRef?: string            // Default: 'HEAD'
  dangerMode?: boolean          // Default: false
  runType?: 'CONTRACT' | 'EXECUTION'  // Default: 'CONTRACT'
  contractRunId?: string        // For EXECUTION runs, links to CONTRACT run
  testFileContent?: string      // Pre-fetched test content (optimization)

  // Optional: Contract specification (T091)
  contract?: Contract           // See "Contract Field" section below
}
```

### Field Details

#### outputId
- **Type:** `string`
- **Required:** Yes
- **Format:** Any unique identifier (typically UUID or slug)
- **Purpose:** Identifies this specific task/validation run

#### projectPath
- **Type:** `string`
- **Required:** Yes
- **Format:** Absolute file system path
- **Purpose:** Root directory for file resolution and git operations

#### taskPrompt
- **Type:** `string`
- **Required:** Yes
- **Min Length:** 10 characters
- **Purpose:** Human-readable task description
- **Validators:** TASK_CLARITY_CHECK

#### testFilePath
- **Type:** `string`
- **Required:** Yes
- **Format:** Path relative to projectPath
- **Purpose:** Primary test file to validate
- **Must Match:** `manifest.testFile`

#### baseRef (T093: Default)
- **Type:** `string`
- **Required:** No
- **Default:** `"origin/main"` (from `config/defaults.ts`)
- **Purpose:** Git reference for "before" state (TDD red phase)
- **Common Values:** `"origin/main"`, `"HEAD~1"`, `"develop"`

#### targetRef (T093: Default)
- **Type:** `string`
- **Required:** No
- **Default:** `"HEAD"` (from `config/defaults.ts`)
- **Purpose:** Git reference for "after" state (TDD green phase)
- **Common Values:** `"HEAD"`, branch names

#### dangerMode (T093: Default)
- **Type:** `boolean`
- **Required:** No
- **Default:** `false` (from `config/defaults.ts`)
- **Purpose:** Allows modification of sensitive files
- **Validators:** DANGER_MODE_EXPLICIT

#### runType (T093: Default)
- **Type:** `enum`
- **Values:** `"CONTRACT"` | `"EXECUTION"`
- **Required:** No
- **Default:** `"CONTRACT"` (from `config/defaults.ts`)
- **Purpose:** Distinguishes between contract validation and full execution

#### contractRunId
- **Type:** `string`
- **Required:** No (required when `runType === "EXECUTION"`)
- **Purpose:** Links execution run back to its contract run
- **Schema:** Foreign key to ValidationRun.id

---

## Contract Field (Optional)

**Reference:** `docs/RULES.md` (T090)

### Overview (T091)

The `contract` field is **OPTIONAL** in `plan.json`. When present, it enables "tests as contracts" validation through 4 specialized validators:

1. CONTRACT_SCHEMA_VALID
2. TEST_CLAUSE_MAPPING_VALID
3. CONTRACT_CLAUSE_COVERAGE
4. NO_OUT_OF_CONTRACT_ASSERTIONS

When the `contract` field is **absent**, all contract validators **SKIP** (do not fail or warn).

### Schema (T092)

```typescript
interface Contract {
  // Required fields
  schemaVersion: string         // e.g., "1.0.0" (semantic versioning)
  slug: string                  // Kebab-case identifier (e.g., "user-auth-api")
  title: string                 // Human-readable title (max 120 chars)
  mode: 'STRICT' | 'CREATIVE'   // Validation mode
  changeType: 'new' | 'modify' | 'bugfix' | 'refactor'
  targetArtifacts: string[]     // File paths or globs (min 1)
  clauses: ContractClause[]     // Array of clauses (min 1, max 100)

  // Optional fields
  scope?: 'internal' | 'external' | 'mixed'  // Default: 'external'
  criticality?: 'low' | 'medium' | 'high' | 'critical'  // Default: 'medium'
  owners?: string[]             // Responsible parties
  createdAt?: string            // ISO 8601 timestamp
  elicitorVersion?: string      // Version of elicitor that generated this
  inputsHash?: string           // SHA-256 hash for reproducibility
  version?: string              // Contract version
  metadata?: {                  // Custom metadata
    generatedBy?: string
    generatedAt?: string
    taskType?: string
  }
  assertionSurface?: AssertionSurface  // See RULES.md T056-T062
  testMapping?: TestMapping     // See RULES.md T063-T067
  expectedCoverage?: ExpectedCoverage  // See RULES.md T068-T069
}
```

**Contract schema validations (ContractSchemaValid)**:
- `schemaVersion` must be `1.0.0` and follow semantic versioning.
- Clause IDs must be unique; duplicate IDs fail on `CONTRACT_SCHEMA_VALID`.
- `STRICT` mode requires a populated `assertionSurface`; `CREATIVE` mode emits a WARNING instead.
- `testMapping.untaggedAllowlist` is invalid unless `allowUntagged` is `true`.
- `expectedCoverage` entries such as `minTestsForMUST`, `minTestsForSecurity`, and `minNegativeTestsForError` reference clauses that exist in the contract.

### ContractClause Schema (T092)

```typescript
interface ContractClause {
  // Required fields
  id: string                    // Format: CL-<TYPE>-<SEQUENCE> (e.g., "CL-AUTH-001")
  kind: ClauseKind              // behavior | error | invariant | constraint | security | ui
  normativity: Normativity      // MUST | SHOULD | MAY (RFC 2119)
  title: string                 // Short stable title (max 80 chars)
  spec: string                  // Testable specification (max 2000 chars)
  observables: Observable[]     // Where to observe behavior (min 1)

  // Optional fields
  when?: string[]               // Preconditions (observable only)
  inputs?: Record<string, string>  // Input parameters
  outputs?: Record<string, string> // Expected outputs
  negativeCases?: string[]      // Required for kind=error or kind=security
  tags?: string[]               // Lowercase tags for filtering
  notes?: string                // Non-normative notes (max 5000 chars)
}

type ClauseKind = 'behavior' | 'error' | 'invariant' | 'constraint' | 'security' | 'ui'
type Normativity = 'MUST' | 'SHOULD' | 'MAY'
type Observable = 'http' | 'ui' | 'db-effect' | 'event' | 'file' | 'log'
```

### Enums (T092)

**mode:**
- `"STRICT"`: 100% coverage required, all hard-blocks
- `"CREATIVE"`: Partial coverage allowed, some validators emit WARNING

**kind:**
- `"behavior"`: Normal functionality (happy path)
- `"error"`: Error handling (requires negativeCases)
- `"invariant"`: Must-always-hold conditions
- `"constraint"`: Business rules/validation
- `"security"`: Security requirements (requires negativeCases)
- `"ui"`: UI behavior and rendering

**normativity:**
- `"MUST"`: Absolute requirement (always hard-block)
- `"SHOULD"`: Strong recommendation (STRICT: hard-block, CREATIVE: warning)
- `"MAY"`: Optional (always informational)

**observables:**
- `"http"`: HTTP responses (status, headers, body)
- `"ui"`: UI elements (DOM, rendering, interactions)
- `"db-effect"`: Database state changes
- `"event"`: Application events
- `"file"`: File system changes
- `"log"`: Log entries

### Required vs Optional Fields (T092)

**Always Required:**
- `schemaVersion`, `slug`, `title`, `mode`, `changeType`, `targetArtifacts`, `clauses`
- In each clause: `id`, `kind`, `normativity`, `title`, `spec`, `observables`

**Optional (with defaults):**
- `scope` (default: `"external"`)
- `criticality` (default: `"medium"`)
- All audit metadata fields
- All assertion surface fields
- All test mapping configuration

**Conditionally Required:**
- `negativeCases[]`: Required when `kind === "error"` or `kind === "security"`

---

## Validator-Contract Mapping (T093)

This section documents which validators consume which contract fields.

### CONTRACT_SCHEMA_VALID

**Consumes:**
- Entire `contract` object
- Validates structure against Zod schema
- Checks for duplicate clause IDs

**Returns:**
- SKIPPED: When `contract` is absent
- FAILED: When contract structure is invalid or has duplicate IDs
- PASSED: When contract is valid

**Schema Source:** `packages/gatekeeper-api/src/api/schemas/validation.schema.ts`

---

### TEST_CLAUSE_MAPPING_VALID

**Consumes:**
- `contract.clauses[].id`: Validates tags reference existing clause IDs
- `contract.mode`: Determines severity (STRICT → FAILED, CREATIVE → WARNING)
- Test file content: Parses `@clause` tags

**Returns:**
- SKIPPED: When `contract` is absent
- FAILED (STRICT) / WARNING (CREATIVE): When invalid tags found
- PASSED: When all tags reference valid clauses

**Tag Format:** `// @clause CL-<TYPE>-<SEQUENCE>`
**Regex:** `/^\s*\/\/\s*@clause\s+(CL-[A-Z_]+-\d{3,})\s*$/`

---

### CONTRACT_CLAUSE_COVERAGE

**Consumes:**
- `contract.clauses[]`: All clauses
- `contract.mode`: Determines coverage requirements
- `contract.criticality`: Affects minimum coverage percentage
- `expectedCoverage`: Custom coverage requirements (if present)
- Test file content: Parses `@clause` tags

**Coverage Rules:**
- STRICT: 100% coverage required (FAILED if not met)
- CREATIVE with criticality:
  - `low`: 60% minimum
  - `medium`: 80% minimum
  - `high`: 90% minimum
  - `critical`: 100% minimum (overrides CREATIVE mode)

**Returns:**
- SKIPPED: When `contract` is absent
- FAILED (STRICT) / WARNING (CREATIVE): When coverage insufficient
- PASSED: When coverage meets requirements

---

### NO_OUT_OF_CONTRACT_ASSERTIONS

**Consumes:**
- `contract.clauses[].id`: Valid clause IDs
- `contract.mode`: Determines severity
- `testMapping.allowUntagged`: Whether untagged tests allowed
- `testMapping.untaggedAllowlist`: Patterns exempted from tagging
- Test file content: Parses assertions and `@clause` tags

**Assertion Types Detected:**
- `expect()`: Expect-style assertions
- `assert()`: Assert-style assertions
- Snapshots: `toMatchSnapshot()`, `toMatchInlineSnapshot()`
- Mocks: `toHaveBeenCalled()`, `toHaveBeenCalledWith()`
- Structural: `toBeDefined()`, `toBeNull()`, etc.

**Mapping Heuristic:**
- Assertion mapped to nearest `@clause` tag within 50 lines above it
- Multiple tags within 5 lines of each other are all applied

**Returns:**
- SKIPPED: When `contract` is absent
- FAILED (STRICT) / WARNING (CREATIVE): When unmapped assertions found
- PASSED: When all assertions mapped to clauses

---

## Git Ref Defaults (T094)

### Source of Truth

**Location:** `packages/gatekeeper-api/src/config/defaults.ts`

```typescript
export const DEFAULT_GIT_REFS = {
  BASE_REF: 'origin/main',
  TARGET_REF: 'HEAD',
} as const

export const DEFAULT_RUN_CONFIG = {
  DANGER_MODE: false,
  RUN_TYPE: 'CONTRACT',
} as const
```

### Usage in Codebase

**API Schema (validation.schema.ts):**
```typescript
baseRef: z.string().default(DEFAULT_GIT_REFS.BASE_REF)
targetRef: z.string().default(DEFAULT_GIT_REFS.TARGET_REF)
dangerMode: z.boolean().default(DEFAULT_RUN_CONFIG.DANGER_MODE)
runType: z.enum(['CONTRACT', 'EXECUTION']).default(DEFAULT_RUN_CONFIG.RUN_TYPE)
```

**Elicitor (PlanJsonGenerator.ts):**
```typescript
baseRef: DEFAULT_GIT_REFS.BASE_REF,   // 'origin/main'
targetRef: DEFAULT_GIT_REFS.TARGET_REF, // 'HEAD'
```

### Rationale for origin/main

- Ensures test fails against stable base branch (not arbitrary commit)
- Enforces TDD red phase against production-ready code
- Prevents false positives from passing tests in feature branches

### Override Behavior

Users can override defaults in API requests:
```json
{
  "baseRef": "develop",    // Override default
  "targetRef": "feature/my-branch"
}
```

---

## Validation Pipeline

### Complete Flow

```
POST /api/runs (with plan.json)
    ↓
    • Supports an optional `contract` payload that is stored on the run for contract-aware validators
Schema Validation (Zod)
    ↓
Create ValidationRun record
    ↓
Queue for execution (single concurrency)
    ↓
Build ValidationContext
    ├─ Load contract (if present)
    ├─ Load sensitive patterns
    ├─ Load ambiguous terms
    ├─ Initialize services
    └─ Load config from database
    ↓
Gate 0: SANITIZATION (5 validators)
    ↓ ALL PASS
Gate 1: CONTRACT (13 validators) ← 4 contract validators here
    ↓ ALL PASS
Gate 2: EXECUTION (5 validators)
    ↓ ALL PASS
Gate 3: INTEGRITY (2 validators)
    ↓ ALL PASS
    ↓
Status: PASSED ✅
```

### Contract Validators in Pipeline

**Location:** Gate 1, Order 1-4 (before existing validators)

1. **CONTRACT_SCHEMA_VALID** (order: 1)
2. **TEST_CLAUSE_MAPPING_VALID** (order: 2)
3. **CONTRACT_CLAUSE_COVERAGE** (order: 3)
4. **NO_OUT_OF_CONTRACT_ASSERTIONS** (order: 4)
5. TEST_SYNTAX_VALID (order: 5)
6. ... (existing validators)

### SKIP Behavior (T094)

When `contract` field is **absent** from `plan.json`:
- All 4 contract validators return `{ passed: true, status: 'SKIPPED' }`
- Pipeline continues normally through existing validators
- No warnings or errors emitted
- **Backward compatibility:** Old plan.json files without `contract` work unchanged

---

## Complete Validator Catalog

### Gate 0: SANITIZATION (5 validators)

| Code | Name | Order | Hard | Contract Fields |
|------|------|-------|------|-----------------|
| TOKEN_BUDGET_FIT | Token Budget Fit | 1 | ✅ | None |
| TASK_SCOPE_SIZE | Task Scope Size | 2 | ✅ | None |
| TASK_CLARITY_CHECK | Task Clarity Check | 3 | ✅ | None |
| SENSITIVE_FILES_LOCK | Sensitive Files Lock | 4 | ✅ | None |
| DANGER_MODE_EXPLICIT | Danger Mode Explicit | 5 | ✅ | None |

---

### Gate 1: CONTRACT (13 validators)

| Code | Name | Order | Hard | Contract Fields |
|------|------|-------|------|-----------------|
| **CONTRACT_SCHEMA_VALID** | **Contract Schema Valid** | **1** | **✅** | **All (schema validation)** |
| **TEST_CLAUSE_MAPPING_VALID** | **Test Clause Mapping Valid** | **2** | **✅\*** | **clauses[].id, mode** |
| **CONTRACT_CLAUSE_COVERAGE** | **Contract Clause Coverage** | **3** | **✅\*** | **clauses[], mode, criticality** |
| **NO_OUT_OF_CONTRACT_ASSERTIONS** | **No Out-of-Contract Assertions** | **4** | **✅\*** | **clauses[].id, mode, testMapping** |
| TEST_SYNTAX_VALID | Test Syntax Valid | 5 | ✅ | None |
| TEST_HAS_ASSERTIONS | Test Has Assertions | 6 | ✅ | None |
| TEST_COVERS_HAPPY_AND_SAD_PATH | Test Covers Happy/Sad Path | 7 | ✅ | None |
| TEST_FAILS_BEFORE_IMPLEMENTATION | Test Fails Before Implementation | 8 | ✅ | None |
| NO_DECORATIVE_TESTS | No Decorative Tests | 9 | ✅ | None |
| MANIFEST_FILE_LOCK | Manifest File Lock | 10 | ✅ | None |
| NO_IMPLICIT_FILES | No Implicit Files | 11 | ✅ | None |
| IMPORT_REALITY_CHECK | Import Reality Check | 12 | ✅ | None |
| TEST_INTENT_ALIGNMENT | Test Intent Alignment | 13 | ⚠️ | None |

**\*** Hard in STRICT mode, WARNING in CREATIVE mode (mode-aware)

---

### Gate 2: EXECUTION (5 validators)

| Code | Name | Order | Hard | Contract Fields |
|------|------|-------|------|-----------------|
| DIFF_SCOPE_ENFORCEMENT | Diff Scope Enforcement | 1 | ✅ | None |
| TEST_READ_ONLY_ENFORCEMENT | Test Read-Only Enforcement | 2 | ✅ | None |
| TASK_TEST_PASSES | Task Test Passes | 3 | ✅ | None |
| STRICT_COMPILATION | Strict Compilation | 4 | ✅ | None |
| STYLE_CONSISTENCY_LINT | Style Consistency Lint | 5 | ✅ | None |

---

### Gate 3: INTEGRITY (2 validators)

| Code | Name | Order | Hard | Contract Fields |
|------|------|-------|------|-----------------|
| FULL_REGRESSION_PASS | Full Regression Pass | 1 | ✅ | None |
| PRODUCTION_BUILD_PASS | Production Build Pass | 2 | ✅ | None |

---

**Total Validators:** 25 (5 + 13 + 5 + 2)
**Contract-Aware Validators:** 4 (all in Gate 1)

---

## Appendix: Divergences from Previous Versions (T094)

### Fixed Divergences

1. **baseRef Default:**
   - ❌ Old (incorrect): `'HEAD~1'` in some generators
   - ✅ Now (correct): `'origin/main'` everywhere (from `config/defaults.ts`)

2. **Validator Count:**
   - ❌ Old: Gate 1 had 9 validators
   - ✅ Now: Gate 1 has 13 validators (9 + 4 contract validators)

3. **Contract Field:**
   - ❌ Old: Not present in schema
   - ✅ Now: Optional field in CreateRunSchema

4. **Validator Codes:**
   - ❌ Old: ValidatorCode type missing 4 contract codes
   - ✅ Now: Includes CONTRACT_SCHEMA_VALID, TEST_CLAUSE_MAPPING_VALID, CONTRACT_CLAUSE_COVERAGE, NO_OUT_OF_CONTRACT_ASSERTIONS

---

**Version:** 1.0.0
**Status:** ✅ Frozen
**Last Updated:** 2026-01-18
