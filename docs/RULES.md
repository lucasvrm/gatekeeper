# Contract.json v1 Specification

**Version:** 1.0.0
**Status:** FROZEN (T090)
**Date:** 2026-01-18

This document specifies the structure and semantics of the `contract.json` format used by Gatekeeper for "tests as contracts" validation. This specification covers tasks T031-T090.

---

## Table of Contents

1. [Contract-Level Metadata](#contract-level-metadata)
2. [Clause Structure](#clause-structure)
3. [Clause Validation Rules](#clause-validation-rules)
4. [Assertion Surface](#assertion-surface)
5. [Test Mapping](#test-mapping)
6. [Mode-Specific Rules](#mode-specific-rules)
7. [Operational Rules and Limits](#operational-rules-and-limits)
8. [Integration with plan.json](#integration-with-planjson)
9. [Reference Examples](#reference-examples)

---

## 1. Contract-Level Metadata

### T031: schemaVersion (Required)

**Type:** `string`
**Format:** Semantic versioning (e.g., `"1.0.0"`)
**Purpose:** Identifies the contract schema version for forward compatibility.

**Versioning Policy:**
- **MAJOR**: Breaking changes to schema structure (incompatible validators)
- **MINOR**: Additive changes (new optional fields, backward compatible)
- **PATCH**: Clarifications, fixes to spec (no structural changes)

**Example:**
```json
{
  "schemaVersion": "1.0.0"
}
```

---

### T032: slug (Required)

**Type:** `string`
**Format:** Lowercase kebab-case, alphanumeric + hyphens only
**Pattern:** `/^[a-z0-9]+(-[a-z0-9]+)*$/`
**Max Length:** 64 characters

**Normalization Rules:**
1. Convert to lowercase
2. Replace spaces/underscores with hyphens
3. Remove special characters except hyphens
4. Collapse multiple consecutive hyphens to single hyphen
5. Trim leading/trailing hyphens

**Purpose:** Stable identifier for the contract, used in filenames and references.

**Example:**
```json
{
  "slug": "user-authentication-api"
}
```

---

### T033: title (Required)

**Type:** `string`
**Max Length:** 120 characters
**Format:** Human-readable title, sentence case

**Rules:**
- Must be descriptive and concise
- Should match the task intent
- No line breaks allowed
- Avoid redundant words like "Contract for..." (implied)

**Example:**
```json
{
  "title": "User Authentication API with JWT Tokens"
}
```

---

### T034: mode (Required)

**Type:** `enum`
**Values:** `"STRICT"` | `"CREATIVE"`

**Operational Semantics:**

**STRICT Mode:**
- All validators are hard-block (FAILED stops run)
- 100% clause coverage required
- All assertions must be mapped to clauses
- No unmapped tests allowed
- No partial contracts allowed

**CREATIVE Mode:**
- Coverage validators emit WARNING instead of FAILED
- Partial clause coverage acceptable (with warning)
- Unmapped assertions emit WARNING (not FAILED)
- Allows exploratory testing alongside contract tests
- Partial contracts allowed (incomplete clauses)

**Default:** `"STRICT"` (when not specified)

**Example:**
```json
{
  "mode": "STRICT"
}
```

---

### T035: scope (Optional)

**Type:** `enum`
**Values:** `"internal"` | `"external"` | `"mixed"`

**Purpose:** Indicates whether the contract validates internal behavior, public APIs, or both.

**Semantics:**
- `"internal"`: Validates implementation details, private APIs, internal state
- `"external"`: Validates public APIs, user-facing behavior only
- `"mixed"`: Both internal and external validations

**Default:** `"external"` (when not specified)

**Example:**
```json
{
  "scope": "external"
}
```

---

### T036: changeType (Required)

**Type:** `enum`
**Values:** `"new"` | `"modify"` | `"bugfix"` | `"refactor"`

**Purpose:** Categorizes the type of change for auditing and risk assessment.

**Semantics:**
- `"new"`: Adding entirely new functionality
- `"modify"`: Changing existing functionality (behavior change)
- `"bugfix"`: Fixing incorrect behavior (no new features)
- `"refactor"`: Code restructuring without behavior change

**Example:**
```json
{
  "changeType": "new"
}
```

---

### T037: targetArtifacts (Required)

**Type:** `string[]`
**Format:** Array of file paths or glob patterns
**Min Length:** 1

**Purpose:** Lists primary artifacts affected by this contract.

**Rules:**
- Paths relative to project root
- Can use glob patterns (e.g., `"src/api/auth/**/*.ts"`)
- Must include at least one artifact
- Used for scope validation and documentation

**Example:**
```json
{
  "targetArtifacts": [
    "src/api/auth/AuthController.ts",
    "src/services/TokenService.ts",
    "src/middleware/authMiddleware.ts"
  ]
}
```

---

### T038: owners (Optional)

**Type:** `string[]`
**Format:** Array of owner identifiers (usernames, emails, or team names)

**Purpose:** Tracks responsibility for contract maintenance and review.

**Example:**
```json
{
  "owners": ["@backend-team", "john.doe@example.com"]
}
```

---

### T039: criticality (Optional)

**Type:** `enum`
**Values:** `"low"` | `"medium"` | `"high"` | `"critical"`

**Purpose:** Indicates the impact of failure, affects minimum coverage requirements.

**Coverage Impact:**
- `"low"`: Minimum 60% clause coverage in CREATIVE mode
- `"medium"`: Minimum 80% clause coverage in CREATIVE mode
- `"high"`: Minimum 90% clause coverage in CREATIVE mode
- `"critical"`: 100% coverage required (enforced as STRICT regardless of mode)

**Default:** `"medium"` (when not specified)

**Example:**
```json
{
  "criticality": "high"
}
```

---

### T040: Audit Metadata (Optional)

**Fields:**
- `createdAt`: ISO 8601 timestamp (auto-generated by elicitor)
- `elicitorVersion`: Elicitor version that generated the contract
- `inputsHash`: SHA-256 hash of elicitor inputs for reproducibility

**Purpose:** Enables auditing, debugging, and reproducibility.

**Example:**
```json
{
  "createdAt": "2026-01-18T10:30:00Z",
  "elicitorVersion": "1.2.0",
  "inputsHash": "a3f5d8c9e2b1..."
}
```

---

## 2. Clause Structure

### T041: clause.kind (Required)

**Type:** `enum`
**Values:** `"behavior"` | `"error"` | `"invariant"` | `"constraint"` | `"security"` | `"ui"`

**Purpose:** Categorizes the type of validation the clause represents.

**Semantics:**
- `"behavior"`: Defines expected behavior (happy path, primary functionality)
- `"error"`: Defines error handling (must include negative cases)
- `"invariant"`: Defines conditions that must always hold
- `"constraint"`: Defines business rules or validation constraints
- `"security"`: Defines security requirements (must include negative cases)
- `"ui"`: Defines user interface behavior and rendering

**Example:**
```json
{
  "kind": "behavior"
}
```

---

### T042: clause.normativity (Required)

**Type:** `enum`
**Values:** `"MUST"` | `"SHOULD"` | `"MAY"`

**Purpose:** Indicates the strength of the requirement (RFC 2119 semantics).

**Semantics:**
- `"MUST"`: Absolute requirement (hard-block if test fails)
- `"SHOULD"`: Strong recommendation (warning if test fails, unless STRICT mode)
- `"MAY"`: Optional behavior (informational only)

**Validation Impact:**
- `"MUST"` clauses: Always hard-block in both modes
- `"SHOULD"` clauses: Hard-block in STRICT, WARNING in CREATIVE
- `"MAY"` clauses: Always WARNING

**Example:**
```json
{
  "normativity": "MUST"
}
```

---

### T043: clause.testRequired (Derived)

**Type:** `boolean` (derived, not specified explicitly)

**Derivation Rules:**
1. `normativity === "MUST"` → `testRequired = true`
2. `normativity === "SHOULD"` → `testRequired = true` (best practice)
3. `normativity === "MAY"` → `testRequired = false`
4. `kind === "error"` → `testRequired = true` (always)
5. `kind === "security"` → `testRequired = true` (always)

**Decision:** Derived automatically; not specified in contract.json.

---

### T044: clause.title (Required)

**Type:** `string`
**Max Length:** 80 characters

**Purpose:** Short, stable identifier for the clause (used in reports).

**Rules:**
- Should be stable (not change during refactoring)
- Should be unique within the contract
- Should describe the requirement, not the implementation
- Sentence case, no period at end

**Example:**
```json
{
  "title": "User receives JWT token on successful login"
}
```

---

### T045: clause.spec (Required)

**Type:** `string`
**Format:** Testable specification (what, not how)

**Purpose:** Defines the requirement in testable terms without revealing implementation.

**Rules:**
- Must describe observable behavior
- Must NOT describe implementation details
- Must be unambiguous and measurable
- Should use "when...then..." or "given...when...then..." format
- No code snippets or internal function names

**Example:**
```json
{
  "spec": "When a user submits valid credentials via POST /api/auth/login, then the response status is 200 and the body contains a valid JWT token in the 'token' field."
}
```

---

### T046: clause.when (Optional)

**Type:** `string[]`
**Format:** Array of observable preconditions

**Purpose:** Lists preconditions that must be satisfied for the clause to apply.

**Rules:**
- Must be observable from the test's perspective
- Must NOT reference internal state or private functions
- Should be minimal and necessary

**Example:**
```json
{
  "when": [
    "User account exists in the database",
    "User account is not locked",
    "Request includes Content-Type: application/json"
  ]
}
```

---

### T047: clause.inputs (Optional)

**Type:** `object`
**Format:** Key-value map of input parameters and their constraints

**Purpose:** Defines what inputs the test can provide to validate the clause.

**Rules:**
- Only include inputs the test can control
- Use JSON Schema-like constraints where applicable
- Avoid internal implementation details

**Example:**
```json
{
  "inputs": {
    "email": "string (valid email format)",
    "password": "string (min 8 characters)",
    "rememberMe": "boolean (optional)"
  }
}
```

---

### T048: clause.outputs (Optional)

**Type:** `object`
**Format:** Key-value map of expected outputs and their constraints

**Purpose:** Defines what outputs the test can observe to validate the clause.

**Rules:**
- Only include outputs the test can observe
- Specify formats, ranges, or patterns where applicable
- Include HTTP status codes, response fields, UI elements, etc.

**Example:**
```json
{
  "outputs": {
    "status": "200",
    "token": "string (JWT format)",
    "expiresIn": "number (seconds)"
  }
}
```

---

### T049: clause.observables (Required)

**Type:** `enum[]`
**Values:** `"http"` | `"ui"` | `"db-effect"` | `"event"` | `"file"` | `"log"`

**Purpose:** Specifies where the test should observe behavior to validate the clause.

**Semantics:**
- `"http"`: HTTP responses (status, headers, body)
- `"ui"`: User interface elements (DOM, rendered text, interactions)
- `"db-effect"`: Database state changes (records created/updated/deleted)
- `"event"`: Events emitted (application events, pub/sub)
- `"file"`: File system changes
- `"log"`: Log entries (structured logs only)

**Example:**
```json
{
  "observables": ["http", "db-effect"]
}
```

---

### T050: clause.negativeCases (Optional)

**Type:** `string[]`
**Format:** Array of negative test case descriptions

**Purpose:** Lists minimum required sad-path tests for the clause.

**Rules:**
- Required for `kind === "error"` clauses (must have at least 1)
- Required for `kind === "security"` clauses (must have at least 1)
- Should cover edge cases, invalid inputs, and failure modes

**Example:**
```json
{
  "negativeCases": [
    "Invalid email format returns 400",
    "Missing password returns 400",
    "Wrong password returns 401",
    "Locked account returns 403"
  ]
}
```

---

### T051: clause.tags (Optional)

**Type:** `string[]`
**Format:** Array of lowercase tags for filtering and grouping

**Purpose:** Enables filtering, searching, and grouping of clauses.

**Example:**
```json
{
  "tags": ["authentication", "jwt", "api", "security"]
}
```

---

### T052: clause.notes (Optional)

**Type:** `string`
**Purpose:** Non-normative notes for context and clarification.

**Rules:**
- Does not affect validation
- Use for implementation hints, rationale, or cross-references
- Markdown formatting allowed

**Example:**
```json
{
  "notes": "This clause validates the primary authentication flow. See also CL-AUTH-002 for token refresh logic."
}
```

---

## 3. Clause Validation Rules

### T053: Rule - MUST Clauses Require Tests

**Rule:** All clauses with `normativity === "MUST"` must have at least one test mapping.

**Validator:** `CONTRACT_CLAUSE_COVERAGE`
**Enforcement:** FAILED in both STRICT and CREATIVE modes

---

### T054: Rule - Error Clauses Require Sad-Path Tests

**Rule:** All clauses with `kind === "error"` must have:
1. At least one test mapping (covered by T053)
2. At least one negative case defined in `negativeCases[]`
3. At least one test that validates a negative case

**Validator:** `CONTRACT_CLAUSE_COVERAGE` + custom check
**Enforcement:** FAILED in both STRICT and CREATIVE modes

---

### T055: Rule - Security Clauses Require Negative Tests

**Rule:** All clauses with `kind === "security"` must have:
1. At least one test mapping (covered by T053)
2. At least one negative case defined in `negativeCases[]`
3. At least one test that attempts to violate the security requirement

**Validator:** `CONTRACT_CLAUSE_COVERAGE` + custom check
**Enforcement:** FAILED in both STRICT and CREATIVE modes

---

## 4. Assertion Surface

### T056: assertionSurface.http.endpoints (Optional)

**Type:** `object[]`
**Format:** Array of HTTP endpoint specifications

**Structure:**
```json
{
  "assertionSurface": {
    "http": {
      "endpoints": [
        {
          "method": "POST",
          "path": "/api/auth/login",
          "description": "User login endpoint"
        }
      ]
    }
  }
}
```

**Purpose:** Documents expected HTTP endpoints for validation.

---

### T057: assertionSurface.http.statusCodes (Optional)

**Type:** `number[]` or `object` (per-endpoint allowlist)

**Format:**
```json
{
  "assertionSurface": {
    "http": {
      "statusCodes": [200, 400, 401, 403, 500],
      "endpointStatusCodes": {
        "POST /api/auth/login": [200, 400, 401, 403]
      }
    }
  }
}
```

**Purpose:** Defines allowlist of expected status codes.

---

### T058: assertionSurface.errors.codes (Optional)

**Type:** `string[]`
**Format:** Array of error codes (prefer codes over messages)

**Example:**
```json
{
  "assertionSurface": {
    "errors": {
      "codes": [
        "AUTH_INVALID_CREDENTIALS",
        "AUTH_ACCOUNT_LOCKED",
        "AUTH_TOKEN_EXPIRED"
      ]
    }
  }
}
```

**Purpose:** Prefer structured error codes over free-text messages for stable assertions.

---

### T059: assertionSurface.payloadPaths (Optional)

**Type:** `string[]`
**Format:** JSON path expressions (dot notation or bracket notation)

**Example:**
```json
{
  "assertionSurface": {
    "payloadPaths": [
      "token",
      "user.id",
      "user.email",
      "expiresIn"
    ]
  }
}
```

**Purpose:** Documents expected fields in request/response payloads.

---

### T060: assertionSurface.ui (Optional)

**Type:** `object`
**Format:** UI elements and selectors

**Structure:**
```json
{
  "assertionSurface": {
    "ui": {
      "routes": ["/login", "/dashboard"],
      "tabs": ["Profile", "Settings"],
      "selectors": {
        "loginButton": "[data-testid='login-submit']",
        "errorMessage": "[role='alert']"
      }
    }
  }
}
```

**Pattern Conventions:**
- Use `data-testid` attributes (preferred)
- Use ARIA roles for accessibility
- Avoid fragile CSS selectors

---

### T061: assertionSurface.effects (Optional)

**Type:** `object`
**Format:** Observable side effects

**Structure:**
```json
{
  "assertionSurface": {
    "effects": {
      "database": [
        "users table: row created",
        "sessions table: row created"
      ],
      "events": [
        "UserLoggedIn event emitted"
      ]
    }
  }
}
```

**Purpose:** Documents verifiable side effects (not internal state).

---

### T251: Contract schema validation (ContractSchemaValid)

**Purpose:** Validates that the optional `contract` payload follows the structured schema before other gate validators execute.

**Rules:**
- `schemaVersion` must be exactly `1.0.0` and follow semantic versioning.
- Clause IDs must be unique; duplicates cause `CONTRACT_SCHEMA_VALID` to fail.
- `error` and `security` clauses must provide `negativeCases`.
- `testMapping.untaggedAllowlist` is invalid unless `testMapping.allowUntagged` is `true`.
- `STRICT` mode requires a non-empty `assertionSurface`; `CREATIVE` mode only emits a WARNING for its absence.
- `expectedCoverage` entries (`minTestsForMUST`, `minTestsForSecurity`, `minNegativeTestsForError`) must reference clauses that exist in the contract.

### T062: Invariants - "Must Not Happen X"

**Format:** Use `kind === "invariant"` with negative assertions

**Example:**
```json
{
  "kind": "invariant",
  "title": "Password never appears in logs",
  "spec": "When authentication occurs, then password values must not appear in any log entries.",
  "observables": ["log"],
  "negativeCases": [
    "Check logs do not contain plaintext passwords",
    "Check logs do not contain password hashes"
  ]
}
```

---

## 5. Test Mapping

### T063: testMapping.required (Optional)

**Type:** `boolean`
**Default:** `true` (derived from mode)

**Semantics:**
- `true`: Test mapping violations emit FAILED (STRICT) or WARNING (CREATIVE)
- `false`: Test mapping is optional (informational only)

**Precedence:** Overridden by `mode` if not specified.

---

### T064: testMapping.format (Optional)

**Type:** `enum`
**Values:** `"comment_tags"` | `"bracket_tags"`
**Default:** `"comment_tags"`

**Semantics:**
- `"comment_tags"`: `// @clause CL-XXX-NNN` (current implementation)
- `"bracket_tags"`: `[CL-XXX-NNN]` in test names (future support)

---

### T065: testMapping.tagPattern (Optional)

**Type:** `string` (regex pattern)
**Default:** `/^\s*\/\/\s*@clause\s+(CL-[A-Z_]+-\d{3,})\s*$/`

**Purpose:** Canonical regex for parsing clause tags from test files.

---

### T066: testMapping.allowMultiple (Optional)

**Type:** `boolean`
**Default:** `true`

**Semantics:**
- `true`: A single test can map to multiple clauses
- `false`: Each test can only map to one clause

---

### T067: testMapping.allowUntagged (Optional)

**Type:** `boolean`
**Default:** Derived from mode (`false` for STRICT, `true` for CREATIVE)

**Semantics:**
- `true`: Tests without @clause tags are allowed (emit WARNING)
- `false`: All tests must have @clause tags (emit FAILED)

**Field:** `testMapping.untaggedAllowlist` (optional `string[]`)
**Purpose:** List of test patterns that are allowed to be untagged (e.g., setup/teardown).

**Example:**
```json
{
  "testMapping": {
    "allowUntagged": true,
    "untaggedAllowlist": [
      "beforeEach",
      "afterEach",
      "test setup"
    ]
  }
}
```

---

### T068: expectedCoverage (Optional)

**Type:** `object`
**Format:** Minimum test requirements per clause

**Structure:**
```json
{
  "expectedCoverage": {
    "minTestsPerClause": 1,
    "minTestsForMUST": 2,
    "minTestsForSecurity": 3,
    "minNegativeTestsForError": 1
  }
}
```

**Purpose:** Defines minimum test coverage beyond basic presence.

---

### T069: Precedence Rule - expectedCoverage

**Rule:** `expectedCoverage` values override `testRequired` derivation.

**Example:** If `expectedCoverage.minTestsForMUST = 2`, then MUST clauses need 2+ tests even if `testRequired` would normally require only 1.

---

## 6. Mode-Specific Rules

### T070: CREATIVE Mode - allowUntagged Default

**Rule:** In CREATIVE mode, `testMapping.allowUntagged` defaults to `true`.

**Rationale:** Allows exploratory testing alongside contract tests.

---

### T071: CREATIVE Mode - NO_OUT_OF_CONTRACT_ASSERTIONS

**Rule:** In CREATIVE mode, `NO_OUT_OF_CONTRACT_ASSERTIONS` validator emits WARNING instead of FAILED.

**Implementation:** Already implemented in validator (packages/gatekeeper-api/src/domain/validators/gate1/NoOutOfContractAssertions.ts:71).

---

### T072: STRICT Mode - All Hard-Block

**Rule:** In STRICT mode:
- All validators emit FAILED (not WARNING)
- 100% clause coverage required
- All assertions must be mapped
- No partial contracts allowed

**Implementation:** Already implemented in validators.

---

## 7. Operational Rules and Limits

### T073: Partial Contracts

**Rule:** Incomplete contracts (missing required fields or clauses) behavior:

**STRICT Mode:**
- Incomplete contract → FAILED
- Missing required clause fields → FAILED
- Zero clauses → FAILED

**CREATIVE Mode:**
- Incomplete contract → WARNING (allows iterative development)
- Missing optional clause fields → allowed
- Zero clauses → WARNING

---

### T074: Multi-Type Tasks (UI + API)

**Rule:** Contracts can contain clauses of mixed types (UI + API).

**Recommendation:** Use `clause.tags[]` to organize by subsystem.

**Example:**
```json
{
  "clauses": [
    {"id": "CL-UI-001", "kind": "ui", "tags": ["frontend"]},
    {"id": "CL-API-001", "kind": "behavior", "tags": ["backend"]}
  ]
}
```

---

### T075: Clause Granularity

**Guideline:** Default granularity for decomposition:

**Recommended:**
- 1 clause per user-facing behavior
- 1 clause per error condition
- 1 clause per security requirement

**Avoid:**
- 1 clause per function (too granular)
- 1 clause per entire feature (too coarse)

---

### T076: Maximum Clauses

**Limit:** Maximum 100 clauses per contract.

**Rationale:** Prevents explosion; encourages focused contracts.

**Enforcement:** Validator emits WARNING at 50 clauses, FAILED at 100.

---

### T077: Contract Size Limits

**Limits:**
- Total contract JSON size: 500 KB maximum
- Individual clause `spec` field: 2000 characters maximum
- Individual clause `notes` field: 5000 characters maximum

**Enforcement:** Schema validation at contract creation.

---

### T078: Exact Values vs Patterns

**Rule:** Regex patterns ARE allowed in assertions.

**Recommendation:**
- Prefer exact values when possible (e.g., `status: 200`)
- Use regex for variable content (e.g., `token: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/`)
- Document regex patterns in `clause.notes` for clarity

---

### T079: UI Messages - Partial/Regex Allowed

**Rule:** UI text assertions MAY use partial matching or regex.

**Recommendation:**
- Use `data-testid` attributes instead of text when possible
- For error messages, match on error codes (not text)
- For dynamic text, use regex or substring matching

---

### T080: Internals Prohibition

**Rule:** Clauses MUST NOT assert on internal implementation details:

**Prohibited:**
- Private function calls
- Internal state variables
- Framework hooks (unless observable)
- Class internals

**Allowed:**
- Public API responses
- Observable side effects
- UI rendering
- Database records

**Enforcement:** Manual review (not automated).

---

### T081: Gate 1 Compatibility

**Rule:** Contract validation must NOT break existing Gate 1 validators.

**Backward Compatibility:**
- Contract field is optional in `plan.json`
- Existing validators SKIP when contract absent
- No changes to non-contract validators

**Implementation:** Already enforced (T015).

---

## 8. Integration with plan.json

### T082: Contract Field in plan.json

**Rule:** Contract enters `plan.json` via the `contract` field.

**Schema Location:** `packages/gatekeeper-api/src/api/schemas/validation.schema.ts`

**Implementation:** Already implemented (T014).

**Example:**
```json
{
  "outputId": "abc123",
  "taskPrompt": "...",
  "manifest": {...},
  "contract": {
    "schemaVersion": "1.0.0",
    "slug": "user-auth",
    "title": "User Authentication",
    "mode": "STRICT",
    "clauses": [...]
  }
}
```

---

### T083: No Slug Duplication in plan.json

**Rule:** `plan.json` MUST NOT duplicate `contract.slug` at the top level.

**Rationale:** Single source of truth is `contract.slug`.

**Incorrect:**
```json
{
  "contractSlug": "user-auth",  // ❌ DON'T DO THIS
  "contract": {
    "slug": "user-auth"
  }
}
```

**Correct:**
```json
{
  "contract": {
    "slug": "user-auth"  // ✅ Only here
  }
}
```

---

### T084: Human-Readable Filename

**Format:** `contract_<slug>.md`

**Purpose:** Human-readable contract documentation (optional companion to contract.json).

**Example:** `contract_user-authentication-api.md`

**Content:** Markdown version of contract for human review.

---

### T085: contract.md Alias

**Rule:** `contract.md` MAY exist as an alias for backward compatibility.

**Implementation:** If present, `contract.md` should link to or duplicate `contract_<slug>.md`.

---

### T086: taskPrompt and Clauses Coherence

**Rule:** `taskPrompt` and contract clauses must be coherent but NOT duplicate each other.

**Guideline:**
- `taskPrompt`: High-level intent and context
- Contract clauses: Precise, testable specifications

**Example:**

**taskPrompt:**
```
"Implement user authentication with JWT tokens. Users should be able to log in with email/password and receive a token for subsequent requests."
```

**Contract clauses:**
```json
[
  {
    "id": "CL-AUTH-001",
    "title": "User receives JWT on successful login",
    "spec": "When POST /api/auth/login with valid credentials, then return 200 with JWT token"
  },
  {
    "id": "CL-AUTH-002",
    "title": "Invalid credentials return 401",
    "spec": "When POST /api/auth/login with invalid password, then return 401"
  }
]
```

---

### T087: taskPrompt Should List Clause IDs

**Recommendation:** `taskPrompt` SHOULD list clause IDs explicitly for traceability.

**Example:**
```
"Implement user authentication (CL-AUTH-001, CL-AUTH-002, CL-AUTH-003). Users should be able to log in with email/password and receive a JWT token for subsequent requests."
```

**Rationale:** Enables easy cross-referencing between prompt and contract.

---

### T088: Traceability Matrix

**Rule:** Tags are the source of truth for clause→test mapping.

**Traceability Matrix Format:**
```
Clause ID          | Test File               | Line | Test Name
-------------------|-------------------------|------|-------------------------
CL-AUTH-001        | auth.test.ts            | 45   | should return JWT on login
CL-AUTH-001        | auth.test.ts            | 67   | should set cookie on login
CL-AUTH-002        | auth.test.ts            | 89   | should reject invalid password
```

**Generation:** Automatically generated from `@clause` tags by validators.

---

## 9. Reference Examples

### T089: Reference Example 1 - API Contract

**File:** `examples/contract_user-authentication-api.json`

```json
{
  "schemaVersion": "1.0.0",
  "slug": "user-authentication-api",
  "title": "User Authentication API with JWT Tokens",
  "mode": "STRICT",
  "scope": "external",
  "changeType": "new",
  "criticality": "high",
  "targetArtifacts": [
    "src/api/auth/AuthController.ts",
    "src/services/TokenService.ts"
  ],
  "owners": ["@backend-team"],
  "createdAt": "2026-01-18T10:30:00Z",
  "clauses": [
    {
      "id": "CL-AUTH-001",
      "kind": "behavior",
      "normativity": "MUST",
      "title": "User receives JWT token on successful login",
      "spec": "When a user submits valid credentials via POST /api/auth/login, then the response status is 200 and the body contains a valid JWT token in the 'token' field.",
      "when": [
        "User account exists in database",
        "User account is not locked",
        "Password matches stored hash"
      ],
      "inputs": {
        "email": "string (valid email format)",
        "password": "string (min 8 characters)"
      },
      "outputs": {
        "status": "200",
        "token": "string (JWT format)",
        "expiresIn": "number (seconds)"
      },
      "observables": ["http", "db-effect"],
      "tags": ["authentication", "jwt", "happy-path"]
    },
    {
      "id": "CL-AUTH-002",
      "kind": "error",
      "normativity": "MUST",
      "title": "Invalid credentials return 401",
      "spec": "When a user submits invalid credentials via POST /api/auth/login, then the response status is 401 and the body contains error code AUTH_INVALID_CREDENTIALS.",
      "inputs": {
        "email": "string (any)",
        "password": "string (incorrect)"
      },
      "outputs": {
        "status": "401",
        "errorCode": "AUTH_INVALID_CREDENTIALS"
      },
      "observables": ["http"],
      "negativeCases": [
        "Wrong password returns 401",
        "Non-existent email returns 401",
        "Empty password returns 401"
      ],
      "tags": ["authentication", "error-handling", "sad-path"]
    },
    {
      "id": "CL-AUTH-003",
      "kind": "security",
      "normativity": "MUST",
      "title": "Password never appears in logs or responses",
      "spec": "When authentication occurs (success or failure), then password values must not appear in any log entries or HTTP responses.",
      "observables": ["log", "http"],
      "negativeCases": [
        "Check logs do not contain plaintext passwords",
        "Check error responses do not echo passwords"
      ],
      "tags": ["security", "privacy", "invariant"]
    }
  ],
  "assertionSurface": {
    "http": {
      "endpoints": [
        {
          "method": "POST",
          "path": "/api/auth/login"
        }
      ],
      "statusCodes": [200, 400, 401, 500]
    },
    "errors": {
      "codes": ["AUTH_INVALID_CREDENTIALS", "AUTH_ACCOUNT_LOCKED"]
    }
  },
  "testMapping": {
    "format": "comment_tags",
    "allowMultiple": true,
    "allowUntagged": false
  },
  "expectedCoverage": {
    "minTestsPerClause": 1,
    "minTestsForMUST": 2,
    "minNegativeTestsForError": 1
  }
}
```

---

### T089: Reference Example 2 - UI Contract

**File:** `examples/contract_user-profile-ui.json`

```json
{
  "schemaVersion": "1.0.0",
  "slug": "user-profile-ui",
  "title": "User Profile Page UI",
  "mode": "CREATIVE",
  "scope": "external",
  "changeType": "new",
  "criticality": "medium",
  "targetArtifacts": [
    "src/pages/ProfilePage.tsx",
    "src/components/ProfileForm.tsx"
  ],
  "owners": ["@frontend-team"],
  "createdAt": "2026-01-18T11:00:00Z",
  "clauses": [
    {
      "id": "CL-UI-001",
      "kind": "ui",
      "normativity": "MUST",
      "title": "Profile form displays user data",
      "spec": "When the user navigates to /profile, then the form fields are pre-filled with the user's current name, email, and bio.",
      "when": [
        "User is authenticated",
        "User data exists in database"
      ],
      "outputs": {
        "nameField": "string (user's name)",
        "emailField": "string (user's email)",
        "bioField": "string (user's bio)"
      },
      "observables": ["ui"],
      "tags": ["ui", "profile", "rendering"]
    },
    {
      "id": "CL-UI-002",
      "kind": "error",
      "normativity": "MUST",
      "title": "Form validation errors are displayed",
      "spec": "When the user submits the profile form with invalid data, then validation errors are displayed next to the invalid fields.",
      "inputs": {
        "name": "string (empty or too long)",
        "email": "string (invalid format)"
      },
      "observables": ["ui"],
      "negativeCases": [
        "Empty name shows 'Name is required'",
        "Invalid email shows 'Invalid email format'",
        "Name > 100 chars shows 'Name too long'"
      ],
      "tags": ["ui", "validation", "error-handling"]
    },
    {
      "id": "CL-UI-003",
      "kind": "behavior",
      "normativity": "SHOULD",
      "title": "Success message appears after save",
      "spec": "When the user successfully saves profile changes, then a success message appears for 3 seconds.",
      "observables": ["ui"],
      "tags": ["ui", "feedback", "ux"]
    }
  ],
  "assertionSurface": {
    "ui": {
      "routes": ["/profile"],
      "selectors": {
        "nameInput": "[data-testid='profile-name']",
        "emailInput": "[data-testid='profile-email']",
        "bioTextarea": "[data-testid='profile-bio']",
        "saveButton": "[data-testid='profile-save']",
        "errorMessage": "[role='alert']",
        "successMessage": "[data-testid='success-toast']"
      }
    }
  },
  "testMapping": {
    "format": "comment_tags",
    "allowMultiple": true,
    "allowUntagged": true,
    "untaggedAllowlist": ["beforeEach", "afterEach"]
  }
}
```

---

## 10. Schema Freeze (T090)

**Status:** This specification is FROZEN as of 2026-01-18.

**Version:** `1.0.0`

**Changelog:**
- `1.0.0` (2026-01-18): Initial frozen specification

**Future Changes:**
- MAJOR version changes require RFC and consensus
- MINOR version changes for additive features only
- PATCH version changes for clarifications only

---

## Appendix A: JSON Schema

**Location:** `packages/gatekeeper-api/src/api/schemas/contract.schema.ts`

**Note:** Full JSON Schema definition to be implemented based on this specification.

---

## Appendix B: Compatibility Matrix

| Gatekeeper Version | Contract Schema Version | Compatible |
|--------------------|-------------------------|------------|
| 1.0.x              | 1.0.0                  | ✅ Yes     |
| 1.1.x              | 1.0.0, 1.1.0           | ✅ Yes     |
| 2.0.x              | 2.0.0                  | ❌ No      |

---

## Appendix C: Migration Guide

**From:** Inline clauses in `plan.json`
**To:** Structured `contract.json` v1

**Migration Steps:**
1. Extract clause IDs from test `@clause` tags
2. Generate contract skeleton with `schemaVersion: "1.0.0"`
3. Populate clauses with `kind`, `normativity`, `spec`
4. Add `assertionSurface` based on test files
5. Set `mode` based on project criticality
6. Validate with `CONTRACT_SCHEMA_VALID`

---

**END OF SPECIFICATION**

