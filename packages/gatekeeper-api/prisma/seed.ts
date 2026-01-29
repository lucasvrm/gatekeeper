import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Create global workspace for test path conventions
  const globalWorkspace = await prisma.workspace.upsert({
    where: { name: '__global__' },
    create: {
      id: '__global__',
      name: '__global__',
      description: 'Global workspace for test path conventions',
      rootPath: '',
      artifactsDir: 'artifacts',
      isActive: false, // Hidden from UI
    },
    update: {
      description: 'Global workspace for test path conventions',
    },
  })

  console.log(`✓ Seeded global workspace: ${globalWorkspace.name}`)

  // Create default workspace
  const defaultWorkspace = await prisma.workspace.upsert({
    where: { name: 'Gatekeeper' },
    create: {
      name: 'Gatekeeper',
      description: 'Default workspace for Gatekeeper project',
      rootPath: process.env.PROJECT_ROOT || '',
      artifactsDir: 'artifacts',
    },
    update: {
      description: 'Default workspace for Gatekeeper project',
      artifactsDir: 'artifacts',
    },
  })

  console.log(`✓ Seeded default workspace: ${defaultWorkspace.name}`)

  // Create default project
  const defaultProject = await prisma.project.upsert({
    where: {
      workspaceId_name: {
        workspaceId: defaultWorkspace.id,
        name: 'gatekeeper',
      },
    },
    create: {
      workspaceId: defaultWorkspace.id,
      name: 'gatekeeper',
      description: 'Default project for validation runs',
      baseRef: 'origin/main',
      targetRef: 'HEAD',
      backendWorkspace: 'packages/gatekeeper-api',
    },
    update: {
      description: 'Default project for validation runs',
    },
  })

  console.log(`✓ Seeded default project: ${defaultProject.name}`)

  const sensitiveFileRules = [
    {
      pattern: '.env*',
      category: 'ENV',
      severity: 'BLOCK',
      description: 'Environment files with secrets',
    },
    {
      pattern: '**/.env',
      category: 'ENV',
      severity: 'BLOCK',
      description: 'Environment files in any directory',
    },
    {
      pattern: '**/migrations/**',
      category: 'MIGRATION',
      severity: 'BLOCK',
      description: 'Database migration files',
    },
    {
      pattern: '**/.github/**',
      category: 'CI_CD',
      severity: 'BLOCK',
      description: 'GitHub workflows and config',
    },
    {
      pattern: '**/*.pem',
      category: 'SECURITY',
      severity: 'BLOCK',
      description: 'PEM certificate files',
    },
    {
      pattern: '**/*.key',
      category: 'SECURITY',
      severity: 'BLOCK',
      description: 'Private key files',
    },
  ]

  for (const rule of sensitiveFileRules) {
    await prisma.sensitiveFileRule.upsert({
      where: { pattern: rule.pattern },
      create: rule,
      update: rule,
    })
  }

  console.log(`✓ Seeded ${sensitiveFileRules.length} sensitive file rules`)

  const ambiguousTerms = [
    { term: 'melhore', category: 'VAGUE_ACTION' },
    { term: 'otimize', category: 'VAGUE_ACTION' },
    { term: 'refatore', category: 'VAGUE_ACTION' },
    { term: 'arrume', category: 'VAGUE_ACTION' },
    { term: 'ajuste', category: 'VAGUE_ACTION' },
  ]

  for (const term of ambiguousTerms) {
    await prisma.ambiguousTerm.upsert({
      where: { term: term.term },
      create: term,
      update: term,
    })
  }

  console.log(`✓ Seeded ${ambiguousTerms.length} ambiguous terms`)

  const validationConfigs = [
    {
      key: 'MAX_TOKEN_BUDGET',
      value: '100000',
      type: 'NUMBER',
      category: 'GATE0',
      description: 'Maximum token budget for context',
    },
    {
      key: 'TOKEN_SAFETY_MARGIN',
      value: '0.8',
      type: 'NUMBER',
      category: 'GATE0',
      description: 'Safety margin multiplier for token budget',
    },
    {
      key: 'MAX_FILES_PER_TASK',
      value: '10',
      type: 'NUMBER',
      category: 'GATE0',
      description: 'Maximum files allowed per task',
    },
    {
      key: 'ALLOW_SOFT_GATES',
      value: 'true',
      type: 'BOOLEAN',
      category: 'GLOBAL',
      description: 'Allow soft gate failures to not block execution',
    },
    {
      key: 'PROJECT_ROOT',
      value: '',
      type: 'STRING',
      category: 'PATHS',
      description: 'Absolute path to project repository root (where package.json and .git are located)',
    },
    {
      key: 'BACKEND_WORKSPACE',
      value: 'packages/gatekeeper-api',
      type: 'STRING',
      category: 'PATHS',
      description: 'Relative path from PROJECT_ROOT to backend workspace (for manifest resolution)',
    },
    {
      key: 'ARTIFACTS_DIR',
      value: 'artifacts',
      type: 'STRING',
      category: 'PATHS',
      description: 'Relative path from PROJECT_ROOT to artifacts directory',
    },
    {
      key: 'TEST_FILE_PATH',
      value: '',
      type: 'STRING',
      category: 'PATHS',
      description: 'Full path to the test file for the current run (set by Gatekeeper)',
    },
    {
      key: 'SANDBOX_DIR',
      value: '',
      type: 'STRING',
      category: 'PATHS',
      description: 'Relative path from PROJECT_ROOT to sandbox directory for isolated test execution',
    },
  ]

  for (const config of validationConfigs) {
    await prisma.validationConfig.upsert({
      where: { key: config.key },
      create: config,
      update: {
        // Only update metadata, preserve user's value setting
        type: config.type,
        category: config.category,
        description: config.description,
      },
    })
  }

  console.log(`✓ Seeded ${validationConfigs.length} validation configs`)

  const validatorConfigs = [
    { key: 'TOKEN_BUDGET_FIT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TASK_SCOPE_SIZE', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TASK_CLARITY_CHECK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'SENSITIVE_FILES_LOCK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'DANGER_MODE_EXPLICIT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'PATH_CONVENTION', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'DELETE_DEPENDENCY_CHECK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TEST_SYNTAX_VALID', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TEST_HAS_ASSERTIONS', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TEST_COVERS_HAPPY_AND_SAD_PATH', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TEST_FAILS_BEFORE_IMPLEMENTATION', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'NO_DECORATIVE_TESTS', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'MANIFEST_FILE_LOCK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'NO_IMPLICIT_FILES', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'IMPORT_REALITY_CHECK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TEST_INTENT_ALIGNMENT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TEST_CLAUSE_MAPPING_VALID', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'UI_PLAN_COVERAGE', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'UI_TEST_COVERAGE', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'DIFF_SCOPE_ENFORCEMENT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TEST_READ_ONLY_ENFORCEMENT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TASK_TEST_PASSES', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'STRICT_COMPILATION', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'STYLE_CONSISTENCY_LINT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'FULL_REGRESSION_PASS', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'PRODUCTION_BUILD_PASS', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
  ]

  for (const config of validatorConfigs) {
    await prisma.validationConfig.upsert({
      where: { key: config.key },
      create: config,
      update: {
        // Only update metadata, preserve user's value setting
        type: config.type,
        category: config.category,
      },
    })
  }

  console.log(`✓ Seeded ${validatorConfigs.length} validator configs`)

  const validatorMetadata = [
    // Gate 0 - SANITIZATION
    { code: 'TOKEN_BUDGET_FIT', displayName: 'Token Budget Fit', description: 'Verifica se o contexto cabe na janela da LLM com folga', category: 'INPUT_SCOPE', gate: 0, order: 1, isHardBlock: true },
    { code: 'TASK_SCOPE_SIZE', displayName: 'Task Scope Limit', description: 'Verifica se o escopo da tarefa é adequado', category: 'INPUT_SCOPE', gate: 0, order: 2, isHardBlock: true },
    { code: 'TASK_CLARITY_CHECK', displayName: 'Task Clarity Check', description: 'Verifica se o prompt não contém termos ambíguos', category: 'INPUT_SCOPE', gate: 0, order: 3, isHardBlock: true },
    { code: 'SENSITIVE_FILES_LOCK', displayName: 'Sensitive Files Lock', description: 'Bloqueia modificação de arquivos sensíveis', category: 'SECURITY', gate: 0, order: 4, isHardBlock: true },
    { code: 'DANGER_MODE_EXPLICIT', displayName: 'Danger Mode Explicit', description: 'Exige arquivo sensível se dangerMode ativado', category: 'SECURITY', gate: 0, order: 5, isHardBlock: true },
    { code: 'PATH_CONVENTION', displayName: 'Path Naming Convention', description: 'Verifica se o teste está no caminho correto de acordo com as convenções configuradas', category: 'FILE_DISCIPLINE', gate: 0, order: 6, isHardBlock: true },
    { code: 'DELETE_DEPENDENCY_CHECK', displayName: 'Delete Dependency Check', description: 'Verifica se arquivos que importam arquivos deletados estão incluídos no manifest', category: 'FILE_DISCIPLINE', gate: 0, order: 7, isHardBlock: true },

    // Gate 1 - CONTRACT
    { code: 'TEST_SYNTAX_VALID', displayName: 'Test Syntax Valid', description: 'Verifica se o arquivo de teste compila', category: 'TESTS_CONTRACTS', gate: 1, order: 1, isHardBlock: true },
    { code: 'TEST_HAS_ASSERTIONS', displayName: 'Test Has Assertions', description: 'Verifica se o teste contém asserções', category: 'TESTS_CONTRACTS', gate: 1, order: 2, isHardBlock: true },
    { code: 'TEST_COVERS_HAPPY_AND_SAD_PATH', displayName: 'Test Covers Happy and Sad Path', description: 'Verifica cobertura de cenários positivos e negativos', category: 'TESTS_CONTRACTS', gate: 1, order: 3, isHardBlock: true },
    { code: 'TEST_FAILS_BEFORE_IMPLEMENTATION', displayName: 'Test Fails Before Implementation', description: 'CLÁUSULA PÉTREA: Teste deve falhar no base_ref', category: 'TESTS_CONTRACTS', gate: 1, order: 4, isHardBlock: true },
    { code: 'NO_DECORATIVE_TESTS', displayName: 'No Meaningless Tests', description: 'Bloqueia testes vazios ou sem asserções reais', category: 'TESTS_CONTRACTS', gate: 1, order: 5, isHardBlock: true },
    { code: 'MANIFEST_FILE_LOCK', displayName: 'Manifest File Lock', description: 'Verifica integridade do manifesto', category: 'FILE_DISCIPLINE', gate: 1, order: 6, isHardBlock: true },
    { code: 'NO_IMPLICIT_FILES', displayName: 'No Implicit Files', description: 'Bloqueia referências implícitas no prompt', category: 'FILE_DISCIPLINE', gate: 1, order: 7, isHardBlock: true },
    { code: 'IMPORT_REALITY_CHECK', displayName: 'Imports Must Exist', description: 'Verifica se imports do teste existem', category: 'SECURITY', gate: 1, order: 8, isHardBlock: true },
    { code: 'TEST_INTENT_ALIGNMENT', displayName: 'Test Intent Alignment', description: 'Verifica alinhamento entre prompt e teste', category: 'TESTS_CONTRACTS', gate: 1, order: 9, isHardBlock: false },
    { code: 'TEST_CLAUSE_MAPPING_VALID', displayName: 'Test Contract Mapping Valid', description: 'Valida mapeamento entre testes e cláusulas do contrato', category: 'TESTS_CONTRACTS', gate: 1, order: 10, isHardBlock: true },
    { code: 'UI_PLAN_COVERAGE', displayName: 'UI Plan Coverage', description: 'Valida cobertura de cláusulas UI no manifest/plan', category: 'TESTS_CONTRACTS', gate: 1, order: 11, isHardBlock: true },
    { code: 'UI_TEST_COVERAGE', displayName: 'UI Test Coverage', description: 'Valida cobertura de testes para cláusulas UI', category: 'TESTS_CONTRACTS', gate: 1, order: 12, isHardBlock: false },

    // Gate 2 - EXECUTION
    { code: 'DIFF_SCOPE_ENFORCEMENT', displayName: 'Diff Scope Enforcement', description: 'Verifica se diff está contido no manifesto', category: 'TECHNICAL_QUALITY', gate: 2, order: 1, isHardBlock: true },
    { code: 'TEST_READ_ONLY_ENFORCEMENT', displayName: 'Test Read Only Enforcement', description: 'Verifica se arquivos de teste não foram modificados', category: 'TECHNICAL_QUALITY', gate: 2, order: 2, isHardBlock: true },
    { code: 'TASK_TEST_PASSES', displayName: 'Task Test Passes', description: 'Verifica se o teste da tarefa passa', category: 'TESTS_CONTRACTS', gate: 2, order: 3, isHardBlock: true },
    { code: 'STRICT_COMPILATION', displayName: 'Strict Compilation', description: 'Verifica compilação sem erros', category: 'TECHNICAL_QUALITY', gate: 2, order: 4, isHardBlock: true },
    { code: 'STYLE_CONSISTENCY_LINT', displayName: 'Style Consistency Lint', description: 'Verifica conformidade com ESLint', category: 'TECHNICAL_QUALITY', gate: 2, order: 5, isHardBlock: true },

    // Gate 3 - INTEGRITY
    { code: 'FULL_REGRESSION_PASS', displayName: 'Full Regression Pass', description: 'Verifica se todos os testes passam', category: 'TECHNICAL_QUALITY', gate: 3, order: 1, isHardBlock: true },
    { code: 'PRODUCTION_BUILD_PASS', displayName: 'Production Build Pass', description: 'Verifica se build de produção funciona', category: 'TECHNICAL_QUALITY', gate: 3, order: 2, isHardBlock: true },
  ]

  for (const metadata of validatorMetadata) {
    await prisma.validatorMetadata.upsert({
      where: { code: metadata.code },
      create: metadata,
      update: metadata,
    })
  }

  console.log(`✓ Seeded ${validatorMetadata.length} validator metadata entries`)

  const testPathConventions = [
    {
      testType: 'component',
      pathPattern: 'src/components/{name}.spec.tsx',
      description: 'React components',
    },
    {
      testType: 'hook',
      pathPattern: 'src/hooks/{name}.spec.ts',
      description: 'Custom React hooks',
    },
    {
      testType: 'lib',
      pathPattern: 'src/lib/{name}.spec.ts',
      description: 'Library functions',
    },
    {
      testType: 'util',
      pathPattern: 'src/lib/utils/{name}.spec.ts',
      description: 'Utility functions',
    },
    {
      testType: 'service',
      pathPattern: 'src/services/{name}.spec.ts',
      description: 'API services',
    },
    {
      testType: 'context',
      pathPattern: 'src/context/{name}.spec.tsx',
      description: 'React Context providers',
    },
    {
      testType: 'page',
      pathPattern: 'src/pages/{name}.spec.tsx',
      description: 'Page components',
    },
    {
      testType: 'store',
      pathPattern: 'src/store/{name}.spec.ts',
      description: 'State management',
    },
    {
      testType: 'api',
      pathPattern: 'packages/gatekeeper-api/src/api/{name}.spec.ts',
      description: 'Backend API routes and controllers',
    },
    {
      testType: 'validator',
      pathPattern: 'packages/gatekeeper-api/src/domain/validators/{name}.spec.ts',
      description: 'Gatekeeper validators',
    },
  ]

  // Create global conventions (workspaceId = "__global__" for backward compatibility)
  for (const convention of testPathConventions) {
    await prisma.testPathConvention.upsert({
      where: {
        workspaceId_testType: {
          workspaceId: '__global__',
          testType: convention.testType,
        },
      },
      create: {
        ...convention,
        workspaceId: '__global__',
      },
      update: {
        pathPattern: convention.pathPattern,
        description: convention.description,
      },
    })
  }

  console.log(`✓ Seeded ${testPathConventions.length} global test path conventions`)

  console.log('✓ Seed completed successfully')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
