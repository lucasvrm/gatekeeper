# Gatekeeper API - Quick Reference

## 🚀 All 25 Validators (Updated)

### Gate 0: SANITIZATION 🧹 (5 validators)
Validates input and scope before processing

1. **TOKEN_BUDGET_FIT** (order: 1, hard)
   - Ensures context fits within LLM token window with safety margin
   - Checks: taskPrompt + manifest + files against budget

2. **TASK_SCOPE_SIZE** (order: 2, hard)
   - Validates task scope is manageable
   - Checks: Number of files in manifest vs MAX_FILES_PER_TASK

3. **TASK_CLARITY_CHECK** (order: 3, hard)
   - Blocks ambiguous terms in prompts
   - Checks: "melhore", "otimize", "refatore", "arrume", "ajuste"

4. **SENSITIVE_FILES_LOCK** (order: 4, hard)
   - Prevents modification of sensitive files
   - Checks: .env*, migrations, .github, *.pem, *.key patterns

5. **DANGER_MODE_EXPLICIT** (order: 5, hard)
   - Requires explicit justification for dangerMode
   - Checks: dangerMode flag coherence with sensitive files

---

### Gate 1: CONTRACT 📜 (13 validators)
Validates test contract and TDD compliance

6. **CONTRACT_SCHEMA_VALID** (order: 1, hard) ⭐ NEW 📜
   - Validates contract structure when present
   - Checks: Zod schema, duplicate clause IDs, required fields
   - SKIPS if contract absent (backward compatible)

7. **TEST_CLAUSE_MAPPING_VALID** (order: 2, mode-dependent) ⭐ NEW 📜
   - Validates @clause tags reference valid clause IDs
   - STRICT: FAILED on invalid tags | CREATIVE: WARNING
   - Honors `testMapping.allowMultiple`, `allowUntagged`, and `untaggedAllowlist` so setup helpers can remain untagged.
   - Evidence surfaces invalid tags, tests missing tags, and allowlisted helpers for quick triage.
   - SKIPS if contract absent

8. **CONTRACT_CLAUSE_COVERAGE** (order: 3, mode-dependent) ⭐ NEW 📜
   - Validates all clauses have test mappings
   - STRICT: 100% required | CREATIVE: criticality-based minimum
   - Derives per-clause minimums from `expectedCoverage` or the contract's `normativity`/`kind`; creative runs warn unless `criticality=critical`.
   - Returns uncovered clause IDs plus a snapshot of tests covering other clauses as evidence.
   - SKIPS if contract absent

9. **NO_OUT_OF_CONTRACT_ASSERTIONS** (order: 4, mode-dependent) ⭐ NEW 📜
   - Validates all assertions mapped to clauses
   - STRICT: FAILED on unmapped | CREATIVE: WARNING
   - Validates endpoints / status codes / payload paths / selectors / error codes against `assertionSurface`
   - Ignores helper assertions (render/fireEvent/screen/console logging) and reports them in `details.skippedAssertions`
   - Structural assertions without surfaces remain allowed; extend `assertionSurface` when new targets need coverage
   - SKIPS if contract absent

10. **TEST_SYNTAX_VALID** (order: 5, hard)
    - Verifies test file compiles
    - Runs: tsc --noEmit on test file

11. **TEST_HAS_ASSERTIONS** (order: 6, hard)
    - Ensures test contains assertions
    - Checks: expect(), assert(), should patterns

12. **TEST_COVERS_HAPPY_AND_SAD_PATH** (order: 7, hard)
    - Validates both success and error scenarios
    - Checks: Happy path (success, should, valid) + Sad path (error, fail, throws)
    - When a contract with behavior clauses is present, ensures clauses have both happy and sad coverage when required; creative mode only warns

13. **TEST_FAILS_BEFORE_IMPLEMENTATION** (order: 8, hard) 🔒 CLÁUSULA PÉTREA
    - TDD red phase enforcement (IMMUTABLE)
    - Runs: Test at base_ref must fail

14. **NO_DECORATIVE_TESTS** (order: 9, hard)
    - Blocks empty/meaningless tests
    - Checks: Empty test bodies, render without assertions, snapshot-only

15. **MANIFEST_FILE_LOCK** (order: 10, hard)
    - Verifies manifest integrity
    - Checks: Valid structure, no globs, no vague terms, proper actions

16. **NO_IMPLICIT_FILES** (order: 11, hard)
    - Blocks vague file references
    - Checks: "other files", "etc", "...", "related files"

17. **IMPORT_REALITY_CHECK** (order: 12, hard)
    - Validates imports exist
    - Checks: Relative paths + package.json dependencies

18. **TEST_INTENT_ALIGNMENT** (order: 13, **SOFT**) 💡
    - Warns on low prompt/test alignment
    - Returns: WARNING (not FAILED) if < 30% keyword overlap
    - Clause tags suppress warnings and return PASSED with `details.alignmentDeemphasized` when contract coverage already drives the intent check

--- 

### Gate 2: EXECUTION ⚙️ (5 validators)
Validates execution and code quality

19. **DIFF_SCOPE_ENFORCEMENT** (order: 1, hard)
    - Ensures diff matches manifest
    - Checks: All diff files ∈ manifest files

20. **TEST_READ_ONLY_ENFORCEMENT** (order: 2, hard)
    - Prevents modification of existing tests
    - Exception: Allows manifest.testFile creation

21. **TASK_TEST_PASSES** (order: 3, hard)
    - Verifies task test passes
    - Runs: Test at target_ref

22. **STRICT_COMPILATION** (order: 4, hard)
    - Ensures code compiles
    - Runs: tsc --noEmit on entire project

23. **STYLE_CONSISTENCY_LINT** (order: 5, hard)
    - Validates code style
    - Runs: ESLint on manifest files (skips if no config)

---

### Gate 3: INTEGRITY 🏗️ (2 validators)
Final system integrity validation

24. **FULL_REGRESSION_PASS** (order: 1, hard)
    - All tests must pass
    - Runs: npm test

25. **PRODUCTION_BUILD_PASS** (order: 2, hard)
    - Production build succeeds
    - Runs: npm run build

---

## 🔑 Key Concepts

### Hard Block vs Soft Gate
- **Hard Block**: Validation failure stops the pipeline
- **Soft Gate**: Validation returns WARNING, pipeline continues

### CLÁUSULA PÉTREA
- Immutable rule: Test MUST fail at base_ref
- Enforces TDD red-green-refactor
- Can NEVER be softened or bypassed

### Danger Mode
- Allows modification of sensitive files
- Requires explicit activation
- Must be justified by actual sensitive file presence

### Contract (Optional)
- **Tests as Contracts**: Structured validation of behavioral contracts
- **Optional Field**: Contract field in plan.json is optional (backward compatible)
- **STRICT Mode**: 100% coverage, all assertions mapped (hard-block)
- **CREATIVE Mode**: Partial coverage allowed, unmapped assertions → WARNING
- **SKIP Behavior**: All 4 contract validators SKIP when contract absent
- **Tag Format**: `// @clause CL-<TYPE>-<SEQUENCE>`

---

## 📊 Validation Pipeline

```
POST /api/runs (with plan.json + optional contract)
    ↓
Queue (single concurrency)
    ↓
Build Context (load contract if present)
    ↓
Gate 0: SANITIZATION (5 validators)
    ↓ PASS
Gate 1: CONTRACT (13 validators)
    ├─ 4 contract validators (SKIP if no contract)
    └─ 9 existing validators
    ↓ PASS
Gate 2: EXECUTION (5 validators)
    ↓ PASS
Gate 3: INTEGRITY (2 validators)
    ↓ PASS
Status: PASSED ✅
```

If any **hard block** fails → Status: FAILED ❌
If only **soft gates** fail → Status: PASSED with WARNINGS ⚠️
Contract validators **SKIP** if contract field absent (backward compatible)

---

## 🧪 Testing Commands

```bash
# Run all tests
npm test

# Run specific test file
npx vitest run tests/unit/validators/TestCoversHappyAndSadPath.test.ts

# Run tests in watch mode
npx vitest

# Run with coverage
npx vitest --coverage
```

---

## 🔧 Configuration Keys

Available in database (ValidationConfig table):

- `MAX_TOKEN_BUDGET` (default: 100000)
- `TOKEN_SAFETY_MARGIN` (default: 0.8)
- `MAX_FILES_PER_TASK` (default: 10)
- `ALLOW_SOFT_GATES` (default: true)

Update via API:
```bash
curl -X PUT http://localhost:3000/api/config/MAX_TOKEN_BUDGET \
  -H "Content-Type: application/json" \
  -d '{"value": "150000"}'
```

---

## 📁 Project Structure

```
packages/gatekeeper-api/
├── src/
│   ├── domain/validators/
│   │   ├── gate0/ (5 validators)
│   │   ├── gate1/ (13 validators) ⭐ 4 contract validators
│   │   ├── gate2/ (5 validators)
│   │   └── gate3/ (2 validators)
│   ├── utils/
│   │   ├── clauseTagParser.ts (contract tag parsing)
│   │   └── assertionParser.ts (assertion detection)
│   ├── types/
│   │   └── contract.types.ts (contract type definitions)
│   ├── config/
│   │   ├── gates.config.ts (25 validators)
│   │   └── defaults.ts (git ref defaults)
│   ├── services/ (8 services)
│   ├── repositories/ (3 repos)
│   └── api/ (12 endpoints)
├── tests/
│   ├── unit/validators/ (25 validator tests)
│   └── integration/
└── prisma/
    └── schema.prisma (9+ models)
```

---

## 🎯 Example Request

```json
POST /api/runs
{
  "projectPath": "/path/to/project",
  "taskPrompt": "Implement user authentication with email validation",
  "manifest": {
    "files": [
      {
        "path": "src/auth.ts",
        "action": "CREATE",
        "reason": "New authentication module"
      }
    ],
    "testFile": "tests/auth.test.ts"
  },
  "testFilePath": "tests/auth.test.ts",
  "baseRef": "HEAD~1",
  "targetRef": "HEAD",
  "dangerMode": false
}
```

Response:
```json
{
  "id": "clx...",
  "status": "PENDING",
  "createdAt": "2025-01-15T..."
}
```

---

## 🏆 Quality Metrics

- **Code Coverage**: 100% TypeScript
- **Test Cases**: 100+
- **Validators**: 25/25 (100%) ⭐ +4 contract validators
- **API Endpoints**: 12/12 (100%)
- **Services**: 8/8 (100%)
- **Documentation**: Complete with contract support

---

## 📚 Documentation Files

**Project Docs:**
- `README.md` - Project overview
- `QUICK_REFERENCE.md` - This file (25 validators)
- `BUILD_STATUS.md` - Implementation status
- `IMPLEMENTATION_GUIDE.md` - Setup guide
- `PROJECT_STRUCTURE.md` - File structure

**Gatekeeper Docs (docs/):**
- `REFERENCE.md` - Complete API reference (plan.json + contract)
- `RULES.md` - Contract.json v1 specification
- `TESTS_RULES.md` - Test writing rules
- `plannerGuide.md` - Planner guide (generating plan.json)
- `execGuide.md` - Executor guide (running validation)
- `examples/` - Reference contract examples

---

**Last Updated**: January 2026
**Status**: ✅ Production Ready
**Version**: 1.0.0 (Contract Support)
