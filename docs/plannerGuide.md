# Planner Guide - Generating Valid plan.json

**Version:** 1.0.0
**Audience:** LLM agents generating plan.json for Gatekeeper validation
**Last Updated:** 2026-01-18

This guide ensures Planners generate valid, complete `plan.json` files that pass Gatekeeper validation.

---

## Table of Contents

1. [Template](#template)
2. [Strict Rules](#strict-rules)
3. [Clause Tag Convention](#clause-tag-convention)
4. [STRICT vs CREATIVE Mode](#strict-vs-creative-mode)
5. [Pre-Delivery Checklist](#pre-delivery-checklist)
6. [Common Mistakes](#common-mistakes)
7. [Contract Pipeline Responsibilities](#contract-pipeline-responsibilities)
8. [Decision Checklists](#decision-checklists)
9. [Clause & Assertion Guidance](#clause--assertion-guidance)
10. [Quick Reference Commands](#quick-reference-commands)

---

## Template (T095)

### Complete plan.json Template

```json
{
  "outputId": "<unique-identifier>",
  "projectPath": "<absolute-path-to-project-root>",
  "taskPrompt": "<task-description-min-10-chars>",
  "testFilePath": "<relative-path-to-test-file>",
  "manifest": {
    "files": [
      {
        "path": "<relative-path-to-file>",
        "action": "CREATE" | "MODIFY" | "DELETE",
        "reason": "<optional-justification>"
      }
    ],
    "testFile": "<same-as-testFilePath>"
  },
  "baseRef": "origin/main",
  "targetRef": "HEAD",
  "dangerMode": false,
  "runType": "CONTRACT",
  "contract": {
    "schemaVersion": "1.0.0",
    "slug": "<kebab-case-identifier>",
    "title": "<human-readable-title>",
    "mode": "STRICT" | "CREATIVE",
    "changeType": "new" | "modify" | "bugfix" | "refactor",
    "targetArtifacts": [
      "<file-path-or-glob>"
    ],
    "clauses": [
      {
        "id": "CL-<TYPE>-<SEQUENCE>",
        "kind": "behavior" | "error" | "invariant" | "constraint" | "security" | "ui",
        "normativity": "MUST" | "SHOULD" | "MAY",
        "title": "<short-stable-title>",
        "spec": "<testable-specification>",
        "observables": ["http" | "ui" | "db-effect" | "event" | "file" | "log"],
        "when": ["<optional-precondition>"],
        "inputs": {"<param>": "<constraint>"},
        "outputs": {"<field>": "<constraint>"},
        "negativeCases": ["<sad-path-description>"],
        "tags": ["<lowercase-tag>"]
      }
    ]
  }
}
```

### Minimal plan.json (No Contract)

```json
{
  "outputId": "task-001",
  "projectPath": "/absolute/path/to/project",
  "taskPrompt": "Implement user login functionality",
  "testFilePath": "tests/auth.test.ts",
  "manifest": {
    "files": [
      {
        "path": "src/auth.ts",
        "action": "CREATE",
        "reason": "New authentication module"
      }
    ],
    "testFile": "tests/auth.test.ts"
  }
}
```

**Note:** Fields `baseRef`, `targetRef`, `dangerMode`, `runType` use defaults if omitted.

---

## Strict Rules (T096)

### RULE 1: Never Invent Fields

**❌ PROHIBITED:**
```json
{
  "customField": "value",        // ❌ Not in schema
  "myMetadata": {},              // ❌ Not in schema
  "extraInfo": "...",            // ❌ Not in schema
  "contract": {
    "newField": "value"          // ❌ Not in contract schema
  }
}
```

**✅ ALLOWED:**
Only fields documented in `docs/REFERENCE.md` and `docs/RULES.md`.

### RULE 2: Respect Exact Field Names

**❌ PROHIBITED:**
```json
{
  "output_id": "...",            // ❌ Wrong casing (should be outputId)
  "task_prompt": "...",          // ❌ Wrong casing (should be taskPrompt)
  "contract": {
    "schemaVer": "1.0.0"         // ❌ Wrong name (should be schemaVersion)
  }
}
```

**✅ ALLOWED:**
```json
{
  "outputId": "...",
  "taskPrompt": "...",
  "contract": {
    "schemaVersion": "1.0.0"
  }
}
```

### RULE 3: Respect Required Fields

**Required in plan.json:**
- `outputId`
- `projectPath`
- `taskPrompt` (min 10 characters)
- `testFilePath`
- `manifest.files[]` (min 1 file)
- `manifest.testFile`

**Required in contract (if present):**
- `schemaVersion`
- `slug`
- `title`
- `mode`
- `changeType`
- `targetArtifacts[]` (min 1)
- `clauses[]` (min 1)

**Required in each clause:**
- `id` (format: `CL-<TYPE>-<SEQUENCE>`)
- `kind`
- `normativity`
- `title`
- `spec`
- `observables[]` (min 1)

### RULE 4: Respect Enums

**Exact values only:**

**manifest.files[].action:**
- `"CREATE"` | `"MODIFY"` | `"DELETE"` (uppercase only)

**contract.mode:**
- `"STRICT"` | `"CREATIVE"` (uppercase only)

**contract.changeType:**
- `"new"` | `"modify"` | `"bugfix"` | `"refactor"` (lowercase only)

**contract.clauses[].kind:**
- `"behavior"` | `"error"` | `"invariant"` | `"constraint"` | `"security"` | `"ui"`

**contract.clauses[].normativity:**
- `"MUST"` | `"SHOULD"` | `"MAY"` (uppercase only)

**contract.clauses[].observables[]:**
- `"http"` | `"ui"` | `"db-effect"` | `"event"` | `"file"` | `"log"`

### RULE 5: Respect Formats

**Clause ID format:**
```
CL-<TYPE>-<SEQUENCE>
```
- `<TYPE>`: Uppercase letters and underscores (e.g., `AUTH`, `USER_PROFILE`)
- `<SEQUENCE>`: 3+ digits (e.g., `001`, `042`, `1234`)
- Examples: `CL-AUTH-001`, `CL-UI-012`, `CL-ENDPOINT-042`

**Slug format:**
```
lowercase-kebab-case
```
- Pattern: `/^[a-z0-9]+(-[a-z0-9]+)*$/`
- Max length: 64 characters
- Examples: `user-authentication`, `profile-update-api`

---

## Clause Tag Convention (T097)

### Overview

When generating test files, Planners MUST include `@clause` tags to map tests to contract clauses.

### Tag Format

```typescript
// @clause CL-<TYPE>-<SEQUENCE>
```

**Regex:** `/^\s*\/\/\s*@clause\s+(CL-[A-Z_]+-\d{3,})\s*$/`

### Placement Rules

1. **Above test block:** Place tag on line immediately before `test()` or `it()`
2. **Multiple tags:** Multiple tags for same test are allowed
3. **Grouping:** Tags within 5 lines of each other are grouped
4. **Proximity:** Assertions within 50 lines below a tag are mapped to it

### Examples

**Single tag:**
```typescript
// @clause CL-AUTH-001
test('should return JWT on successful login', async () => {
  const response = await login('user@example.com', 'password123')
  expect(response.status).toBe(200)
  expect(response.body.token).toBeDefined()
})
```

**Multiple tags (test validates multiple clauses):**
```typescript
// @clause CL-AUTH-001
// @clause CL-AUTH-003
test('should return JWT and log event', async () => {
  const response = await login('user@example.com', 'password123')
  expect(response.status).toBe(200)           // Validates CL-AUTH-001
  expect(logs).toContain('USER_LOGGED_IN')   // Validates CL-AUTH-003
})
```

**Error handling:**
```typescript
// @clause CL-AUTH-002
test('should return 401 for invalid password', async () => {
  const response = await login('user@example.com', 'wrongpassword')
  expect(response.status).toBe(401)
  expect(response.body.errorCode).toBe('AUTH_INVALID_CREDENTIALS')
})
```

### Tag Validation

**Valid tags:**
- `// @clause CL-AUTH-001`
- `// @clause CL-UI-042`
- `//   @clause   CL-ENDPOINT-123` (whitespace allowed)

**Invalid tags:**
- `// @clause CL-auth-001` (lowercase type)
- `// @clause CL-AUTH-1` (less than 3 digits)
- `// clause CL-AUTH-001` (missing @)
- `/* @clause CL-AUTH-001 */` (block comment not supported)

---

## STRICT vs CREATIVE Mode (T098)

### Comparison Table

| Aspect | STRICT Mode | CREATIVE Mode |
|--------|-------------|---------------|
| **Coverage** | 100% required | Partial allowed (criticality-based) |
| **Unmapped tests** | ❌ Not allowed | ⚠️ Allowed with warning |
| **Unmapped assertions** | ❌ Not allowed | ⚠️ Allowed with warning |
| **Invalid tags** | ❌ FAILED | ⚠️ WARNING |
| **Incomplete clauses** | ❌ FAILED | ⚠️ WARNING |
| **Use case** | Production APIs, security features | UI, prototypes, exploration |

### When to Use STRICT

**Use STRICT for:**
- Backend APIs with contracts
- Authentication/authorization systems
- Payment processing
- Data integrity features
- Security-critical features
- Production-facing changes

**Example:**
```json
{
  "contract": {
    "mode": "STRICT",
    "criticality": "high",
    "changeType": "new"
  }
}
```

### When to Use CREATIVE

**Use CREATIVE for:**
- UI/UX features
- Prototypes and experiments
- Iterative development
- Refactoring without behavior change
- Internal tools
- Low-risk changes

**Example:**
```json
{
  "contract": {
    "mode": "CREATIVE",
    "criticality": "medium",
    "changeType": "modify"
  }
}
```

### Impact on Tags and Coverage (T098)

#### STRICT Mode Requirements

**All tests MUST have tags:**
```typescript
// ❌ FAILED in STRICT
test('should work', () => {
  // No @clause tag → FAILED
  expect(true).toBe(true)
})

// ✅ PASS in STRICT
// @clause CL-FEATURE-001
test('should work', () => {
  expect(true).toBe(true)
})
```

**All clauses MUST have tests:**
```json
{
  "clauses": [
    {
      "id": "CL-AUTH-001",
      "title": "User receives JWT"
      // Must have at least one test with @clause CL-AUTH-001
    },
    {
      "id": "CL-AUTH-002",
      "title": "Invalid credentials return 401"
      // Must have at least one test with @clause CL-AUTH-002
    }
  ]
}
```

**All assertions MUST be within tagged tests:**
```typescript
// ❌ FAILED in STRICT
test('helper function works', () => {
  // No @clause tag, but has assertion → FAILED
  expect(helper()).toBe(true)
})

// ✅ PASS in STRICT
// @clause CL-UTIL-001
test('helper function works', () => {
  expect(helper()).toBe(true)
})
```

#### CREATIVE Mode Allowances

**Untagged tests emit WARNING (not FAILED):**
```typescript
// ⚠️ WARNING in CREATIVE (allowed)
test('exploratory test', () => {
  // No tag → WARNING only
  expect(feature.works()).toBe(true)
})
```

**Partial coverage emits WARNING:**
```json
// ⚠️ WARNING if only 70% of clauses have tests
{
  "mode": "CREATIVE",
  "criticality": "medium",  // 80% minimum
  "clauses": [
    // 10 clauses total, only 7 have tests → WARNING
  ]
}
```

**Unmapped assertions emit WARNING:**
```typescript
// ⚠️ WARNING in CREATIVE
test('some behavior', () => {
  // No @clause tag above
  expect(result).toBe(expected)  // Unmapped assertion → WARNING
})
```

---

## Pre-Delivery Checklist (T099)

### Before Generating plan.json

**Contract Decision:**
- [ ] Task involves observable behavior change? → Include contract
- [ ] Task is pure refactor (no behavior change)? → Omit contract
- [ ] Task adds new endpoints/UI? → MUST include contract
- [ ] Task is bugfix? → Include contract if fixing observable behavior

### Contract Quality Checks

**If contract present:**

**Schema:**
- [ ] `schemaVersion` is `"1.0.0"`
- [ ] `slug` is valid kebab-case (max 64 chars)
- [ ] `title` is descriptive (max 120 chars)
- [ ] `mode` is `"STRICT"` or `"CREATIVE"` (see decision tree)
- [ ] `changeType` matches actual change
- [ ] `targetArtifacts` lists primary files
- [ ] `clauses` array has at least 1 clause

**Clauses:**
- [ ] Each clause has valid `id` format (`CL-<TYPE>-<SEQUENCE>`)
- [ ] No duplicate clause IDs
- [ ] Each clause has `kind`, `normativity`, `title`, `spec`, `observables`
- [ ] Error clauses (`kind: "error"`) have `negativeCases[]`
- [ ] Security clauses (`kind: "security"`) have `negativeCases[]`
- [ ] `spec` describes observable behavior (not implementation)
- [ ] `spec` is testable and unambiguous
- [ ] `observables` matches where tests will actually observe

**Coverage:**
- [ ] Number of clauses ≤ 100 (max limit)
- [ ] Number of clauses ≥ 3 (recommended minimum)
- [ ] Each MUST clause has at least 1 test planned
- [ ] Each error clause has at least 1 negative test planned
- [ ] Each security clause has at least 1 negative test planned

### Test File Quality Checks

**Tag Coverage (STRICT mode):**
- [ ] Every test has at least one `@clause` tag
- [ ] Every clause ID appears in at least one tag
- [ ] No tags reference non-existent clause IDs
- [ ] Tag format is exact: `// @clause CL-<TYPE>-<SEQUENCE>`

**Tag Coverage (CREATIVE mode):**
- [ ] All MUST clauses have at least one tag
- [ ] All error clauses have at least one tag
- [ ] All security clauses have at least one tag
- [ ] Coverage ≥ minimum for criticality level

**Test Quality:**
- [ ] Test has assertions (expect, assert, toBe, etc.)
- [ ] Test covers happy path (for behavior clauses)
- [ ] Test covers sad path (for error clauses)
- [ ] Test is not decorative (not empty, not snapshot-only)
- [ ] Test description matches clause title (traceability)

### Manifest Quality Checks

- [ ] `manifest.testFile` matches `testFilePath`
- [ ] All files have valid `action` (CREATE/MODIFY/DELETE)
- [ ] Number of files ≤ 10 (MAX_FILES_PER_TASK)
- [ ] No glob patterns in file paths (must be explicit)
- [ ] No sensitive files unless `dangerMode: true`
- [ ] No vague terms ("etc", "related files", "other files")

### Task Prompt Quality Checks

- [ ] Length ≥ 10 characters
- [ ] No ambiguous terms ("melhore", "otimize", "refatore", "arrume", "ajuste")
- [ ] References clause IDs if contract present (recommended)
- [ ] Clear description of intent and success criteria

---

## Common Mistakes (T099)

### Mistake 1: Inventing Fields

**❌ WRONG:**
```json
{
  "contract": {
    "priority": "high",     // ❌ Not a valid field
    "author": "John Doe"    // ❌ Not a valid field
  }
}
```

**✅ CORRECT:**
```json
{
  "contract": {
    "criticality": "high",  // ✅ Valid field
    "owners": ["John Doe"]  // ✅ Valid field
  }
}
```

### Mistake 2: Wrong Enum Values

**❌ WRONG:**
```json
{
  "contract": {
    "mode": "strict",           // ❌ Lowercase (should be "STRICT")
    "changeType": "NEW",        // ❌ Uppercase (should be "new")
    "clauses": [{
      "kind": "Behavior",       // ❌ Capitalized (should be "behavior")
      "normativity": "must"     // ❌ Lowercase (should be "MUST")
    }]
  }
}
```

**✅ CORRECT:**
```json
{
  "contract": {
    "mode": "STRICT",
    "changeType": "new",
    "clauses": [{
      "kind": "behavior",
      "normativity": "MUST"
    }]
  }
}
```

### Mistake 3: Invalid Clause IDs

**❌ WRONG:**
```json
{
  "clauses": [
    {"id": "CL-auth-1"},         // ❌ Lowercase type, < 3 digits
    {"id": "CLAUSE-AUTH-001"},   // ❌ Wrong prefix
    {"id": "CL-AUTH"},           // ❌ Missing sequence
    {"id": "CL-AUTH-01"}         // ❌ Only 2 digits
  ]
}
```

**✅ CORRECT:**
```json
{
  "clauses": [
    {"id": "CL-AUTH-001"},       // ✅ Valid
    {"id": "CL-AUTH-042"},       // ✅ Valid
    {"id": "CL-USER_PROFILE-001"} // ✅ Valid (underscore allowed in type)
  ]
}
```

### Mistake 4: Missing Required Fields in Clauses

**❌ WRONG:**
```json
{
  "clauses": [{
    "id": "CL-AUTH-001",
    "title": "User receives JWT"
    // ❌ Missing: kind, normativity, spec, observables
  }]
}
```

**✅ CORRECT:**
```json
{
  "clauses": [{
    "id": "CL-AUTH-001",
    "kind": "behavior",
    "normativity": "MUST",
    "title": "User receives JWT",
    "spec": "When user logs in with valid credentials, then response contains JWT token",
    "observables": ["http"]
  }]
}
```

### Mistake 5: Missing negativeCases for Error/Security Clauses

**❌ WRONG:**
```json
{
  "clauses": [{
    "id": "CL-AUTH-002",
    "kind": "error",
    "normativity": "MUST",
    "title": "Invalid credentials return 401",
    "spec": "...",
    "observables": ["http"]
    // ❌ Missing negativeCases (required for kind=error)
  }]
}
```

**✅ CORRECT:**
```json
{
  "clauses": [{
    "id": "CL-AUTH-002",
    "kind": "error",
    "normativity": "MUST",
    "title": "Invalid credentials return 401",
    "spec": "...",
    "observables": ["http"],
    "negativeCases": [
      "Wrong password returns 401",
      "Non-existent email returns 401"
    ]
  }]
}
```

### Mistake 6: Tags Don't Match Clause IDs

**❌ WRONG:**
```typescript
// Test file
// @clause CL-AUTH-999  // ❌ Clause doesn't exist in contract
test('should login', () => {})
```

```json
// Contract
{
  "clauses": [
    {"id": "CL-AUTH-001"}  // ✅ Exists but not referenced in test
  ]
}
```

**✅ CORRECT:**
```typescript
// Test file
// @clause CL-AUTH-001  // ✅ Matches clause in contract
test('should login', () => {})
```

```json
// Contract
{
  "clauses": [
    {"id": "CL-AUTH-001"}  // ✅ Referenced in test
  ]
}
```

### Mistake 7: STRICT Mode Without Full Coverage

**❌ WRONG:**
```json
{
  "contract": {
    "mode": "STRICT",
    "clauses": [
      {"id": "CL-AUTH-001"},  // Has test
      {"id": "CL-AUTH-002"}   // ❌ No test → FAILED in STRICT
    ]
  }
}
```

**✅ CORRECT (Option 1 - Full Coverage):**
```json
{
  "contract": {
    "mode": "STRICT",
    "clauses": [
      {"id": "CL-AUTH-001"},  // Has test ✅
      {"id": "CL-AUTH-002"}   // Has test ✅
    ]
  }
}
```

**✅ CORRECT (Option 2 - Use CREATIVE):**
```json
{
  "contract": {
    "mode": "CREATIVE",      // Partial coverage allowed
    "clauses": [
      {"id": "CL-AUTH-001"},  // Has test ✅
      {"id": "CL-AUTH-002"}   // No test ⚠️ WARNING only
    ]
  }
}
```

## Contract Pipeline Responsibilities (T381-T389, T391)

1. **Elicitor generates the plan.** Pair `plan.json` with `contract_<slug>.md` and embed the structured contract inside `plan.json.contract`. The plan must describe the test file path that the LLM will write.
2. **Contract drives tests.** The contract defines modes, assertion surfaces, clauses, and expected mappings. The downstream LLM must keep assertions within the declared surfaces and tag every `test()`/`it()` with its clause IDs.
3. **LLM test generator duties.** Consume `plan.json` and the contract markdown, emit exactly one test file at `testFilePath`, tag clauses per `testMapping`, and keep assertions inside the declared surfaces. Request contract expansion before inventing new observable behavior.
4. **Gatekeeper gating order.** Gate 0 (sanitization) always runs before Gate 1 (contract validators). Gate 1 must pass (or issue acceptable warnings in CREATIVE mode) before Gate 2/3 run, ensuring the contract and tagged tests dictate implementation work.

This pipeline enforces the mantra "tests are law; contracts are law," keeping behavior derivations explicit.

## Decision Checklists (T392-T394)

### When to mark STRICT vs CREATIVE (T392)

- [ ] **STRICT:** new or modified endpoints, authentication/authorization, payment flows, security-critical logic, or when the contract surfaces must never be violated.
- [ ] **CREATIVE:** UI/UX polish, prototypes, low-risk behavior tweaks, or exploratory work where partial coverage/warnings are acceptable.
- [ ] **Fallback:** If uncertain, default to STRICT and let Gate 1 warnings prompt a review for possibly switching to CREATIVE.

### When to generate a contract (T393)

- [ ] New endpoints or UI surfaces introduced in this task.
- [ ] Behavioral changes to existing endpoints (response contract, error handling, status codes).
- [ ] Bugfixes affecting observable behavior.
- [ ] Refactors that surface new behavior; omit the contract only if the behavior is provably unchanged.

### When to update a contract after endpoint changes (T394)

- [ ] Endpoint method/path/status codes change -> update clauses, observables, and assertion surfaces.
- [ ] Response schema changes -> update `payloadPaths` and clause specs.
- [ ] Added sad/happy cases -> add clauses or `negativeCases`.
- [ ] New selectors, payloads, or logs become observable -> extend `assertionSurface`.

## Clause & Assertion Guidance (T398-T399)

### How to write better clauses (T398)

1. Keep clauses focused on observable behavior (`spec` describes what the consumer sees, not implementation).
2. Declare required observables (http method/path, status codes, selectors, payload paths) so validators can map assertions accurately.
3. Use `normativity: "MUST"` for hard guarantees, `"SHOULD"`/`"MAY"` for softer ones, and provide `negativeCases` for error/security clauses.
4. Cross-reference clause IDs in tests with stable titles and specs; include `testMapping` info so `TEST_CLAUSE_MAPPING_VALID` can verify alignment.

### How to avoid fragile asserts (T399)

1. Avoid CSS/DOM queries unless part of the declared `assertionSurface`; prefer semantic selectors tied to the contract.
2. Never assert on implementation internals (helpers, logs) unless the contract explicitly names those logs in `observables`.
3. Keep payload assertions tied to declared `payloadPaths`. If a new path is needed, expand the contract rather than adjusting selectors inside tests.
4. Treat assertion surfaces as the shielding contract: add new endpoints/payloads to `assertionSurface` before Gatekeeper allows corresponding asserts.

---

## Quick Reference Commands

### Validate plan.json Schema

```bash
# Via API endpoint
curl -X POST http://localhost:3000/api/runs/validate \
  -H "Content-Type: application/json" \
  -d @plan.json
```

### Test Coverage Check

```bash
# Count clause tags in test file
grep -c "@clause" tests/auth.test.ts

# List all clause IDs in test file
grep -o "CL-[A-Z_]+-[0-9]\+" tests/auth.test.ts
```

### Contract Schema Validation

```bash
# Run Gatekeeper with plan.json
npm run gatekeeper -- --input=plan.json

# Check CONTRACT_SCHEMA_VALID specifically
# Will SKIP if contract absent
# Will FAIL if contract invalid
```

---

**Version:** 1.0.0
**Status:** ✅ Frozen
**Last Updated:** 2026-01-18
