# Gatekeeper Operational Procedures

**Version:** 1.0.0
**Last Updated:** 2026-01-18

This document defines operational procedures, naming conventions, error handling, and rollout strategies for Gatekeeper contract validators.

---

## Table of Contents

1. [Validator Nomenclature](#validator-nomenclature-t118)
2. [Standard Failure Messages](#standard-failure-messages-t119)
3. [Severity Matrix](#severity-matrix-t120)
4. [Feature Flag Rollout](#feature-flag-rollout-t121)
5. [Manual Testing Procedure](#manual-testing-procedure-t122)
6. [Regression Auditing](#regression-auditing-t123)
7. [Legacy Contract Handling](#legacy-contract-handling-t124-t126)
8. [Elicitor Decision Trees](#elicitor-decision-trees-t127-t129)

---

## 1. Validator Nomenclature (T118)

### Official Validator Names

**Format:** `<SCOPE>_<ACTION>_<OBJECT>`

| Code | Official Name | Shorthand |
|------|---------------|-----------|
| CONTRACT_SCHEMA_VALID | Contract Schema Valid | Schema Valid |
| TEST_CLAUSE_MAPPING_VALID | Test Clause Mapping Valid | Mapping Valid |
| CONTRACT_CLAUSE_COVERAGE | Contract Clause Coverage | Coverage |
| NO_OUT_OF_CONTRACT_ASSERTIONS | No Out-of-Contract Assertions | No Rogue Assertions |

### Usage in Documentation

**Formal contexts (docs, error messages):**
- Use full official name: "Contract Schema Valid"
- Include validator code: "CONTRACT_SCHEMA_VALID"

**Informal contexts (logs, comments):**
- Use shorthand: "Schema Valid failed"
- OK to abbreviate: "Coverage at 80%"

**User-facing messages:**
- Use descriptive language: "Contract structure is invalid"
- Avoid technical jargon: NOT "Zod schema validation failed"

---

## 2. Standard Failure Messages (T119)

### Message Structure

All validator failure messages follow this format:

```
{summary} [{metric}]

{details}

Action required:
- {action 1}
- {action 2}
- {action 3}
```

### CONTRACT_SCHEMA_VALID Failures

**Missing Required Field:**
```
Contract structure is invalid: {N} error(s)

Validation errors:
- mode: Required field missing
- clauses: Must have at least 1 clause

Action required:
- Add required field 'mode' with value "STRICT" or "CREATIVE"
- Add at least one clause to 'clauses' array
- See contract schema: docs/REFERENCE.md
```

**Invalid Clause ID Format:**
```
Contract has invalid clause IDs: {N} invalid ID(s)

Invalid clause IDs:
- CL-auth-001 (should be uppercase: CL-AUTH-001)
- CLAUSE-001 (wrong prefix: should be CL-*)

Action required:
- Fix clause IDs to match format: CL-<TYPE>-<SEQUENCE>
- Type must be uppercase (e.g., AUTH, UI, ENDPOINT)
- Sequence must be 3+ digits (e.g., 001, 042, 123)
```

**Duplicate Clause IDs:**
```
Contract has duplicate clause IDs: {N} duplicate(s)

Duplicate IDs:
- CL-AUTH-001 (appears 2 times)

Action required:
- Ensure all clause IDs are unique
- Rename duplicate clauses with unique sequences
```

### TEST_CLAUSE_MAPPING_VALID Failures

**Invalid Tags:**
```
Found {N} invalid @clause tag(s) referencing non-existent clauses

Invalid tags:
- tests/auth.test.ts:45: @clause CL-AUTH-999 (clause does not exist)
- tests/auth.test.ts:67: @clause CL-AUHT-001 (typo: should be CL-AUTH-001?)

Valid clause IDs in contract:
- CL-AUTH-001
- CL-AUTH-002

Action required:
- Fix typos in @clause tags, OR
- Add missing clauses to contract, OR
- Remove invalid @clause tags
```

### CONTRACT_CLAUSE_COVERAGE Failures

**Insufficient Coverage (STRICT):**
```
Contract clause coverage is {X}% ({covered}/{total} clauses covered)

Uncovered clauses ({N}):
- CL-AUTH-003: Invalid credentials return 401
- CL-AUTH-004: Locked account returns 403

Action required:
- Add @clause tags to tests for uncovered clauses, OR
- Remove unused clauses from contract

Mode: STRICT (100% coverage required)
```

**Insufficient Coverage (CREATIVE):**
```
Contract clause coverage is {X}% ({covered}/{total} clauses covered)

Coverage below minimum for criticality 'high' (90% required)

Uncovered clauses ({N}):
- CL-AUTH-005: Session timeout after 30 minutes

Action required:
- Add tests for uncovered clauses to meet minimum, OR
- Lower criticality level if appropriate, OR
- Accept warning and proceed

Mode: CREATIVE (partial coverage allowed with warning)
```

### NO_OUT_OF_CONTRACT_ASSERTIONS Failures

**Unmapped Assertions (STRICT):**
```
Found {N} unmapped assertion(s) - {X}% coverage

Unmapped assertions ({N}):
- tests/auth.test.ts:78 [expect]: expect(helper()).toBe(true)
- tests/auth.test.ts:92 [assert]: assert.ok(result)

Action required:
- Add @clause tags before tests with unmapped assertions, OR
- Add clauses to contract for these assertions, OR
- Remove assertions if not part of contract

Mode: STRICT (all assertions must be mapped)
```

---

## 3. Severity Matrix (T120)

### Severity by Mode

| Validator | STRICT Mode | CREATIVE Mode | Always Hard |
|-----------|-------------|---------------|-------------|
| CONTRACT_SCHEMA_VALID | FAILED | FAILED | ✅ Yes |
| TEST_CLAUSE_MAPPING_VALID | FAILED | WARNING | No |
| CONTRACT_CLAUSE_COVERAGE | FAILED | WARNING\* | No |
| NO_OUT_OF_CONTRACT_ASSERTIONS | FAILED | WARNING | No |

**\*** WARNING unless criticality=critical (then FAILED)

### Hard-Block Criteria

**Always hard-block (both modes):**
- Invalid contract schema
- Missing required fields
- Duplicate clause IDs
- Invalid clause ID format

**Mode-dependent:**
- Invalid @clause tags: STRICT→FAILED, CREATIVE→WARNING
- Missing coverage: STRICT→FAILED, CREATIVE→WARNING
- Unmapped assertions: STRICT→FAILED, CREATIVE→WARNING

### Criticality Override

**Criticality levels:**
- `low`: 60% minimum coverage (CREATIVE)
- `medium`: 80% minimum coverage (CREATIVE)
- `high`: 90% minimum coverage (CREATIVE)
- `critical`: 100% coverage (overrides CREATIVE mode → acts as STRICT)

**Example:**
```json
{
  "contract": {
    "mode": "CREATIVE",
    "criticality": "critical"
  }
}
```
Result: Functions as STRICT (100% coverage required)

---

## 4. Feature Flag Rollout (T121)

### Current Feature Flags

**Database:** `ValidationConfig` table

| Key | Default | Type | Purpose |
|-----|---------|------|---------|
| CONTRACT_SCHEMA_VALID | `true` | BOOLEAN | Enable schema validation |
| TEST_CLAUSE_MAPPING_VALID | `true` | BOOLEAN | Enable tag validation |
| CONTRACT_CLAUSE_COVERAGE | `true` | BOOLEAN | Enable coverage validation |
| NO_OUT_OF_CONTRACT_ASSERTIONS | `true` | BOOLEAN | Enable assertion mapping |

### Rollout Strategy

**Phase 1: Canary (Week 1)**
- Enable for 10% of validation runs
- Monitor error rates
- Collect feedback on false positives

**Phase 2: Beta (Week 2-3)**
- Enable for 50% of validation runs
- Refine error messages based on feedback
- Document common issues

**Phase 3: General Availability (Week 4+)**
- Enable for 100% of validation runs
- Monitor adoption metrics
- Provide migration support

### Toggling Features

**Via API:**
```bash
curl -X PUT http://localhost:3000/api/config/CONTRACT_SCHEMA_VALID \
  -H "Content-Type: application/json" \
  -d '{"value": "false"}'
```

**Via Database:**
```sql
UPDATE ValidationConfig
SET value = 'false'
WHERE key = 'CONTRACT_SCHEMA_VALID';
```

**Validator Behavior When Disabled:**
Returns SKIPPED (same as when contract absent)

### Emergency Rollback

**If critical issue discovered:**
1. Disable via API: `value = "false"`
2. Restart API server (reloads config)
3. Investigate root cause
4. Fix issue
5. Re-enable with gradual rollout

---

## 5. Manual Testing Procedure (T122)

### Prerequisites

1. Local Gatekeeper API running
2. Test project with Git repository
3. Sample plan.json with contract
4. Sample test file with @clause tags

### Test Procedure

**Step 1: Valid Contract (Should PASS)**

```bash
# Create plan.json
cat > test-plan.json << 'EOF'
{
  "outputId": "test-001",
  "projectPath": "/path/to/test-project",
  "taskPrompt": "Test contract validation",
  "testFilePath": "tests/sample.test.ts",
  "manifest": {
    "files": [{"path": "src/sample.ts", "action": "CREATE"}],
    "testFile": "tests/sample.test.ts"
  },
  "contract": {
    "schemaVersion": "1.0.0",
    "slug": "test-contract",
    "title": "Test Contract",
    "mode": "STRICT",
    "changeType": "new",
    "targetArtifacts": ["src/sample.ts"],
    "clauses": [
      {
        "id": "CL-TEST-001",
        "kind": "behavior",
        "normativity": "MUST",
        "title": "Function returns expected value",
        "spec": "When function called with valid input, returns expected output",
        "observables": ["function-return"]
      }
    ]
  }
}
EOF

# Submit validation
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d @test-plan.json

# Expected: status=PASSED, all 4 contract validators PASSED
```

**Step 2: Invalid Schema (Should FAIL)**

```bash
# Modify contract with invalid mode
jq '.contract.mode = "strict"' test-plan.json > invalid-plan.json

# Submit validation
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d @invalid-plan.json

# Expected: CONTRACT_SCHEMA_VALID fails with mode enum error
```

**Step 3: Missing Coverage (Should FAIL in STRICT)**

```bash
# Add clause without test
jq '.contract.clauses += [{"id": "CL-TEST-002", "kind": "behavior", "normativity": "MUST", "title": "Test", "spec": "...", "observables": ["http"]}]' test-plan.json > no-coverage-plan.json

# Submit validation
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d @no-coverage-plan.json

# Expected: CONTRACT_CLAUSE_COVERAGE fails (only 50% coverage)
```

**Step 4: No Contract (Should SKIP)**

```bash
# Remove contract field
jq 'del(.contract)' test-plan.json > no-contract-plan.json

# Submit validation
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d @no-contract-plan.json

# Expected: All 4 contract validators return SKIPPED
```

### Verification Checklist

- [ ] Valid contract passes all 4 validators
- [ ] Invalid schema fails CONTRACT_SCHEMA_VALID
- [ ] Invalid tags fail TEST_CLAUSE_MAPPING_VALID
- [ ] Missing coverage fails CONTRACT_CLAUSE_COVERAGE (STRICT)
- [ ] Unmapped assertions fail NO_OUT_OF_CONTRACT_ASSERTIONS (STRICT)
- [ ] No contract skips all 4 validators
- [ ] CREATIVE mode returns WARNING (not FAILED)
- [ ] Error messages are actionable

---

## 6. Regression Auditing (T123)

### Audit Procedure

**Frequency:** After each contract validator change

**Steps:**

1. **Collect Baseline Metrics**
```bash
# Query last 100 validation runs before change
SELECT
  validatorCode,
  status,
  COUNT(*) as count,
  AVG(durationMs) as avg_duration
FROM ValidatorResult
WHERE validatorCode LIKE 'CONTRACT%' OR validatorCode = 'NO_OUT_OF_CONTRACT_ASSERTIONS'
  AND createdAt > NOW() - INTERVAL '7 days'
GROUP BY validatorCode, status;
```

2. **Deploy Change**
- Deploy updated validator
- Monitor for 24 hours

3. **Collect Post-Change Metrics**
```bash
# Query same metrics after change
SELECT
  validatorCode,
  status,
  COUNT(*) as count,
  AVG(durationMs) as avg_duration
FROM ValidatorResult
WHERE validatorCode LIKE 'CONTRACT%' OR validatorCode = 'NO_OUT_OF_CONTRACT_ASSERTIONS'
  AND createdAt > NOW() - INTERVAL '1 day'
GROUP BY validatorCode, status;
```

4. **Compare and Analyze**
- Check for unexpected FAILED increase
- Check for performance regression (duration)
- Review error messages for clarity

5. **Regression Indicators**
- FAILED rate increases >10%
- Average duration increases >50%
- New error patterns not in test suite
- User complaints about false positives

6. **Rollback Criteria**
- FAILED rate increases >25%
- Critical bugs discovered
- Performance degradation >2x
- User-blocking issues

---

## 7. Legacy Contract Handling (T124-T126)

### T124: Legacy Contracts (Without contract field)

**Definition:** plan.json files created before contract support

**Behavior:**
- All 4 contract validators return SKIPPED
- No errors or warnings emitted
- Validation proceeds with existing validators
- Fully backward compatible

**Example:**
```json
{
  "outputId": "legacy-001",
  "taskPrompt": "Fix bug in authentication",
  "manifest": {...},
  "testFilePath": "tests/auth.test.ts"
  // No contract field
}
```

**Result:**
- CONTRACT_SCHEMA_VALID: SKIPPED
- TEST_CLAUSE_MAPPING_VALID: SKIPPED
- CONTRACT_CLAUSE_COVERAGE: SKIPPED
- NO_OUT_OF_CONTRACT_ASSERTIONS: SKIPPED
- All other validators: RUN NORMALLY

**Migration Path:**
1. Add minimal contract with existing clauses
2. Tag existing tests with @clause
3. Run validation to verify coverage
4. Iterate until coverage acceptable

---

### T125: Partial Contracts (Incomplete)

**Definition:** Contracts with missing or incomplete fields

**STRICT Mode Behavior:**
- CONTRACT_SCHEMA_VALID: FAILED (missing required fields)
- Other validators: SKIPPED (schema validation failed)
- User must fix schema before proceeding

**CREATIVE Mode Behavior:**
- CONTRACT_SCHEMA_VALID: FAILED (schema always strict)
- Partial coverage: WARNING (allowed)
- Missing clauses: WARNING (allowed)
- User can proceed with warnings

**Example (Partial):**
```json
{
  "contract": {
    "schemaVersion": "1.0.0",
    "slug": "partial-contract",
    "mode": "CREATIVE",
    // Missing: title, changeType, targetArtifacts
    "clauses": [
      {
        "id": "CL-TEST-001"
        // Missing: kind, normativity, title, spec, observables
      }
    ]
  }
}
```

**Result:**
CONTRACT_SCHEMA_VALID: FAILED

**Action:**
Complete required fields or remove contract

---

### T126: Tasks Without Contract (Refactoring)

**Definition:** Tasks that don't change observable behavior

**When to omit contract:**
- Pure refactoring (no behavior change)
- Internal restructuring
- Code cleanup
- Documentation updates
- Test-only changes

**Behavior:**
Same as T124 (legacy contracts) - all contract validators SKIP

**Example:**
```json
{
  "outputId": "refactor-001",
  "taskPrompt": "Refactor authentication module for readability",
  "manifest": {
    "files": [{"path": "src/auth.ts", "action": "MODIFY"}],
    "testFile": "tests/auth.test.ts"
  }
  // No contract (refactor doesn't change behavior)
}
```

**Guideline:**
If tests don't need to change, contract usually not needed.

---

## 8. Elicitor Decision Trees (T127-T129)

### T127: "Should This Be a Contract?" Decision Tree

```
START: Analyzing task
    ↓
Does task change observable behavior?
    ├─ NO → No contract needed (refactor/internal)
    └─ YES
        ↓
    Is behavior testable from outside?
        ├─ NO → No contract (internal implementation detail)
        └─ YES
            ↓
        Does task add/modify/fix:
            - API endpoints?
            - UI components?
            - Business logic?
            - Error handling?
            - Security features?
            ├─ YES → ✅ CONTRACT REQUIRED
            └─ NO → No contract (likely refactor)
```

### T128: Elicitor Checklist - DON'T Generate Contract

**Skip contract generation when:**
- [ ] Task is pure refactoring
- [ ] Task only affects internal implementation
- [ ] Changes are not observable from tests
- [ ] Task is documentation-only
- [ ] Task is test maintenance (no code changes)
- [ ] Task is build/config changes
- [ ] Task is dependency updates
- [ ] Changes are cosmetic (whitespace, formatting)

**Keywords indicating NO contract:**
- "refactor", "reorganize", "restructure"
- "clean up", "improve readability"
- "update dependencies", "upgrade packages"
- "fix typos", "update docs"
- "internal", "private", "helper"

### T129: Elicitor Checklist - MUST Generate Contract

**Contract generation REQUIRED when:**
- [ ] Adding new API endpoints
- [ ] Modifying existing endpoint behavior
- [ ] Adding new UI components
- [ ] Changing UI behavior/rendering
- [ ] Adding business logic rules
- [ ] Modifying validation logic
- [ ] Adding error handling
- [ ] Changing error responses
- [ ] Adding security features
- [ ] Fixing observable bugs (behavior change)

**Keywords indicating contract:**
- "implement", "add", "create"
- "modify behavior", "change response"
- "fix bug" (if observable)
- "endpoint", "API", "route"
- "component", "page", "UI"
- "validation", "error handling"
- "authentication", "authorization"
- "business rule", "constraint"

**Example Decision:**

**Task:** "Refactor authentication logic to use async/await"
- Observable behavior change? NO (same behavior, different syntax)
- Contract? NO

**Task:** "Add password reset endpoint"
- Observable behavior change? YES (new endpoint)
- Testable? YES (HTTP POST /reset-password)
- Contract? YES

**Task:** "Fix login to return 401 instead of 500 for invalid credentials"
- Observable behavior change? YES (different status code)
- Testable? YES (expect 401 response)
- Contract? YES

---

**Version:** 1.0.0
**Status:** ✅ Frozen
**Last Updated:** 2026-01-18
