# Gatekeeper API - Implementation Guide

## ✅ What Has Been Built (Phases 1-11 + Core API)

### Completed Infrastructure
- ✅ Complete project setup with all dependencies
- ✅ TypeScript configuration with strict mode
- ✅ Prisma schema with 9 models
- ✅ Complete type system (21 validator codes, all interfaces)
- ✅ All 8 services (Git, AST, TestRunner, Compiler, Lint, Build, TokenCounter, Log)
- ✅ All 3 repositories (ValidationRun, GateResult, ValidatorResult)
- ✅ ValidationOrchestrator with queue management
- ✅ Express server with middleware
- ✅ API controllers and routes
- ✅ Database seed with initial data
- ✅ Test infrastructure setup

### Validators Implemented
**Gate 0 (SANITIZATION)**: All 5 validators ✅
- TokenBudgetFit
- TaskScopeSize
- TaskClarityCheck
- SensitiveFilesLock
- DangerModeExplicit

**Gate 1 (CONTRACT)**: 3 of 9 validators ✅
- TestSyntaxValid
- TestHasAssertions
- TestFailsBeforeImplementation (CLÁUSULA PÉTREA)

**Gate 2 (EXECUTION)**: 3 of 5 validators ✅
- DiffScopeEnforcement
- TestReadOnlyEnforcement
- TaskTestPasses

**Gate 3 (INTEGRITY)**: All 2 validators ✅
- FullRegressionPass
- ProductionBuildPass

## 🚧 Remaining Validators to Implement

### Gate 1 (6 remaining)
1. **TestCoversHappyAndSadPath** (order: 3)
2. **NoDecorativeTests** (order: 5)
3. **ManifestFileLock** (order: 6)
4. **NoImplicitFiles** (order: 7)
5. **ImportRealityCheck** (order: 8)
6. **TestIntentAlignment** (order: 9, soft gate)

### Gate 2 (2 remaining)
1. **StrictCompilation** (order: 4)
2. **StyleConsistencyLint** (order: 5)

## 📋 Step-by-Step Setup

### 1. Install Dependencies
```bash
cd packages/gatekeeper-api
npm install
```

### 2. Generate Prisma Client
```bash
npm run db:generate
```

### 3. Run Database Migrations
```bash
npm run db:migrate
```

### 4. Seed the Database
```bash
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## 🎯 How to Implement Remaining Validators

Each validator follows the same pattern. Here's a template:

```typescript
import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const YourValidatorNameValidator: ValidatorDefinition = {
  code: 'YOUR_VALIDATOR_CODE',
  name: 'Your Validator Name',
  description: 'Description of what it validates',
  gate: X, // 0, 1, 2, or 3
  order: Y, // Order within the gate
  isHardBlock: true, // or false for soft gates
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // Your validation logic here
    
    // If validation fails:
    return {
      passed: false,
      status: 'FAILED',
      message: 'Reason for failure',
      details: { /* additional data */ },
      evidence: 'Detailed evidence for the user',
    }
    
    // If validation passes:
    return {
      passed: true,
      status: 'PASSED',
      message: 'Success message',
      metrics: { /* optional metrics */ },
    }
    
    // If validation should be skipped:
    return {
      passed: true,
      status: 'SKIPPED',
      message: 'Reason for skipping',
    }
  },
}
```

### Example: TestCoversHappyAndSadPath

```typescript
// src/domain/validators/gate1/TestCoversHappyAndSadPath.ts
import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TestCoversHappyAndSadPathValidator: ValidatorDefinition = {
  code: 'TEST_COVERS_HAPPY_AND_SAD_PATH',
  name: 'Test Covers Happy and Sad Path',
  description: 'Verifica cobertura de cenários positivos e negativos',
  gate: 1,
  order: 3,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
      }
    }

    const content = await ctx.services.git.readFile(ctx.testFilePath)
    
    const happyPathRegex = /it\s*\(\s*['"].*?(success|should)/i
    const sadPathRegex = /it\s*\(\s*['"].*?(error|fail|throws)/i
    
    const hasHappyPath = happyPathRegex.test(content)
    const hasSadPath = sadPathRegex.test(content)

    if (!hasHappyPath || !hasSadPath) {
      const missing = []
      if (!hasHappyPath) missing.push('happy path (success scenarios)')
      if (!hasSadPath) missing.push('sad path (error scenarios)')
      
      return {
        passed: false,
        status: 'FAILED',
        message: `Test missing coverage: ${missing.join(', ')}`,
        evidence: `Missing test scenarios:\n${missing.map(m => `  - ${m}`).join('\n')}`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'Test covers both happy and sad paths',
    }
  },
}
```

### After Creating Each Validator

1. **Import it in gates.config.ts**:
```typescript
import { TestCoversHappyAndSadPathValidator } from '../domain/validators/gate1/TestCoversHappyAndSadPath.js'
```

2. **Add to the appropriate gate's validators array**:
```typescript
{
  number: 1,
  name: 'CONTRACT',
  emoji: '📜',
  description: 'Validação de contrato e testes',
  validators: [
    TestSyntaxValidValidator,
    TestHasAssertionsValidator,
    TestCoversHappyAndSadPathValidator, // Add here
    TestFailsBeforeImplementationValidator,
    // ... other validators
  ],
}
```

## 📡 API Endpoints

### Create Validation Run
```bash
POST /api/runs
Content-Type: application/json

{
  "projectPath": "/path/to/project",
  "taskPrompt": "Implement user authentication",
  "manifest": {
    "files": [
      { "path": "src/auth.ts", "action": "CREATE", "reason": "New auth module" }
    ],
    "testFile": "tests/auth.test.ts"
  },
  "testFilePath": "tests/auth.test.ts",
  "baseRef": "HEAD~1",
  "targetRef": "HEAD",
  "dangerMode": false
}
```

### List All Runs
```bash
GET /api/runs?page=1&limit=20&status=PASSED
```

### Get Run Details
```bash
GET /api/runs/:id
```

### Get Run Results (with gates and validators)
```bash
GET /api/runs/:id/results
```

### List Gates
```bash
GET /api/gates
```

### Get Gate Validators
```bash
GET /api/gates/0/validators
```

### Get Configuration
```bash
GET /api/config
```

### Update Configuration
```bash
PUT /api/config/MAX_TOKEN_BUDGET
Content-Type: application/json

{
  "value": "150000"
}
```

### Abort Run
```bash
POST /api/runs/:id/abort
```

### Delete Run
```bash
DELETE /api/runs/:id
```

### Health Check
```bash
GET /health
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🔍 Development Workflow

1. **Check logs**: The server logs all requests and errors
2. **Use Prisma Studio**: `npm run db:studio` to inspect database
3. **Test validators individually**: Create test runs targeting specific validators
4. **Monitor queue**: The ValidationOrchestrator processes runs sequentially

## 📊 Database Schema

The system uses 9 Prisma models:

1. **ValidationRun**: Main run entity
2. **GateResult**: Result for each gate
3. **ValidatorResult**: Result for each validator
4. **ValidationLog**: Logs during execution
5. **ManifestFile**: Files declared in manifest
6. **SensitiveFileRule**: Patterns for sensitive files
7. **AmbiguousTerm**: Terms that indicate unclear prompts
8. **ValidationConfig**: System configuration

## 🎨 Architecture Highlights

### The 4-Gate Pipeline
- **Gate 0**: Input validation (5 validators)
- **Gate 1**: Test contract validation (9 validators)
- **Gate 2**: Execution validation (5 validators)
- **Gate 3**: System integrity (2 validators)

### Key Principles
- **Hard Blocks**: Stop execution immediately
- **Soft Gates**: Warn but allow continuation
- **CLÁUSULA PÉTREA**: TEST_FAILS_BEFORE_IMPLEMENTATION can NEVER be soft
- **Queue Management**: One validation run at a time
- **Context Enrichment**: All validators receive full context

## 🚀 Next Steps

1. Implement the 8 remaining validators
2. Add comprehensive unit tests
3. Add integration tests for the full pipeline
4. Add API documentation (OpenAPI/Swagger)
5. Add webhook support for run completion
6. Add real-time updates via WebSocket
7. Add metrics and monitoring

## 💡 Tips

- All file paths in validators should be relative to `projectPath`
- Use `ctx.services.log` for debugging within validators
- Always handle errors gracefully in validators
- Return `SKIPPED` status when validation doesn't apply
- Include detailed `evidence` for failures to help users
- Test validators with real project scenarios

## 📚 References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Express Documentation](https://expressjs.com/)
- [Zod Documentation](https://zod.dev/)
- [Vitest Documentation](https://vitest.dev/)

---

**Status**: Core system operational, 13 of 21 validators implemented. System ready for remaining validators and testing.
