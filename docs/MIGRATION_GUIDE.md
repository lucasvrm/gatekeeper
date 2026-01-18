# Migration Guide - Contract Validation

**Version:** 1.0.0
**Last Updated:** 2026-01-18

This guide helps teams migrate to Gatekeeper's contract validation system.

---

## Table of Contents

1. [Overview](#overview)
2. [What's Changing](#whats-changing)
3. [Breaking Changes](#breaking-changes)
4. [Migration Path](#migration-path)
5. [Common Errors and Fixes](#common-errors-and-fixes-t117)
6. [Rollback Plan](#rollback-plan)

---

## 1. Overview

Gatekeeper v1.0.0 introduces **optional** contract-based validation with 4 new validators in Gate 1.

**Key Points:**
- ✅ **Backward Compatible**: Old `plan.json` files work unchanged
- ✅ **Opt-In**: Contract field is optional
- ✅ **No Breaking Changes**: Existing validators unchanged
- ✅ **SKIP Behavior**: Contract validators skip when contract absent

---

## 2. What's Changing

### New Features

**1. Contract Field in plan.json (Optional)**
```json
{
  "contract": {
    "schemaVersion": "1.0.0",
    "slug": "feature-name",
    "title": "Feature Title",
    "mode": "STRICT" | "CREATIVE",
    "changeType": "new" | "modify" | "bugfix" | "refactor",
    "targetArtifacts": ["file1.ts", "file2.ts"],
    "clauses": [...]
  }
}
```

**2. Four New Validators (Gate 1)**
- CONTRACT_SCHEMA_VALID (order: 1)
- TEST_CLAUSE_MAPPING_VALID (order: 2)
- CONTRACT_CLAUSE_COVERAGE (order: 3)
- NO_OUT_OF_CONTRACT_ASSERTIONS (order: 4)

**3. Clause Tags in Tests**
```typescript
// @clause CL-<TYPE>-<SEQUENCE>
test('should return JWT', () => {})
```

**4. New Utilities**
- `utils/clauseTagParser.ts` - Parse @clause tags
- `utils/assertionParser.ts` - Detect assertions
- `types/contract.types.ts` - Contract type definitions

### Updated Components

**Schema:**
- `validation.schema.ts`: Added `contract: ContractSchema.optional()`
- `gates.types.ts`: Added 4 new `ValidatorCode` values

**Config:**
- `defaults.ts`: Centralized git ref defaults
- `gates.config.ts`: Gate 1 now has 13 validators (was 9)

**Database:**
- `seed.ts`: Added 4 feature flags for new validators

---

## 3. Breaking Changes

**NONE**

This release is 100% backward compatible:
- Old `plan.json` files (without contract) work unchanged
- All existing validators unchanged
- All APIs unchanged
- All database schemas unchanged

### What Won't Break

✅ Existing validation runs
✅ Existing plan.json files
✅ Existing tests (no tags required)
✅ Existing pipelines
✅ Existing API integrations

---

## 4. Migration Path

### Phase 1: Understanding (Week 1)

**1. Read Documentation**
- `docs/REFERENCE.md` - Complete API reference
- `docs/RULES.md` - Contract.json specification
- `docs/plannerGuide.md` - How to generate contracts
- `docs/TESTS_RULES.md` - Test writing rules

**2. Review Examples**
- `docs/examples/contract_user-authentication-api.json` - API example
- `docs/examples/contract_user-profile-ui.json` - UI example

**3. Understand Modes**
- STRICT: Production-ready, 100% coverage, all mapped
- CREATIVE: Development-friendly, partial coverage, warnings

### Phase 2: Pilot (Week 2-3)

**1. Choose Pilot Feature**
Select a new feature (not existing code) for first contract:
- Small scope (3-5 clauses)
- Clear observable behavior
- Low risk

**2. Write Contract**
```json
{
  "contract": {
    "schemaVersion": "1.0.0",
    "slug": "pilot-feature",
    "title": "Pilot Feature",
    "mode": "CREATIVE",  // Start with CREATIVE
    "changeType": "new",
    "targetArtifacts": ["src/pilot.ts"],
    "clauses": [
      {
        "id": "CL-PILOT-001",
        "kind": "behavior",
        "normativity": "MUST",
        "title": "Feature behaves as expected",
        "spec": "When X happens, then Y occurs",
        "observables": ["http"]
      }
    ]
  }
}
```

**3. Tag Tests**
```typescript
// @clause CL-PILOT-001
test('should behave as expected', () => {
  // Test implementation
})
```

**4. Run Validation**
```bash
POST /api/runs with contract
```

**5. Review Results**
- Check for warnings
- Fix invalid tags
- Improve coverage
- Iterate

### Phase 3: Gradual Adoption (Week 4-8)

**1. Add Contracts to New Features**
- All new endpoints → contract
- All new UI components → contract
- All behavior changes → contract
- Refactoring → no contract

**2. Backfill Important Features**
- Start with critical paths (auth, payments)
- Use CREATIVE mode for existing features
- Accept partial coverage (80%+)
- Improve over time

**3. Train Team**
- Share documentation
- Conduct workshop
- Pair on first contracts
- Review PRs with contracts

### Phase 4: Enforcement (Week 9+)

**1. Make Contracts Required for:**
- New API endpoints
- New UI features
- Security changes
- Critical bug fixes

**2. Configure CI/CD**
- Fail builds if contract invalid
- Require 90%+ coverage for STRICT
- Allow 70%+ coverage for CREATIVE

**3. Monitor Adoption**
```sql
SELECT
  COUNT(*) FILTER (WHERE contract IS NOT NULL) as with_contract,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE contract IS NOT NULL) / COUNT(*), 2) as adoption_pct
FROM ValidationRun
WHERE createdAt > NOW() - INTERVAL '30 days';
```

---

## 5. Common Errors and Fixes (T117)

### Error 1: Invalid Enum Value

**Error Message:**
```
CONTRACT_SCHEMA_VALID: FAILED
Contract structure is invalid: 1 error(s)
- mode: Invalid enum value. Expected 'STRICT' | 'CREATIVE', received 'strict'
```

**Cause:**
Lowercase enum value

**Fix:**
```json
{
  "mode": "STRICT"  // ✅ Uppercase
}
```

**NOT:**
```json
{
  "mode": "strict"  // ❌ Lowercase
}
```

---

### Error 2: Invalid Clause ID Format

**Error Message:**
```
CONTRACT_SCHEMA_VALID: FAILED
Clause ID must follow format: CL-<TYPE>-<SEQUENCE>
- clauses.0.id: Invalid format (received: "CL-auth-001")
```

**Cause:**
Lowercase type in clause ID

**Fix:**
```json
{
  "id": "CL-AUTH-001"  // ✅ Uppercase TYPE
}
```

**NOT:**
```json
{
  "id": "CL-auth-001"  // ❌ Lowercase
  "id": "CLAUSE-001"   // ❌ Wrong prefix
  "id": "CL-AUTH-1"    // ❌ Only 1 digit (need 3+)
}
```

---

### Error 3: Missing Required Fields

**Error Message:**
```
CONTRACT_SCHEMA_VALID: FAILED
Contract structure is invalid: 3 error(s)
- title: Required
- changeType: Required
- clauses: Required (must have at least 1)
```

**Cause:**
Missing required fields

**Fix:**
Add all required fields:
```json
{
  "schemaVersion": "1.0.0",  // Required
  "slug": "my-feature",       // Required
  "title": "My Feature",      // Required
  "mode": "STRICT",           // Required
  "changeType": "new",        // Required
  "targetArtifacts": ["..."], // Required
  "clauses": [...]            // Required (min 1)
}
```

---

### Error 4: Tag References Non-Existent Clause

**Error Message:**
```
TEST_CLAUSE_MAPPING_VALID: FAILED (STRICT) / WARNING (CREATIVE)
Found 1 invalid @clause tag(s)
- tests/auth.test.ts:45: @clause CL-AUTH-999 (clause does not exist)

Valid clause IDs: CL-AUTH-001, CL-AUTH-002
```

**Cause:**
Test references clause that doesn't exist in contract

**Fix Option 1 (Fix typo):**
```typescript
// @clause CL-AUTH-001  // ✅ Use existing clause
test('should login', () => {})
```

**Fix Option 2 (Add clause):**
```json
{
  "clauses": [
    {"id": "CL-AUTH-001", ...},
    {"id": "CL-AUTH-999", ...}  // ✅ Add missing clause
  ]
}
```

---

### Error 5: Coverage Below 100% (STRICT)

**Error Message:**
```
CONTRACT_CLAUSE_COVERAGE: FAILED
Coverage is 66.7% (2/3 clauses covered)

Uncovered clauses (1):
- CL-AUTH-003: Password reset returns email sent
```

**Cause:**
STRICT mode requires 100% coverage, but only 66.7% achieved

**Fix Option 1 (Add test):**
```typescript
// @clause CL-AUTH-003
test('should send email for password reset', () => {
  // Test password reset
})
```

**Fix Option 2 (Remove clause):**
```json
{
  "clauses": [
    {"id": "CL-AUTH-001", ...},
    {"id": "CL-AUTH-002", ...}
    // Remove CL-AUTH-003 if not needed
  ]
}
```

**Fix Option 3 (Switch to CREATIVE):**
```json
{
  "mode": "CREATIVE",  // Allows partial coverage with WARNING
  "criticality": "medium"  // 80% minimum
}
```

---

### Error 6: Unmapped Assertions (STRICT)

**Error Message:**
```
NO_OUT_OF_CONTRACT_ASSERTIONS: FAILED
Found 3 unmapped assertion(s)

Unmapped assertions:
- tests/auth.test.ts:78 [expect]: expect(helper()).toBe(true)
```

**Cause:**
Test has assertions but no @clause tag

**Fix Option 1 (Add tag):**
```typescript
// @clause CL-UTIL-001
test('helper works', () => {
  expect(helper()).toBe(true)
})
```

**Fix Option 2 (Add clause):**
```json
{
  "clauses": [
    {
      "id": "CL-UTIL-001",
      "kind": "behavior",
      "normativity": "SHOULD",
      "title": "Helper function works",
      "spec": "...",
      "observables": ["function-return"]
    }
  ]
}
```

**Fix Option 3 (Remove assertion if not needed):**
```typescript
test('helper exists', () => {
  expect(helper).toBeDefined()  // Structural only (less strict)
})
```

---

### Error 7: Duplicate Clause IDs

**Error Message:**
```
CONTRACT_SCHEMA_VALID: FAILED
Contract has duplicate clause IDs: 1 duplicate(s)
- CL-AUTH-001 (appears 2 times)
```

**Cause:**
Two clauses with same ID

**Fix:**
Rename one clause:
```json
{
  "clauses": [
    {"id": "CL-AUTH-001", "title": "Login succeeds"},
    {"id": "CL-AUTH-002", "title": "Login fails"}  // ✅ Unique ID
  ]
}
```

**NOT:**
```json
{
  "clauses": [
    {"id": "CL-AUTH-001", "title": "Login succeeds"},
    {"id": "CL-AUTH-001", "title": "Login fails"}  // ❌ Duplicate
  ]
}
```

---

### Error 8: Missing negativeCases for Error Clauses

**Error Message:**
```
CONTRACT_SCHEMA_VALID: WARNING
Error clauses should have negativeCases defined
```

**Cause:**
Clause with `kind: "error"` has no `negativeCases`

**Fix:**
```json
{
  "id": "CL-AUTH-002",
  "kind": "error",
  "normativity": "MUST",
  "title": "Invalid credentials return 401",
  "spec": "...",
  "observables": ["http"],
  "negativeCases": [  // ✅ Add negative cases
    "Wrong password returns 401",
    "Non-existent user returns 401"
  ]
}
```

---

## 6. Rollback Plan

### If Contract Validation Causes Issues

**Option 1: Disable Specific Validator**
```bash
curl -X PUT http://localhost:3000/api/config/CONTRACT_SCHEMA_VALID \
  -H "Content-Type: application/json" \
  -d '{"value": "false"}'
```

**Option 2: Disable All Contract Validators**
```sql
UPDATE ValidationConfig
SET value = 'false'
WHERE key IN (
  'CONTRACT_SCHEMA_VALID',
  'TEST_CLAUSE_MAPPING_VALID',
  'CONTRACT_CLAUSE_COVERAGE',
  'NO_OUT_OF_CONTRACT_ASSERTIONS'
);
```

**Option 3: Remove Contract from plan.json**
Simply delete the `contract` field - validators will SKIP

**Option 4: Git Rollback (Nuclear)**
```bash
git revert <commit-hash>  # Revert contract validation changes
```

### Monitoring During Migration

**Metrics to track:**
- Contract adoption rate (% of runs with contract)
- Validation failure rate (before/after)
- Average validation duration
- Common error types

**Alerts:**
- FAILED rate > 25% (investigate)
- Duration > 2x baseline (performance issue)
- Same error repeated > 10 times (documentation gap)

---

## 7. FAQ

**Q: Do I need to add contracts to all existing features?**
A: No. Contracts are optional. Add them to new features first, then backfill critical paths.

**Q: What happens to old plan.json files without contracts?**
A: They work exactly as before. All contract validators SKIP.

**Q: Can I use CREATIVE mode in production?**
A: Yes, but only for low-risk features. Use STRICT for critical paths.

**Q: How do I know if a task needs a contract?**
A: See `docs/OPERATIONAL_PROCEDURES.md` section "Elicitor Decision Trees"

**Q: Can I disable contract validation?**
A: Yes, via feature flags in ValidationConfig table.

**Q: What if I disagree with a validator result?**
A: File an issue with example plan.json and expected behavior.

---

**Version:** 1.0.0
**Status:** ✅ Frozen
**Last Updated:** 2026-01-18
