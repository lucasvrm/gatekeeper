# Executor Guide - Running Gatekeeper Validation

**Version:** 1.0.0
**Last Updated:** 2026-01-18
**Audience:** LLM agents executing code validation via Gatekeeper

This guide specifies how Executors interact with Gatekeeper's validation pipeline.

---

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Input Requirements](#input-requirements)
3. [Execution Flow](#execution-flow)
4. [Contract vs Execution Runs](#contract-vs-execution-runs)
5. [Handling Validation Results](#handling-validation-results)
6. [Error Recovery](#error-recovery)

---

## 1. Pipeline Overview (T108)

Gatekeeper validates code changes through a 4-gate pipeline that consumes `plan.json` with optional contract.

### Pipeline Architecture

```
plan.json + contract (optional)
    ↓
POST /api/runs
    ↓
Schema Validation (Zod)
    ↓
ValidationRun created (status: PENDING)
    ↓
Queued (single concurrency)
    ↓
Build ValidationContext
    ├─ Parse manifest
    ├─ Load contract (if present)
    ├─ Initialize git service
    ├─ Load config from database
    └─ Create service instances
    ↓
Gate 0: SANITIZATION (5 validators)
    ├─ TOKEN_BUDGET_FIT
    ├─ TASK_SCOPE_SIZE
    ├─ TASK_CLARITY_CHECK
    ├─ SENSITIVE_FILES_LOCK
    └─ DANGER_MODE_EXPLICIT
    ↓ ALL PASS
Gate 1: CONTRACT (13 validators)
    ├─ CONTRACT_SCHEMA_VALID*
    ├─ TEST_CLAUSE_MAPPING_VALID*
    ├─ CONTRACT_CLAUSE_COVERAGE*
    ├─ NO_OUT_OF_CONTRACT_ASSERTIONS*
    ├─ TEST_SYNTAX_VALID
    ├─ TEST_HAS_ASSERTIONS
    ├─ TEST_COVERS_HAPPY_AND_SAD_PATH
    ├─ TEST_FAILS_BEFORE_IMPLEMENTATION
    ├─ NO_DECORATIVE_TESTS
    ├─ MANIFEST_FILE_LOCK
    ├─ NO_IMPLICIT_FILES
    ├─ IMPORT_REALITY_CHECK
    └─ TEST_INTENT_ALIGNMENT (soft)
    ↓ ALL PASS
Gate 2: EXECUTION (5 validators)
    ├─ DIFF_SCOPE_ENFORCEMENT
    ├─ TEST_READ_ONLY_ENFORCEMENT
    ├─ TASK_TEST_PASSES
    ├─ STRICT_COMPILATION
    └─ STYLE_CONSISTENCY_LINT
    ↓ ALL PASS
Gate 3: INTEGRITY (2 validators)
    ├─ FULL_REGRESSION_PASS
    └─ PRODUCTION_BUILD_PASS
    ↓ ALL PASS
    ↓
Status: PASSED ✅
```

**\*** Contract validators SKIP if contract field absent

### Gate Purposes

**Gate 0 - SANITIZATION:**
- Input validation and safety checks
- Prevents dangerous operations before code execution
- All hard-blocks

**Gate 1 - CONTRACT:**
- Test quality and contract compliance
- TDD enforcement
- Contract validation (optional)
- Mix of hard-blocks and warnings

**Gate 2 - EXECUTION:**
- Code execution and compilation
- Test passage verification
- Code quality checks
- All hard-blocks

**Gate 3 - INTEGRITY:**
- System-wide integrity validation
- Full test suite and production build
- All hard-blocks

---

## 2. Input Requirements (T108)

### Required Inputs

All inputs provided via `plan.json` file or API request body.

**Minimal plan.json:**
```json
{
  "outputId": "unique-identifier",
  "projectPath": "/absolute/path/to/project",
  "taskPrompt": "Description of task (min 10 chars)",
  "testFilePath": "relative/path/to/test.test.ts",
  "manifest": {
    "files": [
      {
        "path": "relative/path/to/file.ts",
        "action": "CREATE" | "MODIFY" | "DELETE",
        "reason": "Optional justification"
      }
    ],
    "testFile": "relative/path/to/test.test.ts"
  }
}
```

**With contract (recommended for behavioral changes):**
```json
{
  "outputId": "unique-identifier",
  "projectPath": "/absolute/path/to/project",
  "taskPrompt": "Implement user authentication (CL-AUTH-001, CL-AUTH-002)",
  "testFilePath": "tests/auth.test.ts",
  "manifest": {
    "files": [
      {"path": "src/auth.ts", "action": "CREATE"},
      {"path": "tests/auth.test.ts", "action": "CREATE"}
    ],
    "testFile": "tests/auth.test.ts"
  },
  "contract": {
    "schemaVersion": "1.0.0",
    "slug": "user-authentication",
    "title": "User Authentication with JWT",
    "mode": "STRICT",
    "changeType": "new",
    "targetArtifacts": ["src/auth.ts"],
    "clauses": [
      {
        "id": "CL-AUTH-001",
        "kind": "behavior",
        "normativity": "MUST",
        "title": "User receives JWT on successful login",
        "spec": "When user submits valid credentials via POST /api/auth/login, then response contains JWT token",
        "observables": ["http"]
      },
      {
        "id": "CL-AUTH-002",
        "kind": "error",
        "normativity": "MUST",
        "title": "Invalid credentials return 401",
        "spec": "When user submits invalid credentials, then response status is 401",
        "observables": ["http"],
        "negativeCases": ["Wrong password", "Non-existent user"]
      }
    ]
  }
}
```

### Optional Inputs (with defaults)

```json
{
  "baseRef": "origin/main",     // Default: origin/main
  "targetRef": "HEAD",           // Default: HEAD
  "dangerMode": false,           // Default: false
  "runType": "CONTRACT",         // Default: CONTRACT
  "contractRunId": null,         // For EXECUTION runs only
  "testFileContent": "..."       // Pre-fetched optimization
}
```

### Input Validation

**API validates:**
- All required fields present
- Field types match schema
- Enum values are valid
- Clause IDs follow format (if contract present)
- Manifest has at least 1 file
- testFilePath matches manifest.testFile

**Returns 400 Bad Request if invalid:**
```json
{
  "error": "Validation error",
  "details": [
    "taskPrompt: String must contain at least 10 character(s)",
    "contract.mode: Invalid enum value. Expected 'STRICT' | 'CREATIVE'"
  ]
}
```

---

## 3. Execution Flow (T108)

### Step 1: Submit Validation Request

**HTTP API:**
```bash
POST /api/runs
Content-Type: application/json

{
  "outputId": "task-001",
  "projectPath": "/path/to/project",
  ...
}
```

**Response:**
```json
{
  "id": "clx123456",
  "status": "PENDING",
  "currentGate": 0,
  "createdAt": "2026-01-18T10:00:00Z"
}
```

### Step 2: Poll for Status

**HTTP API:**
```bash
GET /api/runs/clx123456
```

**Response (in progress):**
```json
{
  "id": "clx123456",
  "status": "RUNNING",
  "currentGate": 1,
  "gateResults": [
    {
      "gateNumber": 0,
      "status": "PASSED",
      "passedCount": 5,
      "failedCount": 0
    },
    {
      "gateNumber": 1,
      "status": "RUNNING",
      "passedCount": 8,
      "failedCount": 0
    }
  ]
}
```

**Response (completed):**
```json
{
  "id": "clx123456",
  "status": "PASSED",
  "currentGate": 3,
  "passed": true,
  "completedAt": "2026-01-18T10:05:00Z",
  "gateResults": [
    {"gateNumber": 0, "status": "PASSED", "passedCount": 5},
    {"gateNumber": 1, "status": "PASSED", "passedCount": 13},
    {"gateNumber": 2, "status": "PASSED", "passedCount": 5},
    {"gateNumber": 3, "status": "PASSED", "passedCount": 2}
  ]
}
```

### Step 3: Retrieve Detailed Results

**HTTP API:**
```bash
GET /api/runs/clx123456/validators
```

**Response:**
```json
{
  "validators": [
    {
      "code": "CONTRACT_SCHEMA_VALID",
      "status": "PASSED",
      "message": "Contract is valid (mode: STRICT, clauses: 2)",
      "durationMs": 12
    },
    {
      "code": "TEST_CLAUSE_MAPPING_VALID",
      "status": "PASSED",
      "message": "All 5 @clause tag(s) reference valid clauses",
      "durationMs": 45
    }
  ]
}
```

---

## 4. Contract vs Execution Runs (T108)

### Run Types

**CONTRACT Run (`runType: "CONTRACT"`):**
- Default run type
- Validates contract and tests before implementation
- Enforces TDD red phase (test must fail at baseRef)
- Used for initial validation

**EXECUTION Run (`runType: "EXECUTION"`):**
- Follows a successful CONTRACT run
- Validates implementation and green phase
- Links back to CONTRACT run via `contractRunId`
- Skips some contract validations

### Workflow

**1. Contract Phase:**
```json
POST /api/runs
{
  "runType": "CONTRACT",
  "baseRef": "origin/main",
  "targetRef": "HEAD",
  "contract": {...}
}
```

**Response:**
```json
{
  "id": "contract-run-123",
  "status": "PASSED"
}
```

**2. Execution Phase:**
```json
POST /api/runs
{
  "runType": "EXECUTION",
  "contractRunId": "contract-run-123",
  "baseRef": "HEAD~1",
  "targetRef": "HEAD",
  "contract": {...}  // Same contract
}
```

**Response:**
```json
{
  "id": "execution-run-456",
  "status": "PASSED"
}
```

### Differences

| Aspect | CONTRACT Run | EXECUTION Run |
|--------|--------------|---------------|
| Purpose | Validate contract & tests | Validate implementation |
| TDD Phase | Red (test must fail) | Green (test must pass) |
| TEST_FAILS_BEFORE_IMPLEMENTATION | Must fail | Skipped |
| TASK_TEST_PASSES | Skipped | Must pass |
| Links to previous run | No | Yes (via contractRunId) |

---

## 5. Handling Validation Results (T108)

### Success Response

```json
{
  "id": "clx123",
  "status": "PASSED",
  "passed": true,
  "currentGate": 3,
  "completedAt": "2026-01-18T10:05:00Z",
  "summary": "All 25 validators passed"
}
```

**Executor action:**
- ✅ Proceed with deployment/merge
- Log success metrics
- Update task status to COMPLETED

### Failure Response

```json
{
  "id": "clx123",
  "status": "FAILED",
  "passed": false,
  "currentGate": 1,
  "failedAt": 1,
  "failedValidatorCode": "CONTRACT_CLAUSE_COVERAGE",
  "completedAt": "2026-01-18T10:02:00Z",
  "summary": "Failed at Gate 1: CONTRACT_CLAUSE_COVERAGE"
}
```

**Executor action:**
- ❌ Do NOT deploy/merge
- Retrieve failure details
- Present error to user
- Request fixes

### Warning Response

```json
{
  "id": "clx123",
  "status": "PASSED",
  "passed": true,
  "currentGate": 3,
  "completedAt": "2026-01-18T10:05:00Z",
  "summary": "All gates passed with 1 warning",
  "validatorResults": [
    {
      "code": "TEST_INTENT_ALIGNMENT",
      "status": "WARNING",
      "message": "Low keyword overlap (25%)"
    }
  ]
}
```

**Executor action:**
- ✅ Can proceed (warnings don't block)
- Log warning for review
- Optional: Display warning to user

### Partial Failure (CREATIVE mode)

```json
{
  "id": "clx123",
  "status": "PASSED",
  "passed": true,
  "validatorResults": [
    {
      "code": "CONTRACT_CLAUSE_COVERAGE",
      "status": "WARNING",
      "message": "Coverage is 80% (8/10 clauses)",
      "details": {
        "uncoveredClauseIds": ["CL-AUTH-003", "CL-AUTH-004"]
      }
    }
  ]
}
```

**Executor action:**
- ✅ Can proceed (CREATIVE mode allows partial coverage)
- Log coverage gaps
- Optional: Suggest adding tests for uncovered clauses

---

## 6. Error Recovery (T108)

### Common Failures and Fixes

#### CONTRACT_SCHEMA_VALID Failure

**Error:**
```json
{
  "code": "CONTRACT_SCHEMA_VALID",
  "status": "FAILED",
  "message": "Contract structure is invalid: 2 error(s)",
  "details": {
    "errors": [
      "mode: Invalid enum value",
      "clauses.0.id: String must match format CL-<TYPE>-<SEQUENCE>"
    ]
  }
}
```

**Fix:**
1. Check contract against schema in `docs/REFERENCE.md`
2. Fix enum values (use uppercase: `"STRICT"` not `"strict"`)
3. Fix clause IDs (use format: `CL-AUTH-001` not `CL-auth-1`)
4. Resubmit validation

#### TEST_CLAUSE_MAPPING_VALID Failure

**Error:**
```json
{
  "code": "TEST_CLAUSE_MAPPING_VALID",
  "status": "FAILED",
  "message": "Found 2 invalid @clause tag(s)",
  "details": {
    "invalidTags": [
      {"clauseId": "CL-AUTH-999", "file": "tests/auth.test.ts", "line": 45}
    ]
  }
}
```

**Fix:**
1. Check if clause `CL-AUTH-999` exists in contract
2. If typo: Fix tag to reference correct clause ID
3. If missing: Add clause to contract
4. If unnecessary: Remove tag from test
5. Resubmit validation

#### CONTRACT_CLAUSE_COVERAGE Failure

**Error:**
```json
{
  "code": "CONTRACT_CLAUSE_COVERAGE",
  "status": "FAILED",
  "message": "Coverage is 66.7% (2/3 clauses)",
  "details": {
    "uncoveredClauseIds": ["CL-AUTH-003"]
  }
}
```

**Fix:**
1. Add test for uncovered clause
2. Tag test with `// @clause CL-AUTH-003`
3. Or: Remove clause from contract if not needed
4. Or: Switch to CREATIVE mode for partial coverage
5. Resubmit validation

#### NO_OUT_OF_CONTRACT_ASSERTIONS Failure

**Error:**
```json
{
  "code": "NO_OUT_OF_CONTRACT_ASSERTIONS",
  "status": "FAILED",
  "message": "Found 3 unmapped assertion(s)",
  "details": {
    "unmappedAssertions": [
      {"file": "tests/auth.test.ts", "line": 78, "type": "expect"}
    ]
  }
}
```

**Fix:**
1. Add `@clause` tag above test with assertion
2. Or: Add clause to contract for this assertion
3. Or: Remove assertion if not needed
4. Or: Switch to CREATIVE mode for warnings
5. Resubmit validation

### Retry Logic

**Recommended retry strategy:**
```typescript
async function executeWithRetry(plan: PlanJson, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await submitValidation(plan)

    if (result.status === 'PASSED') {
      return result
    }

    if (result.status === 'FAILED') {
      // Analyze failure
      const canAutoFix = analyzeFailure(result)

      if (canAutoFix && attempt < maxRetries) {
        plan = applyFix(plan, result)
        continue  // Retry with fixed plan
      } else {
        throw new Error(`Validation failed: ${result.failedValidatorCode}`)
      }
    }
  }

  throw new Error('Max retries exceeded')
}
```

### Error Reporting to User

**Template for failure messages:**
```
Gatekeeper validation FAILED at Gate {gateNumber}: {validatorCode}

Error: {message}

Details:
{formatted details from validator}

Action required:
{specific fix instructions based on validator}

See full results: /api/runs/{runId}
```

---

## 7. Best Practices

### Pre-Flight Checks

Before submitting to Gatekeeper:

1. **Validate plan.json locally:**
   - Check JSON syntax
   - Verify required fields
   - Validate contract schema (if present)

2. **Check contract-test alignment:**
   - Count clause IDs in contract
   - Count `@clause` tags in test file
   - Verify all IDs match

3. **Review file manifest:**
   - Max 10 files
   - No glob patterns
   - No sensitive files (unless dangerMode)

### Performance Optimization

**Use testFileContent:**
```json
{
  "testFilePath": "tests/auth.test.ts",
  "testFileContent": "... pre-fetched file content ..."
}
```

**Benefits:**
- Avoids redundant git operations
- Faster validation (especially for large files)
- Reduces I/O overhead

**When to use:**
- Test file already read for generation
- Multiple validations on same file
- Performance-critical scenarios

### Monitoring

**Track metrics:**
- Validation success rate
- Average duration per gate
- Most common failures
- Contract adoption rate

**Alert on:**
- Consistent failures on specific validators
- Unusually long validation times
- High retry rates

---

**Version:** 1.0.0
**Status:** ✅ Frozen
**Last Updated:** 2026-01-18
