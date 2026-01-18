# Test Writing Rules for Gatekeeper

**Version:** 1.0.0
**Last Updated:** 2026-01-18
**Audience:** Developers writing tests for Gatekeeper validation

This document defines rules and best practices for writing tests that will be validated by Gatekeeper.

---

## Table of Contents

1. [Validators WITH Enforcement](#validators-with-enforcement)
2. [Tag Examples and Prohibitions](#tag-examples-and-prohibitions)
3. [Snapshot and Fragile Assertion Policy](#snapshot-and-fragile-assertion-policy)
4. [Best Practices](#best-practices)
5. [Common Violations](#common-violations)

---

## 1. Validators WITH Enforcement (T105)

These validators actively enforce test quality and contract compliance. All are in Gate 1 (CONTRACT).

### Contract Validators (New)

#### CONTRACT_SCHEMA_VALID
**Status:** ✅ Implemented
**Order:** 1
**Enforcement:** Hard-block (always)

**What it checks:**
- Contract structure is valid against Zod schema
- All required fields present
- Clause IDs follow format `CL-<TYPE>-<SEQUENCE>`
- No duplicate clause IDs

**What triggers FAILED:**
- Missing required fields (mode, slug, title, etc.)
- Invalid clause ID format
- Duplicate clause IDs
- Invalid enum values

**How to fix:**
- Ensure contract matches schema in `docs/REFERENCE.md`
- Use valid clause ID format: `CL-AUTH-001`, `CL-UI-042`
- Check for duplicate IDs across all clauses

---

#### TEST_CLAUSE_MAPPING_VALID
**Status:** ✅ Implemented
**Order:** 2
**Enforcement:** Hard-block in STRICT, WARNING in CREATIVE

**What it checks:**
- All `@clause` tags reference existing clause IDs
- Tag format is correct

**What triggers FAILED (STRICT) / WARNING (CREATIVE):**
- Tag references non-existent clause: `@clause CL-AUTH-999`
- Typo in clause ID: `@clause CL-AUHT-001`
- Invalid tag format: `@clause cl-auth-001` (lowercase)

**How to fix:**
- Verify clause ID exists in contract
- Fix typos in clause IDs
- Use exact format: `// @clause CL-<TYPE>-<SEQUENCE>`

---

#### CONTRACT_CLAUSE_COVERAGE
**Status:** ✅ Implemented
**Order:** 3
**Enforcement:** Hard-block in STRICT, WARNING in CREATIVE

**What it checks:**
- All contract clauses have at least one test mapping
- Coverage percentage meets requirements

**Coverage Requirements:**
- **STRICT:** 100% coverage required
- **CREATIVE (by criticality):**
  - low: 60% minimum
  - medium: 80% minimum
  - high: 90% minimum
  - critical: 100% minimum

**What triggers FAILED (STRICT) / WARNING (CREATIVE):**
- Clause with no `@clause` tags in any test
- Coverage below minimum threshold

**How to fix:**
- Add `@clause` tags to tests for uncovered clauses
- Ensure every clause has at least one test
- Check coverage report in validator output

---

#### NO_OUT_OF_CONTRACT_ASSERTIONS
**Status:** ✅ Implemented
**Order:** 4
**Enforcement:** Hard-block in STRICT, WARNING in CREATIVE

**What it checks:**
- All assertions are mapped to contract clauses
- No "rogue" assertions in unmapped tests

**Assertion types detected:**
- `expect()` - Expect-style assertions
- `assert()` - Assert-style assertions
- Snapshots - `toMatchSnapshot()`, `toMatchInlineSnapshot()`
- Mocks - `toHaveBeenCalled()`, `toHaveBeenCalledWith()`
- Structural - `toBeDefined()`, `toBeNull()`, etc.

**What triggers FAILED (STRICT) / WARNING (CREATIVE):**
- Assertion in test without `@clause` tag
- Assertion more than 50 lines below nearest tag

**How to fix:**
- Add `@clause` tag above test with assertions
- Move tag closer to assertions (within 50 lines)
- Add clause to contract if needed

---

### Existing Test Validators

#### TEST_SYNTAX_VALID
**Status:** ✅ Implemented
**Order:** 5
**Enforcement:** Hard-block

**What it checks:**
- Test file compiles without TypeScript errors

**What triggers FAILED:**
- Syntax errors
- Type errors
- Import errors

**How to fix:**
- Run `tsc --noEmit` on test file
- Fix syntax and type errors
- Ensure imports are valid

---

#### TEST_HAS_ASSERTIONS
**Status:** ✅ Implemented
**Order:** 6
**Enforcement:** Hard-block

**What it checks:**
- Test contains at least one assertion

**Patterns detected:**
- `expect(...)`
- `assert(...)`
- `should...`
- `.toBe()`, `.toEqual()`, etc.

**What triggers FAILED:**
- Empty test body
- No assertion calls

**How to fix:**
- Add at least one `expect()` or `assert()` call
- Remove empty tests

---

#### TEST_COVERS_HAPPY_AND_SAD_PATH
**Status:** ✅ Implemented
**Order:** 7
**Enforcement:** Hard-block

**What it checks:**
- Test covers both success and error scenarios

**Happy path keywords:**
- success, should, valid, correct, works, returns

**Sad path keywords:**
- error, fail, invalid, throws, rejects, wrong

**What triggers FAILED:**
- Only happy path tests (no error handling)
- Only sad path tests (no success cases)

**How to fix:**
- Add error handling tests
- Add success scenario tests
- Balance coverage

---

#### TEST_FAILS_BEFORE_IMPLEMENTATION
**Status:** ✅ Implemented
**Order:** 8
**Enforcement:** Hard-block (IMMUTABLE - CLÁUSULA PÉTREA)

**What it checks:**
- Test fails at baseRef (before implementation)
- Test passes at targetRef (after implementation)

**What triggers FAILED:**
- Test passes at baseRef (implementation already exists)
- Test doesn't run at baseRef

**How to fix:**
- Ensure test is written BEFORE implementation
- Verify baseRef points to state before changes
- Check test actually validates new behavior

**IMPORTANT:** This rule cannot be bypassed or softened.

---

#### NO_DECORATIVE_TESTS
**Status:** ✅ Implemented
**Order:** 9
**Enforcement:** Hard-block

**What it checks:**
- Tests are not empty or meaningless
- Tests have real validation logic

**Decorative patterns detected:**
- Empty test bodies
- Only `render()` without assertions
- Only snapshots without other assertions
- Only `toBeDefined()` checks

**What triggers FAILED:**
- Test with no meaningful validation
- Snapshot-only tests
- Render-only tests

**How to fix:**
- Add meaningful assertions
- Validate specific behavior
- Don't rely solely on snapshots

---

#### MANIFEST_FILE_LOCK
**Status:** ✅ Implemented
**Order:** 10
**Enforcement:** Hard-block

**What it checks:**
- Manifest structure is valid
- No glob patterns in file paths
- No vague terms in reasons

**What triggers FAILED:**
- Glob patterns: `src/**/*.ts`
- Vague terms: "etc", "other files", "related files"
- Invalid action values
- Duplicate file paths

**How to fix:**
- Use explicit file paths
- Remove glob patterns
- Remove vague language
- Ensure unique file paths

---

#### NO_IMPLICIT_FILES
**Status:** ✅ Implemented
**Order:** 11
**Enforcement:** Hard-block

**What it checks:**
- No vague file references in prompts or manifest
- All files explicitly listed

**Vague patterns blocked:**
- "other files"
- "related files"
- "etc"
- "..."
- "and more"

**What triggers FAILED:**
- Vague language in taskPrompt
- Vague language in manifest reasons

**How to fix:**
- Explicitly list all files
- Remove vague language
- Be specific about changes

---

#### IMPORT_REALITY_CHECK
**Status:** ✅ Implemented
**Order:** 12
**Enforcement:** Hard-block

**What it checks:**
- All imports in test file exist
- Relative paths resolve to real files
- Package imports exist in package.json

**What triggers FAILED:**
- Import from non-existent file
- Import from package not in dependencies
- Invalid relative path

**How to fix:**
- Verify imported files exist
- Add missing dependencies to package.json
- Fix import paths

---

#### TEST_INTENT_ALIGNMENT
**Status:** ✅ Implemented
**Order:** 13
**Enforcement:** Soft (WARNING only)

**What it checks:**
- Test content aligns with task prompt
- Keyword overlap ≥ 30%

**What triggers WARNING:**
- Low keyword overlap (< 30%)
- Test seems unrelated to task

**How to fix:**
- Ensure test validates task requirements
- Update test description to match prompt
- Consider if test is actually needed

**NOTE:** This is a soft gate - returns WARNING, not FAILED.

---

## 2. Tag Examples and Prohibitions (T106)

### Valid Tag Examples

**Basic tag:**
```typescript
// @clause CL-AUTH-001
test('should return JWT on successful login', () => {
  const response = await login('user@example.com', 'password')
  expect(response.status).toBe(200)
  expect(response.body.token).toBeDefined()
})
```

**Multiple tags (one test validates multiple clauses):**
```typescript
// @clause CL-AUTH-001
// @clause CL-AUTH-003
test('should return JWT and log event', () => {
  const response = await login('user@example.com', 'password')
  expect(response.status).toBe(200)           // CL-AUTH-001
  expect(logs).toContain('USER_LOGGED_IN')   // CL-AUTH-003
})
```

**Error handling:**
```typescript
// @clause CL-AUTH-002
test('should return 401 for invalid password', () => {
  const response = await login('user@example.com', 'wrong')
  expect(response.status).toBe(401)
  expect(response.body.errorCode).toBe('AUTH_INVALID_CREDENTIALS')
})
```

**Multiple tests for same clause:**
```typescript
// @clause CL-AUTH-001
test('should return JWT with valid email', () => {
  // Test 1 for CL-AUTH-001
})

// @clause CL-AUTH-001
test('should set JWT expiration correctly', () => {
  // Test 2 for CL-AUTH-001
})
```

**Nested describe blocks:**
```typescript
describe('Authentication', () => {
  describe('Login', () => {
    // @clause CL-AUTH-001
    it('should authenticate with valid credentials', () => {
      // Tag works in nested blocks
    })
  })
})
```

### Prohibited Tag Patterns (T106)

**❌ Block comments (not supported):**
```typescript
/* @clause CL-AUTH-001 */  // ❌ NOT SUPPORTED
test('should login', () => {})
```

**✅ Correct:**
```typescript
// @clause CL-AUTH-001  // ✅ Line comment only
test('should login', () => {})
```

---

**❌ Lowercase clause ID:**
```typescript
// @clause cl-auth-001  // ❌ Lowercase
test('should login', () => {})
```

**✅ Correct:**
```typescript
// @clause CL-AUTH-001  // ✅ Uppercase
test('should login', () => {})
```

---

**❌ Missing @ symbol:**
```typescript
// clause CL-AUTH-001  // ❌ No @
test('should login', () => {})
```

**✅ Correct:**
```typescript
// @clause CL-AUTH-001  // ✅ With @
test('should login', () => {})
```

---

**❌ Inside test body:**
```typescript
test('should login', () => {
  // @clause CL-AUTH-001  // ❌ Inside test (too late)
  expect(result).toBe(true)
})
```

**✅ Correct:**
```typescript
// @clause CL-AUTH-001  // ✅ Before test
test('should login', () => {
  expect(result).toBe(true)
})
```

---

**❌ Insufficient digits in sequence:**
```typescript
// @clause CL-AUTH-1  // ❌ Only 1 digit (need 3+)
// @clause CL-AUTH-01  // ❌ Only 2 digits
test('should login', () => {})
```

**✅ Correct:**
```typescript
// @clause CL-AUTH-001  // ✅ 3+ digits
test('should login', () => {})
```

---

**❌ No code (assertion in unmapped test):**
```typescript
test('should work', () => {
  // ❌ No @clause tag, but has assertion (STRICT mode violation)
  expect(feature.works()).toBe(true)
})
```

**✅ Correct (Option 1 - Add tag):**
```typescript
// @clause CL-FEATURE-001
test('should work', () => {
  expect(feature.works()).toBe(true)
})
```

**✅ Correct (Option 2 - No assertion):**
```typescript
test('feature exists', () => {
  expect(feature).toBeDefined()  // Structural check only
})
```

### Tag Placement Best Practices

**Immediately before test:**
```typescript
// @clause CL-AUTH-001
test('should login', () => {})
```

**Grouped tags (within 5 lines):**
```typescript
// @clause CL-AUTH-001
// @clause CL-AUTH-002
// @clause CL-AUTH-003
test('complex validation', () => {})
```

**Avoid large gaps:**
```typescript
// @clause CL-AUTH-001

// ❌ Too much space (still works but discouraged)


test('should login', () => {})
```

---

## 3. Snapshot and Fragile Assertion Policy (T107)

### Snapshot Policy

**Rule:** Snapshots are DISCOURAGED as sole validation method.

**Rationale:**
- Snapshots are brittle (break on any change)
- Don't validate specific behavior
- Can hide regressions
- Create maintenance burden

**Enforcement:**
- NO_DECORATIVE_TESTS validator flags snapshot-only tests

**When snapshots are acceptable:**

✅ **With additional assertions:**
```typescript
// @clause CL-UI-001
test('renders user profile correctly', () => {
  const { container } = render(<UserProfile user={mockUser} />)

  // Specific assertions (primary validation)
  expect(screen.getByText('John Doe')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled()

  // Snapshot (supplementary)
  expect(container).toMatchSnapshot()
})
```

❌ **Snapshot only (decorative):**
```typescript
test('renders component', () => {
  const { container } = render(<Component />)
  expect(container).toMatchSnapshot()  // ❌ No specific validation
})
```

### Fragile Assertion Policy

**Rule:** Avoid assertions that break unnecessarily.

**Fragile patterns to avoid:**

❌ **Exact text matching (UI can change):**
```typescript
expect(button.textContent).toBe('Click Here!')  // ❌ Fragile
```

✅ **Better - Use data-testid:**
```typescript
expect(screen.getByTestId('submit-button')).toBeInTheDocument()
```

---

❌ **Hardcoded array lengths:**
```typescript
expect(users.length).toBe(5)  // ❌ Fragile (data changes)
```

✅ **Better - Validate behavior:**
```typescript
expect(users.length).toBeGreaterThan(0)
expect(users.every(u => u.id)).toBe(true)
```

---

❌ **Exact error message text:**
```typescript
expect(error.message).toBe('User not found in database')  // ❌ Fragile
```

✅ **Better - Use error codes:**
```typescript
expect(error.code).toBe('USER_NOT_FOUND')
```

---

❌ **CSS class names:**
```typescript
expect(element.className).toContain('button-primary-blue')  // ❌ Fragile
```

✅ **Better - Use ARIA roles or data-testid:**
```typescript
expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
```

### Recommended Assertion Patterns

**For HTTP APIs:**
```typescript
// @clause CL-API-001
test('POST /users creates user', async () => {
  const response = await request(app)
    .post('/users')
    .send({ name: 'John', email: 'john@example.com' })

  expect(response.status).toBe(201)           // Status code (stable)
  expect(response.body.id).toBeDefined()      // Structure (flexible)
  expect(response.body.name).toBe('John')     // Data (specific)
})
```

**For UI components:**
```typescript
// @clause CL-UI-001
test('displays user name in header', () => {
  render(<Header user={{ name: 'John Doe' }} />)

  expect(screen.getByRole('heading')).toHaveTextContent('John Doe')
  expect(screen.getByTestId('user-avatar')).toBeInTheDocument()
})
```

**For error handling:**
```typescript
// @clause CL-ERROR-001
test('throws error for invalid input', () => {
  expect(() => validate(null)).toThrow()
  expect(() => validate('')).toThrow('INVALID_INPUT')  // Error code
})
```

---

## 4. Best Practices

### Contract-First Development

1. **Define contract before writing tests:**
   - Identify observable behaviors
   - Create clauses in contract
   - Generate clause IDs
   - Tag tests with clause IDs

2. **Map tests to clauses:**
   - Every test validates at least one clause
   - Every clause has at least one test
   - Use tags for traceability

3. **Review coverage:**
   - Check CONTRACT_CLAUSE_COVERAGE output
   - Ensure all MUST clauses covered
   - Ensure all error clauses have negative tests

### Writing Testable Contracts

**Good clause (testable):**
```json
{
  "id": "CL-AUTH-001",
  "spec": "When user submits valid credentials via POST /api/auth/login, then response status is 200 and body contains JWT token",
  "observables": ["http"]
}
```

**Bad clause (not testable):**
```json
{
  "id": "CL-AUTH-001",
  "spec": "Authentication should be secure",  // ❌ Too vague
  "observables": ["internal"]  // ❌ Can't observe from test
}
```

### Organizing Tests

**By clause (recommended):**
```typescript
describe('CL-AUTH-001: JWT on successful login', () => {
  // @clause CL-AUTH-001
  test('returns 200 status', () => {})

  // @clause CL-AUTH-001
  test('returns valid JWT', () => {})
})

describe('CL-AUTH-002: Invalid credentials return 401', () => {
  // @clause CL-AUTH-002
  test('wrong password returns 401', () => {})

  // @clause CL-AUTH-002
  test('non-existent user returns 401', () => {})
})
```

### Tagging Strategy

**For simple clauses (1 tag):**
```typescript
// @clause CL-AUTH-001
test('should return JWT', () => {})
```

**For complex behaviors (multiple tags):**
```typescript
// @clause CL-AUTH-001  // JWT issuance
// @clause CL-AUDIT-001  // Audit logging
// @clause CL-SESSION-001  // Session creation
test('successful login creates session and logs event', () => {
  // Test validates all three clauses
})
```

---

## 5. Common Violations

### Violation 1: Unmapped Assertions (STRICT)

**Violation:**
```typescript
test('helper works', () => {
  expect(helper.calculate(5)).toBe(10)  // ❌ No @clause tag
})
```

**Fix:**
```typescript
// @clause CL-UTIL-001
test('helper works', () => {
  expect(helper.calculate(5)).toBe(10)
})
```

### Violation 2: Missing Coverage

**Violation:**
```json
{
  "clauses": [
    {"id": "CL-AUTH-001"},  // Has test ✅
    {"id": "CL-AUTH-002"}   // No test ❌
  ]
}
```

**Fix:**
```typescript
// Add test for CL-AUTH-002
// @clause CL-AUTH-002
test('invalid credentials return 401', () => {
  // Implementation
})
```

### Violation 3: Invalid Tag Format

**Violation:**
```typescript
// @clause cl-auth-001  // ❌ Lowercase
test('should login', () => {})
```

**Fix:**
```typescript
// @clause CL-AUTH-001  // ✅ Uppercase
test('should login', () => {})
```

### Violation 4: Tag References Non-Existent Clause

**Violation:**
```typescript
// @clause CL-AUTH-999  // ❌ Clause doesn't exist
test('should login', () => {})
```

**Fix Option 1 (Add clause to contract):**
```json
{
  "clauses": [
    {
      "id": "CL-AUTH-999",
      "kind": "behavior",
      "normativity": "MUST",
      "title": "...",
      "spec": "...",
      "observables": ["http"]
    }
  ]
}
```

**Fix Option 2 (Use existing clause):**
```typescript
// @clause CL-AUTH-001  // ✅ Use existing clause
test('should login', () => {})
```

### Violation 5: Decorative Test

**Violation:**
```typescript
test('renders component', () => {
  render(<Component />)
  // ❌ No assertions
})
```

**Fix:**
```typescript
// @clause CL-UI-001
test('renders component with required elements', () => {
  render(<Component />)
  expect(screen.getByRole('heading')).toBeInTheDocument()
  expect(screen.getByTestId('submit-button')).toBeEnabled()
})
```

---

**Version:** 1.0.0
**Status:** ✅ Frozen
**Last Updated:** 2026-01-18
