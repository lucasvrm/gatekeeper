# RULES.md Addendum - Contract Validators

**This content should be appended to RULES.md**

---

## 11. Contract Validators Catalog (T102)

Gatekeeper implements 4 specialized validators for contract-based testing. All validators are in Gate 1 (CONTRACT gate).

### CONTRACT_SCHEMA_VALID

**Code:** `CONTRACT_SCHEMA_VALID`
**Gate:** 1
**Order:** 1
**Hard Block:** Yes (always)
**File:** `packages/gatekeeper-api/src/domain/validators/gate1/ContractSchemaValid.ts`

**Purpose:**
Validates the structure of the `contract` field when present in `plan.json`.

**Validation Logic:**
1. Validates contract against Zod schema (ContractSchema)
2. Checks for duplicate clause IDs
3. Validates clause ID format (`CL-<TYPE>-<SEQUENCE>`)
4. Ensures required fields are present

**Behavior:**
- **SKIPPED:** When `contract` field is absent (T103)
- **FAILED:** When contract structure is invalid or has duplicate IDs
- **PASSED:** When contract is valid

**Example Failures:**
- Missing required field: `mode` is required
- Invalid clause ID: `CL-auth-001` (should be `CL-AUTH-001`)
- Duplicate IDs: Two clauses with `CL-AUTH-001`

---

### TEST_CLAUSE_MAPPING_VALID

**Code:** `TEST_CLAUSE_MAPPING_VALID`
**Gate:** 1
**Order:** 2
**Hard Block:** Mode-dependent (T100)
**File:** `packages/gatekeeper-api/src/domain/validators/gate1/TestClauseMappingValid.ts`

**Purpose:**
Validates that all `@clause` tags in test files reference valid clause IDs from the contract.

**Validation Logic:**
1. Parse `@clause` tags from test file using regex
2. Extract referenced clause IDs
3. Check each ID against `contract.clauses[].id`
4. Report invalid tags (tags referencing non-existent clauses)

**Tag Format:** `// @clause CL-<TYPE>-<SEQUENCE>`
**Regex:** `/^\s*\/\/\s*@clause\s+(CL-[A-Z_]+-\d{3,})\s*$/`

**Behavior:**
- **SKIPPED:** When `contract` field is absent (T103)
- **FAILED (STRICT mode):** When invalid tags found (T100)
- **WARNING (CREATIVE mode):** When invalid tags found (T104)
- **PASSED:** When all tags reference valid clauses

**Example Failures:**
- Tag references non-existent clause: `@clause CL-AUTH-999`
- Typo in clause ID: `@clause CL-AUHT-001` (should be `CL-AUTH-001`)

**Prohibition (T100):**
In STRICT mode, tests CANNOT reference clauses that don't exist in the contract. This ensures strict contract adherence.

---

### CONTRACT_CLAUSE_COVERAGE

**Code:** `CONTRACT_CLAUSE_COVERAGE`
**Gate:** 1
**Order:** 3
**Hard Block:** Mode-dependent
**File:** `packages/gatekeeper-api/src/domain/validators/gate1/ContractClauseCoverage.ts`

**Purpose:**
Validates that all contract clauses have at least one test mapping via `@clause` tags.

**Validation Logic:**
1. Parse all `@clause` tags from test file
2. Group tags by clause ID
3. Calculate coverage: (covered clauses) / (total clauses)
4. Identify uncovered clauses
5. Check coverage against requirements

**Coverage Requirements:**
- **STRICT mode:** 100% coverage required
- **CREATIVE mode (by criticality):**
  - `low`: 60% minimum
  - `medium`: 80% minimum
  - `high`: 90% minimum
  - `critical`: 100% minimum (overrides CREATIVE)

**Behavior:**
- **SKIPPED:** When `contract` field is absent (T103)
- **FAILED (STRICT mode):** When coverage < 100% (T100)
- **WARNING (CREATIVE mode):** When coverage < minimum for criticality (T104)
- **PASSED:** When coverage meets requirements

**Example Failures:**
- STRICT mode: 2 of 3 clauses covered (66.7%) → FAILED
- CREATIVE/high: 8 of 10 clauses covered (80%) → WARNING (needs 90%)

---

### NO_OUT_OF_CONTRACT_ASSERTIONS

**Code:** `NO_OUT_OF_CONTRACT_ASSERTIONS`
**Gate:** 1
**Order:** 4
**Hard Block:** Mode-dependent (T101)
**File:** `packages/gatekeeper-api/src/domain/validators/gate1/NoOutOfContractAssertions.ts`

**Purpose:**
Validates that all test assertions are mapped to contract clauses (no "rogue" assertions).

**Validation Logic:**
1. Parse all assertions from test file (expect, assert, snapshot, mock, etc.)
2. Map assertions to nearby `@clause` tags (within 50 lines above)
3. Identify unmapped assertions
4. Calculate mapping percentage

**Assertion Types Detected:**
- `expect()`: Expect-style assertions
- `assert()`: Assert-style assertions
- Snapshots: `toMatchSnapshot()`, `toMatchInlineSnapshot()`
- Mocks: `toHaveBeenCalled()`, `toHaveBeenCalledWith()`
- Structural: `toBeDefined()`, `toBeNull()`, etc.

**Mapping Heuristic:**
- Assertion mapped to nearest `@clause` tag within 50 lines above it
- Multiple tags within 5 lines of each other are all applied to following assertions

**Behavior:**
- **SKIPPED:** When `contract` field is absent (T103)
- **FAILED (STRICT mode):** When unmapped assertions found (T101)
- **WARNING (CREATIVE mode):** When unmapped assertions found (T104)
- **PASSED:** When all assertions mapped

**Example Violations and Corrections:**
```typescript
// ❌ STRICT mode violation
test('should work', () => {
  // No @clause tag above
  expect(result).toBe(true)  // Unmapped assertion → FAILED
})

// ✅ STRICT mode compliant
// @clause CL-FEATURE-001
test('should work', () => {
  expect(result).toBe(true)  // Mapped to CL-FEATURE-001
})
```

**Prohibition (T101):**
In STRICT mode, assertions CANNOT exist outside the `assertionSurface` defined by contract clauses. All assertions must be mapped via `@clause` tags.

---

## 12. Contract Absence Behavior (T103)

### Overview

When the `contract` field is **absent** from `plan.json`, all 4 contract validators behave identically:

**Return:**
```json
{
  "passed": true,
  "status": "SKIPPED",
  "message": "No contract provided - validation skipped"
}
```

### Rationale

- **Backward compatibility:** Old `plan.json` files without contracts work unchanged
- **Optional feature:** Contracts are opt-in, not required
- **No false positives:** Absence of contract doesn't mean failure

### Implications

- Pipeline continues to next validator
- No warnings or errors emitted
- Existing non-contract validators run normally
- No changes to overall validation behavior

### Example

```json
{
  "outputId": "task-001",
  "taskPrompt": "Refactor authentication module",
  "manifest": {...},
  "testFilePath": "tests/auth.test.ts"
  // No "contract" field
}
```

**Result:**
- CONTRACT_SCHEMA_VALID: SKIPPED
- TEST_CLAUSE_MAPPING_VALID: SKIPPED
- CONTRACT_CLAUSE_COVERAGE: SKIPPED
- NO_OUT_OF_CONTRACT_ASSERTIONS: SKIPPED
- TEST_SYNTAX_VALID: RUNS (normal validator)
- ... (pipeline continues)

---

## 13. CREATIVE Mode Clarifications (T104)

### Overview

CREATIVE mode allows iterative development with partial contracts while still providing valuable feedback through warnings.

### Behavior Differences

| Validator | STRICT Mode | CREATIVE Mode |
|-----------|-------------|---------------|
| CONTRACT_SCHEMA_VALID | FAILED on invalid | FAILED on invalid (always strict) |
| TEST_CLAUSE_MAPPING_VALID | FAILED on invalid tags | **WARNING** on invalid tags |
| CONTRACT_CLAUSE_COVERAGE | FAILED on < 100% | **WARNING** on < min% (criticality) |
| NO_OUT_OF_CONTRACT_ASSERTIONS | FAILED on unmapped | **WARNING** on unmapped |

### Allowances in CREATIVE Mode

**1. Partial Coverage:**
```json
{
  "contract": {
    "mode": "CREATIVE",
    "criticality": "medium",  // 80% minimum
    "clauses": [
      {"id": "CL-AUTH-001"},  // Has test ✅
      {"id": "CL-AUTH-002"},  // Has test ✅
      {"id": "CL-AUTH-003"}   // No test ⚠️ WARNING (80% coverage OK)
    ]
  }
}
```

**2. Unmapped Tests:**
```typescript
// ⚠️ WARNING in CREATIVE (allowed)
test('exploratory test', () => {
  // No @clause tag
  expect(feature.works()).toBe(true)
})

// ✅ Also allowed
// @clause CL-FEATURE-001
test('contract test', () => {
  expect(behavior).toMatch(spec)
})
```

**3. Invalid Tags (with warning):**
```typescript
// ⚠️ WARNING in CREATIVE (typo in clause ID)
// @clause CL-AUHT-001  // Typo: should be CL-AUTH-001
test('should authenticate', () => {
  // Test runs, but warning emitted
})
```

**4. Unmapped Assertions:**
```typescript
// ⚠️ WARNING in CREATIVE
test('some helper', () => {
  // No @clause tag above
  expect(helper()).toBe(true)  // Unmapped → WARNING only
})
```

### Still Hard-Blocked in CREATIVE

**CONTRACT_SCHEMA_VALID always strict:**
```json
// ❌ FAILED in both STRICT and CREATIVE
{
  "contract": {
    "mode": "CREATIVE",
    "slug": "Invalid Slug",  // ❌ Invalid format (should be kebab-case)
    "clauses": []             // ❌ Requires at least 1 clause
  }
}
```

### When to Use CREATIVE

**Recommended for:**
- UI/UX features with exploratory testing
- Prototypes and proof-of-concepts
- Iterative development (contract evolves with code)
- Internal tools with lower risk
- Refactoring with behavior changes

**Not recommended for:**
- Production APIs
- Security-critical features
- Payment processing
- Authentication/authorization
- Data integrity features

---

## 14. STRICT Mode Prohibitions (T100, T101)

### Prohibition 1: Tests Without Clause Tags (T100)

**Rule:**
In STRICT mode, every test MUST have at least one `@clause` tag.

**Rationale:**
Ensures all tests are traceable to contract requirements. No "rogue" tests.

**Enforcement:**
- Validator: NO_OUT_OF_CONTRACT_ASSERTIONS
- Status: FAILED (in STRICT mode)

**Example Violation:**
```typescript
// ❌ FAILED in STRICT mode
test('should handle edge case', () => {
  // No @clause tag
  expect(result).toBeDefined()
})
```

**Correction:**
```typescript
// ✅ PASS in STRICT mode
// @clause CL-EDGE-001
test('should handle edge case', () => {
  expect(result).toBeDefined()
})
```

**Exemptions:**
Tests matching `testMapping.untaggedAllowlist` patterns are exempt:
```json
{
  "contract": {
    "testMapping": {
      "untaggedAllowlist": ["beforeEach", "afterEach", "test setup"]
    }
  }
}
```

---

### Prohibition 2: Assertions Outside assertionSurface (T101)

**Rule:**
In STRICT mode, all assertions MUST be within tests that have `@clause` tags.

**Rationale:**
Ensures all validations are part of the defined contract. No untraceable assertions.

**Enforcement:**
- Validator: NO_OUT_OF_CONTRACT_ASSERTIONS
- Status: FAILED (in STRICT mode)

**Example Violation:**
```typescript
// ❌ FAILED in STRICT mode
test('helper function works', () => {
  // No @clause tag, but has assertion
  expect(helper.calculate(5)).toBe(10)  // Unmapped assertion → FAILED
})
```

**Correction (Option 1 - Add to contract):**
```typescript
// ✅ Add clause to contract and tag test
// @clause CL-UTIL-001
test('helper function works', () => {
  expect(helper.calculate(5)).toBe(10)
})
```

```json
{
  "clauses": [
    {
      "id": "CL-UTIL-001",
      "kind": "behavior",
      "normativity": "SHOULD",
      "title": "Helper calculates correctly",
      "spec": "...",
      "observables": ["function-return"]
    }
  ]
}
```

**Correction (Option 2 - Remove assertion):**
```typescript
// ✅ No assertion, no violation
test('helper exists', () => {
  expect(helper.calculate).toBeDefined()  // Structural check OK
})
```

**Correction (Option 3 - Switch to CREATIVE mode):**
```json
{
  "contract": {
    "mode": "CREATIVE"  // Unmapped assertions → WARNING only
  }
}
```

---

**END OF ADDENDUM - Append to RULES.md**
