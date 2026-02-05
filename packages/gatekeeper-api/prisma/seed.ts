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
      ['key']: 'MAX_TOKEN_BUDGET',
      value: '100000',
      type: 'NUMBER',
      category: 'GATE0',
      description: 'Maximum token budget for context',
    },
    {
      ['key']: 'TOKEN_SAFETY_MARGIN',
      value: '0.8',
      type: 'NUMBER',
      category: 'GATE0',
      description: 'Safety margin multiplier for token budget',
    },
    {
      ['key']: 'MAX_FILES_PER_TASK',
      value: '10',
      type: 'NUMBER',
      category: 'GATE0',
      description: 'Maximum files allowed per task',
    },
    {
      ['key']: 'ALLOW_SOFT_GATES',
      value: 'true',
      type: 'BOOLEAN',
      category: 'GLOBAL',
      description: 'Allow soft gate failures to not block execution',
    },
    {
      ['key']: 'PROJECT_ROOT',
      value: '',
      type: 'STRING',
      category: 'PATHS',
      description: 'Absolute path to project repository root (where package.json and .git are located)',
    },
    {
      ['key']: 'BACKEND_WORKSPACE',
      value: 'packages/gatekeeper-api',
      type: 'STRING',
      category: 'PATHS',
      description: 'Relative path from PROJECT_ROOT to backend workspace (for manifest resolution)',
    },
    {
      ['key']: 'ARTIFACTS_DIR',
      value: 'artifacts',
      type: 'STRING',
      category: 'PATHS',
      description: 'Relative path from PROJECT_ROOT to artifacts directory',
    },
    {
      ['key']: 'TEST_FILE_PATH',
      value: '',
      type: 'STRING',
      category: 'PATHS',
      description: 'Full path to the test file for the current run (set by Gatekeeper)',
    },
    {
      ['key']: 'SANDBOX_DIR',
      value: '',
      type: 'STRING',
      category: 'PATHS',
      description: 'Relative path from PROJECT_ROOT to sandbox directory for isolated test execution',
    },
    {
      ['key']: 'DIFF_SCOPE_GLOBAL_EXCLUSIONS',
      value: 'package-lock.json,yarn.lock,pnpm-lock.yaml',
      type: 'STRING',
      category: 'GATE2',
      description: 'Comma-separated glob patterns for files globally excluded from diff scope. Supports glob (e.g. **/*.generated.ts, .husky/**) and plain substrings. These files are never considered in scope validation.',
    },
    {
      ['key']: 'DIFF_SCOPE_INCOMPLETE_FAIL_MODE',
      value: 'HARD',
      type: 'STRING',
      category: 'GATE2',
      description: 'How to handle incomplete implementation: HARD (fail) or WARNING (warn only)',
    },
    {
      ['key']: 'DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF',
      value: 'true',
      type: 'BOOLEAN',
      category: 'GATE2',
      description: 'Allow diffs that only contain the test file (no implementation files)',
    },
    {
      ['key']: 'DIFF_SCOPE_INCLUDE_WORKING_TREE',
      value: 'true',
      type: 'BOOLEAN',
      category: 'VALIDATOR',
      description: 'Include working tree changes (staged, unstaged, untracked) in diff scope validation',
    },
    {
      ['key']: 'DELETE_CHECK_IGNORE_DIRS',
      value: 'node_modules,.git,dist,build,coverage,.next,.cache',
      type: 'STRING',
      category: 'GATE0',
      description: 'Comma-separated directories ignored by DeleteDependencyCheck validator',
    },
    {
      ['key']: 'HAPPY_PATH_KEYWORDS',
      value: 'success,should,valid,passes,correctly,works,returns',
      type: 'STRING',
      category: 'GATE1',
      description: 'Comma-separated keywords for happy path detection in tests',
    },
    {
      ['key']: 'SAD_PATH_KEYWORDS',
      value: 'error,fail,throws,invalid,not,reject,deny,block',
      type: 'STRING',
      category: 'GATE1',
      description: 'Comma-separated keywords for sad path detection in tests',
    },
    {
      ['key']: 'ESLINT_CONFIG_FILES',
      value: 'eslint.config.js,eslint.config.mjs,eslint.config.cjs,.eslintrc.js,.eslintrc.json,.eslintrc',
      type: 'STRING',
      category: 'GATE2',
      description: 'Comma-separated ESLint config filenames to search for',
    },
    {
      ['key']: 'SKIP_LINT_IF_NO_CONFIG',
      value: 'true',
      type: 'BOOLEAN',
      category: 'GATE2',
      description: 'Skip linting when no ESLint config is found',
    },
    {
      ['key']: 'EXTRA_BUILTIN_MODULES',
      value: '',
      type: 'STRING',
      category: 'GATE1',
      description: 'Comma-separated module names treated as built-in for import validation',
    },
    {
      ['key']: 'PATH_ALIASES',
      value: '@/:src/',
      type: 'STRING',
      category: 'GATE1',
      description: 'Comma-separated path aliases in the format alias:path',
    },
    {
      ['key']: 'TYPE_DETECTION_PATTERNS',
      value: 'component:/(components?|ui|widgets?|layout|views?)/,hook:/hooks?/,lib:/lib/,util:/utils?/,service:/services?/',
      type: 'STRING',
      category: 'GATE0',
      description: 'Comma-separated type:regex patterns for PathConvention detection',
    },
    {
      ['key']: 'TEST_READ_ONLY_EXCLUDED_PATHS',
      value: 'artifacts/**',
      type: 'STRING',
      category: 'GATE2',
      description: 'Comma-separated glob patterns excluded from test read-only enforcement',
    },
    {
      ['key']: 'ALLOW_UNTAGGED_TESTS',
      value: 'false',
      type: 'BOOLEAN',
      category: 'GATE1',
      description: 'Allow tests without @clause tags to pass TestClauseMappingValid (true = warning only, false = fail)',
    },
    {
      ['key']: 'FRAGILE_PATTERNS',
      value: '.querySelector(,.querySelectorAll(,.getElementsByClassName(,.getElementsByTagName(,.getElementById(,.className,.innerHTML,.outerHTML,.style.,container.firstChild,container.children,wrapper.find(,.dive(),toMatchSnapshot(),toMatchInlineSnapshot()',
      type: 'STRING',
      category: 'GATE1',
      description: 'Comma-separated patterns indicating fragile implementation-dependent tests (TestResilienceCheck)',
    },
    {
      ['key']: 'RESILIENT_PATTERNS',
      value: 'getByRole(,getByText(,getByLabelText(,getByPlaceholderText(,getByDisplayValue(,getByAltText(,getByTitle(,getByTestId(,findByRole(,findByText(,userEvent.,screen.,toBeVisible(),toBeInTheDocument(),toHaveTextContent(,toHaveAccessibleName(,toHaveAttribute(',
      type: 'STRING',
      category: 'GATE1',
      description: 'Comma-separated patterns indicating resilient behavior-based tests (TestResilienceCheck)',
    },
    {
      ['key']: 'SKIP_NON_UI_TESTS',
      value: 'true',
      type: 'BOOLEAN',
      category: 'GATE1',
      description: 'Skip TestResilienceCheck for non-UI test files (files without render/screen/testing-library)',
    },
    {
      ['key']: 'UI_IGNORED_COMPONENT_PREFIXES',
      value: 'Lucide,Icon',
      type: 'STRING',
      category: 'GATE2',
      description: 'Comma-separated component name prefixes ignored by UIComponentRegistry validation',
    },
    {
      ['key']: 'UI_ALLOWED_EXTRA_COMPONENTS',
      value: '',
      type: 'STRING',
      category: 'GATE2',
      description: 'Comma-separated extra component names allowed beyond the registry (UIComponentRegistry)',
    },
    {
      ['key']: 'UI_STRICT_PROPS',
      value: 'false',
      type: 'BOOLEAN',
      category: 'GATE2',
      description: 'Enable strict mode for UIPropsCompliance — fail on any unknown or mistyped prop',
    },
    {
      ['key']: 'UI_CONTRACTS_DIR',
      value: '',
      type: 'STRING',
      category: 'PATHS',
      description: 'Path to UI contracts directory (orqui.lock.json). Defaults to {projectPath}/contracts if empty.',
    },
    {
      ['key']: 'TEST_EXECUTION_TIMEOUT_MS',
      value: '600000',
      type: 'NUMBER',
      category: 'TIMEOUTS',
      description: 'Timeout in ms for running a single test',
    },
    {
      ['key']: 'COMPILATION_TIMEOUT_MS',
      value: '60000',
      type: 'NUMBER',
      category: 'TIMEOUTS',
      description: 'Timeout in ms for TypeScript compilation',
    },
    {
      ['key']: 'BUILD_TIMEOUT_MS',
      value: '120000',
      type: 'NUMBER',
      category: 'TIMEOUTS',
      description: 'Timeout in ms for production build',
    },
    {
      ['key']: 'LINT_TIMEOUT_MS',
      value: '30000',
      type: 'NUMBER',
      category: 'TIMEOUTS',
      description: 'Timeout in ms for linting',
    },
    {
      ['key']: 'JWT_EXPIRY_SECONDS',
      value: '3600',
      type: 'NUMBER',
      category: 'auth',
      description: 'Tempo de expiração do token JWT em segundos (padrão: 3600 = 1 hora)',
    },
  ]

  for (const config of validationConfigs) {
    await prisma.validationConfig.upsert({
      where: { ['key']: config.key },
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
    { key: 'TEST_RESILIENCE_CHECK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'MANIFEST_FILE_LOCK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'NO_IMPLICIT_FILES', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'IMPORT_REALITY_CHECK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TEST_INTENT_ALIGNMENT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TEST_CLAUSE_MAPPING_VALID', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'DIFF_SCOPE_ENFORCEMENT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TEST_READ_ONLY_ENFORCEMENT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'UI_COMPONENT_REGISTRY', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'UI_PROPS_COMPLIANCE', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TASK_TEST_PASSES', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'STRICT_COMPILATION', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'STYLE_CONSISTENCY_LINT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'FULL_REGRESSION_PASS', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'PRODUCTION_BUILD_PASS', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
  ]

  for (const config of validatorConfigs) {
    await prisma.validationConfig.upsert({
      where: { ['key']: config.key },
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
    { code: 'TEST_RESILIENCE_CHECK', displayName: 'Test Resilience Check', description: 'Rejeita padrões frágeis de teste e exige padrões resilientes baseados em comportamento observável', category: 'TESTS_CONTRACTS', gate: 1, order: 6, isHardBlock: true },
    { code: 'MANIFEST_FILE_LOCK', displayName: 'Manifest File Lock', description: 'Verifica integridade do manifesto', category: 'FILE_DISCIPLINE', gate: 1, order: 7, isHardBlock: true },
    { code: 'NO_IMPLICIT_FILES', displayName: 'No Implicit Files', description: 'Bloqueia referências implícitas no prompt', category: 'FILE_DISCIPLINE', gate: 1, order: 8, isHardBlock: true },
    { code: 'IMPORT_REALITY_CHECK', displayName: 'Imports Must Exist', description: 'Verifica se imports do teste existem', category: 'SECURITY', gate: 1, order: 9, isHardBlock: true },
    { code: 'TEST_INTENT_ALIGNMENT', displayName: 'Test Intent Alignment', description: 'Verifica alinhamento entre prompt e teste', category: 'TESTS_CONTRACTS', gate: 1, order: 10, isHardBlock: false },
    { code: 'TEST_CLAUSE_MAPPING_VALID', displayName: 'Test Contract Mapping Valid', description: 'Valida mapeamento entre testes e cláusulas do contrato', category: 'TESTS_CONTRACTS', gate: 1, order: 11, isHardBlock: true },

    // Gate 2 - EXECUTION
    { code: 'DIFF_SCOPE_ENFORCEMENT', displayName: 'Diff Scope Enforcement', description: 'Verifica se diff está contido no manifesto', category: 'TECHNICAL_QUALITY', gate: 2, order: 1, isHardBlock: true },
    { code: 'TEST_READ_ONLY_ENFORCEMENT', displayName: 'Test Read Only Enforcement', description: 'Verifica se arquivos de teste não foram modificados', category: 'TECHNICAL_QUALITY', gate: 2, order: 2, isHardBlock: true },
    { code: 'UI_COMPONENT_REGISTRY', displayName: 'UI Component Registry', description: 'Verifica se componentes JSX usados existem no registry de componentes', category: 'TECHNICAL_QUALITY', gate: 2, order: 3, isHardBlock: true },
    { code: 'UI_PROPS_COMPLIANCE', displayName: 'UI Props Compliance', description: 'Verifica se props de componentes UI estão corretas (enum values, props obrigatórias)', category: 'TECHNICAL_QUALITY', gate: 2, order: 4, isHardBlock: true },
    { code: 'TASK_TEST_PASSES', displayName: 'Task Test Passes', description: 'Verifica se o teste da tarefa passa', category: 'TESTS_CONTRACTS', gate: 2, order: 5, isHardBlock: true },
    { code: 'STRICT_COMPILATION', displayName: 'Strict Compilation', description: 'Verifica compilação sem erros', category: 'TECHNICAL_QUALITY', gate: 2, order: 6, isHardBlock: true },
    { code: 'STYLE_CONSISTENCY_LINT', displayName: 'Style Consistency Lint', description: 'Verifica conformidade com ESLint', category: 'TECHNICAL_QUALITY', gate: 2, order: 7, isHardBlock: true },

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

  // =============================================================================
  // MCP SESSION SEED DATA
  // =============================================================================

  // Default Snippets
  const defaultSnippets = [
    {
      name: 'Claude CLAUDE.md Instructions',
      category: 'INSTRUCTIONS',
      content: '# CLAUDE.md\n\nThis file provides guidance to Claude Code when working with code in this repository.\n\n## Project Overview\n\n[Add project description here]\n\n## Build Commands\n\n```bash\nnpm install\nnpm run dev\nnpm test\n```',
      tags: '["claude", "instructions", "template"]',
    },
    {
      name: 'Task Prompt Template',
      category: 'TEMPLATES',
      content: '## Task\n\n[Describe what needs to be done]\n\n## Context\n\n[Provide relevant background]\n\n## Expected Behavior\n\n[Describe the expected outcome]\n\n## Files to Modify\n\n- `path/to/file.ts` - [reason]',
      tags: '["task", "prompt", "template"]',
    },
    {
      name: 'Bug Report Template',
      category: 'TEMPLATES',
      content: '## Bug Description\n\n[Clear description of the bug]\n\n## Steps to Reproduce\n\n1. [Step 1]\n2. [Step 2]\n\n## Expected Behavior\n\n[What should happen]\n\n## Actual Behavior\n\n[What actually happens]',
      tags: '["bug", "template"]',
    },
  ]

  for (const snippet of defaultSnippets) {
    await prisma.snippet.upsert({
      where: { name: snippet.name },
      create: snippet,
      update: {
        category: snippet.category,
        content: snippet.content,
        tags: snippet.tags,
      },
    })
  }

  console.log(`✓ Seeded ${defaultSnippets.length} default snippets`)

  // Default Session Presets
  const defaultPresets = [
    {
      name: 'Quick Bugfix',
      config: JSON.stringify({
        gitStrategy: 'main',
        taskType: 'bugfix',
        snippetIds: [],
        contextPackIds: [],
      }),
    },
    {
      name: 'Feature Development',
      config: JSON.stringify({
        gitStrategy: 'new_branch',
        taskType: 'feature',
        snippetIds: [],
        contextPackIds: [],
      }),
    },
    {
      name: 'Refactoring',
      config: JSON.stringify({
        gitStrategy: 'new_branch',
        taskType: 'refactor',
        snippetIds: [],
        contextPackIds: [],
      }),
    },
  ]

  for (const preset of defaultPresets) {
    await prisma.sessionPreset.upsert({
      where: { name: preset.name },
      create: preset,
      update: {
        config: preset.config,
      },
    })
  }

  console.log(`✓ Seeded ${defaultPresets.length} default session presets`)

  // Initialize MCPSessionConfig singleton
  await prisma.mCPSessionConfig.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      config: JSON.stringify({
        gitStrategy: 'main',
        taskType: 'feature',
        snippetIds: [],
        contextPackIds: [],
      }),
    },
    update: {},
  })

  console.log('✓ Initialized MCP session config singleton')

  // =============================================================================
  // AGENT RUNNER SEED DATA
  // =============================================================================

  const agentPhaseConfigs = [
    {
      step: 1,  // Planner
      provider: 'claude-code',
      model: 'opus',
      maxTokens: 16384,
      maxIterations: 40,
      maxInputTokensBudget: 500_000,
      temperature: 0.3,
      fallbackProvider: 'openai',
      fallbackModel: 'gpt-4o',
    },
    {
      step: 2,  // Spec Writer
      provider: 'claude-code',
      model: 'opus',
      maxTokens: 16384,
      maxIterations: 35,
      maxInputTokensBudget: 300_000,
      temperature: 0.2,
      fallbackProvider: 'mistral',
      fallbackModel: 'mistral-large-latest',
    },
    {
      step: 3,  // Fixer
      provider: 'claude-code',
      model: 'opus',
      maxTokens: 16384,
      maxIterations: 15,
      maxInputTokensBudget: 200_000,
      temperature: 0.2,
      fallbackProvider: 'openai',
      fallbackModel: 'gpt-4o',
    },
    {
      step: 4,  // Coder - needs higher maxTokens for large file outputs
      provider: 'claude-code',
      model: 'opus',
      maxTokens: 32768,
      maxIterations: 60,
      maxInputTokensBudget: 800_000,
      temperature: 0.1,
      fallbackProvider: 'openai',
      fallbackModel: 'gpt-4o',
    },
  ]

  for (const config of agentPhaseConfigs) {
    await prisma.agentPhaseConfig.upsert({
      where: { step: config.step },
      create: config,
      update: {
        provider: config.provider,
        model: config.model,
        maxTokens: config.maxTokens,
        maxIterations: config.maxIterations,
        maxInputTokensBudget: config.maxInputTokensBudget,
        temperature: config.temperature,
        fallbackProvider: config.fallbackProvider,
        fallbackModel: config.fallbackModel,
      },
    })
  }

  console.log(`✓ Seeded ${agentPhaseConfigs.length} agent phase configs`)

  // =============================================================================
  // PROVIDER MODEL REGISTRY
  // =============================================================================

  const providerModels = [
    // Anthropic
    { provider: 'anthropic', modelId: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
    { provider: 'anthropic', modelId: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { provider: 'anthropic', modelId: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
    { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    // OpenAI
    { provider: 'openai', modelId: 'gpt-4.1', label: 'GPT-4.1' },
    { provider: 'openai', modelId: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { provider: 'openai', modelId: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
    { provider: 'openai', modelId: 'o3-mini', label: 'o3-mini' },
    { provider: 'openai', modelId: 'gpt-4o', label: 'GPT-4o' },
    { provider: 'openai', modelId: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { provider: 'openai', modelId: 'gpt-4', label: 'GPT-4' },
    // Mistral
    { provider: 'mistral', modelId: 'mistral-large-latest', label: 'Mistral Large' },
    { provider: 'mistral', modelId: 'mistral-medium-latest', label: 'Mistral Medium' },
    { provider: 'mistral', modelId: 'codestral-latest', label: 'Codestral' },
    // Claude Code (CLI)
    { provider: 'claude-code', modelId: 'sonnet', label: 'Sonnet' },
    { provider: 'claude-code', modelId: 'opus', label: 'Opus' },
    { provider: 'claude-code', modelId: 'haiku', label: 'Haiku' },
    // Codex CLI (OpenAI)
    { provider: 'codex-cli', modelId: 'o3-mini', label: 'o3-mini' },
    { provider: 'codex-cli', modelId: 'o4-mini', label: 'o4-mini' },
    { provider: 'codex-cli', modelId: 'gpt-4.1', label: 'GPT-4.1' },
  ]

  for (const model of providerModels) {
    await prisma.providerModel.upsert({
      where: { provider_modelId: { provider: model.provider, modelId: model.modelId } },
      create: model,
      update: { label: model.label },
    })
  }

  console.log(`✓ Seeded ${providerModels.length} provider models`)

  // =============================================================================
  // PIPELINE PROMPT CONTENT (PromptInstruction with step + kind)
  // =============================================================================
  // These are the full system prompt building blocks for each pipeline phase.
  // Managed via CRUD at /api/agent/content/*

  const pipelinePrompts = [
    // ── Step 1: Planner ──────────────────────────────────────────────────────
    {
      name: 'planner-core',
      step: 1,
      kind: 'instruction',
      order: 1,
      content: `You are a TDD Planner. Your job is to analyze a codebase and produce a structured plan for implementing a task using Test-Driven Development.

## Available Tools

You have read-only access to the project via tools:
- **read_file**: Read any file in the project
- **list_directory**: List directory contents (with optional recursion)
- **search_code**: Search for patterns across the codebase

Use these tools extensively to understand the project structure, existing patterns, conventions, and dependencies BEFORE creating your plan.

## Your Workflow

1. First, explore the project structure (list_directory at root)
2. Read key files: package.json, tsconfig.json, existing tests, main source files
3. Search for patterns related to the task
4. Produce your plan artifacts

## Required Outputs

Use the **save_artifact** tool to save exactly these 3 artifacts:

1. **plan.json** — Structured execution plan:
   \`\`\`json
   {
     "task": "description",
     "approach": "strategy",
     "files_to_create": ["path/to/file.ts"],
     "files_to_modify": ["path/to/existing.ts"],
     "test_files": ["path/to/file.spec.ts"],
     "dependencies": [],
     "steps": [
       { "order": 1, "action": "description", "files": ["..."] }
     ]
   }
   \`\`\`

2. **contract.md** — Behavioral contract defining what the implementation must satisfy

3. **task.spec.md** — Natural language test specification describing test cases

## Rules

- Always explore the codebase before planning
- Match existing project conventions (test framework, file naming, etc.)
- Be specific about file paths (use actual paths you found via tools)
- Respond in the same language as the task description`,
    },

    // ── Step 2: Spec Writer ──────────────────────────────────────────────────
    {
      name: 'specwriter-core',
      step: 2,
      kind: 'instruction',
      order: 1,
      content: `You are a TDD Spec Writer. Your job is to take the plan artifacts from the Planner phase and produce a complete, runnable test file.

## Available Tools

You have read-only access to the project:
- **read_file**: Read source files, existing tests, config files
- **list_directory**: Explore the project structure
- **search_code**: Find patterns, imports, existing test utilities

## Your Workflow

1. Read the plan.json, contract.md, and task.spec.md artifacts (provided in the message)
2. Explore the project to understand testing conventions:
   - Which test framework? (vitest, jest, mocha)
   - How are existing tests structured?
   - What test utilities/helpers exist?
   - What's the import style? (relative, aliases, etc.)
3. Write the complete test file

## Required Output

Use **save_artifact** to save the test file. The filename should match the plan's test_files entry (e.g. "MyComponent.spec.ts").

## Rules

- Tests MUST fail before implementation (TDD red phase)
- Tests must be syntactically valid and runnable
- Use the project's existing test framework and conventions
- Include both happy path and error/edge cases
- Each test should be independent
- Use descriptive test names that document behavior
- Respond in the same language as the task description`,
    },

    // ── Step 3: Fixer (correction after Gatekeeper rejection) ────────────────
    {
      name: 'fixer-core',
      step: 3,
      kind: 'instruction',
      order: 1,
      content: `You are a TDD Fixer. Your job is to correct artifacts that were rejected by the Gatekeeper validation system.

## Context

You will receive:
- The original plan, spec, and implementation artifacts
- A rejection report from Gatekeeper listing which validators failed and why

## Available Tools

You have read-only access to the project:
- **read_file**: Read source files, tests, configs
- **list_directory**: Explore the project structure
- **search_code**: Find patterns and code references

## Your Workflow

1. Read the rejection report carefully — understand EACH failure
2. Read the affected artifacts and source files
3. Determine which artifacts need correction
4. Save corrected artifacts using **save_artifact**

## Rules

- Focus ONLY on the failures listed in the rejection report
- Do NOT change things that are passing
- Preserve existing test coverage
- Corrected artifacts must address ALL reported failures
- If a fix requires changing the plan, update plan.json too
- Respond in the same language as the task description`,
    },

    // ── Step 4: Coder ────────────────────────────────────────────────────────
    {
      name: 'coder-core',
      step: 4,
      kind: 'instruction',
      order: 1,
      content: `You are a TDD Coder. Your job is to implement code that makes all tests pass.

## Available Tools

You have full access to the project:
- **read_file**: Read any file
- **list_directory**: List directories
- **search_code**: Search for patterns
- **edit_file**: Edit a file by replacing a specific string (surgical edits)
- **write_file**: Create new files or rewrite entire files
- **bash**: Run allowed commands (npm test, npx tsc, git status)

## Your Workflow

1. Read the test file and all plan artifacts
2. Understand what needs to be implemented
3. Read related existing source files for context and patterns
4. Implement the code using edit_file (for modifications) or write_file (for new files)
5. Run the tests using bash ("npm test" or similar)
6. If tests fail, read the error output, fix the code, and re-run
7. Repeat until all tests pass
8. Run "npx tsc --noEmit" to verify no type errors

## Rules

- Only modify/create files listed in the plan
- Match existing code style and conventions
- Keep implementations minimal — just enough to pass tests
- Do NOT modify the test file
- Run tests after each significant change
- If stuck after 3 attempts on the same error, explain what's blocking you
- Respond in the same language as the task description`,
    },
  ]

  for (const prompt of pipelinePrompts) {
    await prisma.promptInstruction.upsert({
      where: { name: prompt.name },
      create: prompt,
      update: {
        content: prompt.content,
        step: prompt.step,
        kind: prompt.kind,
        order: prompt.order,
      },
    })
  }

  console.log(`✓ Seeded ${pipelinePrompts.length} pipeline prompt entries`)

  // =============================================================================
  // USER MESSAGE TEMPLATES (PromptInstruction with role='user')
  // =============================================================================
  // These are Handlebars templates for building user messages in each pipeline step.
  // Placeholders are replaced at runtime with actual values.

  const userMessageTemplates = [
    // ── Step 1: Plan User Message ──────────────────────────────────────────────
    {
      name: 'plan-user-message',
      step: 1,
      kind: 'instruction',
      role: 'user',
      order: 1,
      content: `## Task
**Description:** {{taskDescription}}
{{#if taskType}}
**Type:** {{taskType}}
{{/if}}
**Output ID:** {{outputId}}

Analyze the codebase and produce the plan artifacts: plan.json, contract.md, task.spec.md.
Use the save_artifact tool for each one.

{{#if attachments}}
## Attachments
{{{attachments}}}
{{/if}}`,
    },

    // ── Step 2: Spec User Message ──────────────────────────────────────────────
    {
      name: 'spec-user-message',
      step: 2,
      kind: 'instruction',
      role: 'user',
      order: 1,
      content: `## ⚠️ CRITICAL: You MUST call save_artifact
After generating the test file, you MUST call the \`save_artifact\` tool to save it.
Do NOT output the test code as text in your response — that will be LOST.
Expected call: \`save_artifact("{{testFileName}}", <complete test file content>)\`

## Output ID: {{outputId}}

## Artifacts from Step 1
{{{artifactBlocks}}}

## Instructions
1. Explore the project to understand testing conventions, imports, and patterns.
2. Generate the complete test file: **{{testFileName}}**
3. Use the save_artifact tool to save the test file.

## REMINDER: call save_artifact("{{testFileName}}", content) — do NOT just output text.`,
    },

    // ── Step 3: Fix User Message (API mode) ────────────────────────────────────
    {
      name: 'fix-user-message',
      step: 3,
      kind: 'instruction',
      role: 'user',
      order: 1,
      content: `## ⚠️ CRITICAL: You MUST call save_artifact
Your ONLY job is to fix the artifacts and save them. You are NOT done until you call \`save_artifact\`.
- Do NOT just explain what needs to change — that accomplishes NOTHING.
- Do NOT end your turn without calling \`save_artifact\`.
- You MUST read the artifact, apply fixes, then call: \`save_artifact(filename, corrected_content)\`
- If you do not call \`save_artifact\`, your work is LOST and you have FAILED the task.

## Target: {{target}}
## Output ID: {{outputId}}

## Failed Validators
{{#each failedValidators}}
- \`{{this}}\`
{{/each}}

{{#if rejectionReport}}
## Rejection Report
{{{rejectionReport}}}
{{/if}}

{{#if taskPrompt}}
## Original Task Prompt
{{{taskPrompt}}}
{{/if}}

## Current Artifacts
{{{artifactBlocks}}}

## CRITICAL: You MUST use save_artifact
Do NOT just explain what needs to change. Call \`save_artifact(filename, corrected_content)\` for each file.`,
    },

    // ── Step 3: Fix User Message (CLI mode - Claude Code) ──────────────────────
    {
      name: 'fix-user-message-cli',
      step: 3,
      kind: 'cli',
      role: 'user',
      order: 1,
      content: `## ⚠️ CRITICAL: You MUST write the corrected files
Your ONLY job is to fix the artifacts and write them to disk. You are NOT done until you use your Write tool.
- Do NOT just explain what needs to change — that accomplishes NOTHING.
- Do NOT end your turn without writing the corrected files.
- You MUST: 1) Read the artifact, 2) Apply fixes, 3) Write the corrected file to: {{outputDir}}/
- If you do not write the file, your work is LOST and you have FAILED the task.

## Target: {{target}}
## Output ID: {{outputId}}

## Failed Validators
{{#each failedValidators}}
- \`{{this}}\`
{{/each}}

{{#if rejectionReport}}
## Rejection Report
{{{rejectionReport}}}
{{/if}}

{{#if taskPrompt}}
## Original Task
{{{taskPrompt}}}
{{/if}}

## Artifact Files
The artifacts are on disk. Use your Read tool to read them:
{{#each artifactFiles}}
- {{this.path}} ({{this.chars}} chars)
{{/each}}

## Instructions
{{#if isSpec}}
1. Read the test file(s): {{specFiles}}
2. Fix the issues described in the rejection report above
3. Write the corrected file(s) back to: {{outputDir}}/
   Use the EXACT same filename(s).
{{else}}
1. Read plan.json from: {{outputDir}}/plan.json
2. Fix the issues described in the rejection report above
3. Write the corrected plan.json back to: {{outputDir}}/plan.json
{{/if}}

## ⚠️ REMINDER: You MUST write the files
Do NOT just explain what needs to change. Use your Write tool to save the corrected file(s) to {{outputDir}}/.
If you do not write the files, your fixes will be LOST and the pipeline will FAIL.`,
    },

    // ── Step 4: Execute User Message ───────────────────────────────────────────
    {
      name: 'execute-user-message',
      step: 4,
      kind: 'instruction',
      role: 'user',
      order: 1,
      content: `## Output ID: {{outputId}}

## Approved Artifacts
{{{artifactBlocks}}}

## Instructions
Implement the code to make all tests pass.
Use edit_file for surgical modifications, write_file for new files, and bash to run tests.`,
    },
  ]

  for (const template of userMessageTemplates) {
    await prisma.promptInstruction.upsert({
      where: { name: template.name },
      create: template,
      update: {
        content: template.content,
        step: template.step,
        kind: template.kind,
        role: template.role,
        order: template.order,
      },
    })
  }

  console.log(`✓ Seeded ${userMessageTemplates.length} user message templates`)

  // =============================================================================
  // DYNAMIC INSTRUCTIONS TEMPLATES
  // =============================================================================
  // These templates replace hardcoded instructions throughout the codebase.
  // All can be customized via the Config UI.

  const dynamicInstructionTemplates = [
    // ── Retry Templates ───────────────────────────────────────────────────────
    {
      name: 'retry-api-critical-failure',
      step: 3,
      kind: 'retry',
      role: 'user',
      order: 1,
      content: `## ⚠️ CRITICAL FAILURE: You did NOT call save_artifact!
Your previous response explained the fixes but you NEVER called the tool.
All your work is LOST. You MUST call save_artifact NOW.

**DO NOT EXPLAIN AGAIN.** Just call: save_artifact("{{targetFilename}}", <corrected content>)`,
    },
    {
      name: 'retry-cli-critical-failure',
      step: 3,
      kind: 'retry-cli',
      role: 'user',
      order: 1,
      content: `## ⚠️ CRITICAL FAILURE: You did NOT write any files!
Your previous response explained the fixes but you NEVER used your Write tool.
All your work is LOST. You MUST write the file NOW.

**DO NOT EXPLAIN AGAIN.** Just write the corrected file to: {{outputDir}}/{{targetFilename}}`,
    },
    {
      name: 'retry-previous-response-reference',
      step: 3,
      kind: 'retry',
      role: 'user',
      order: 2,
      content: `## Your Previous Response (for reference)
You already analyzed the issues and described the fixes:

\`\`\`
{{{previousResponse}}}
\`\`\`

Now APPLY those fixes and save the file.`,
    },
    {
      name: 'retry-original-artifact',
      step: 3,
      kind: 'retry',
      role: 'user',
      order: 3,
      content: `## Original Artifact to Fix
{{{originalArtifact}}}`,
    },
    {
      name: 'retry-rejection-reminder',
      step: 3,
      kind: 'retry',
      role: 'user',
      order: 4,
      content: `## Rejection Report (reminder)
{{{rejectionReport}}}`,
    },
    {
      name: 'retry-api-final-instruction',
      step: 3,
      kind: 'retry',
      role: 'user',
      order: 10,
      content: `## YOUR ONLY TASK NOW
Call save_artifact("{{targetFilename}}", <fully corrected content>)
Do NOT explain. Do NOT analyze. Just CALL THE TOOL.`,
    },
    {
      name: 'retry-cli-final-instruction',
      step: 3,
      kind: 'retry-cli',
      role: 'user',
      order: 10,
      content: `## YOUR ONLY TASK NOW
Use your Write tool to save the corrected {{targetFilename}} to {{outputDir}}/
Do NOT explain. Do NOT analyze. Just WRITE THE FILE.`,
    },

    // ── System Prompt Appends (CLI) ───────────────────────────────────────────
    {
      name: 'cli-append-plan',
      step: 1,
      kind: 'system-append-cli',
      role: 'system',
      order: 1,
      content: `IMPORTANT: You must write each artifact as a file using your Write tool.
Write artifacts to this directory: {{outputDir}}/
Required files: plan.json, contract.md, task.spec.md`,
    },
    {
      name: 'cli-append-spec',
      step: 2,
      kind: 'system-append-cli',
      role: 'system',
      order: 1,
      content: `IMPORTANT: Write test file(s) using your Write tool to: {{outputDir}}/`,
    },
    {
      name: 'cli-append-fix',
      step: 3,
      kind: 'system-append-cli',
      role: 'system',
      order: 1,
      content: `IMPORTANT: You must write each corrected artifact as a file using your Write tool.
Write corrected files to this directory: {{outputDir}}/
Use the EXACT same filename as the original artifact.`,
    },
    {
      name: 'cli-append-execute',
      step: 4,
      kind: 'system-append-cli',
      role: 'system',
      order: 1,
      content: `IMPORTANT: Implement the code changes using your Write and Edit tools. Run tests using Bash.`,
    },

    // ── Git Strategy Templates ────────────────────────────────────────────────
    {
      name: 'git-strategy-new-branch',
      step: null,
      kind: 'git-strategy',
      role: 'system',
      order: 1,
      content: `## Git Strategy
Crie uma nova branch antes de implementar: {{branch}}`,
    },
    {
      name: 'git-strategy-existing-branch',
      step: null,
      kind: 'git-strategy',
      role: 'system',
      order: 2,
      content: `## Git Strategy
Use a branch existente: {{branch}}`,
    },
    {
      name: 'git-strategy-main',
      step: null,
      kind: 'git-strategy',
      role: 'system',
      order: 3,
      content: `## Git Strategy
Commit direto na branch atual.`,
    },

    // ── Custom Instructions Header ────────────────────────────────────────────
    {
      name: 'custom-instructions-header',
      step: null,
      kind: 'custom-instructions',
      role: 'system',
      order: 1,
      content: `## Instruções Adicionais`,
    },

    // ── Validator Fix Guidance Templates ──────────────────────────────────────
    {
      name: 'guidance-implicit-files',
      step: 3,
      kind: 'guidance',
      role: 'user',
      order: 1,
      content: `## Original Task Prompt
The validators NO_IMPLICIT_FILES and TASK_CLARITY_CHECK analyze the **task prompt text below**, NOT the plan artifacts. To fix these failures you MUST also save a corrected version of the task prompt as an artifact named \`corrected-task-prompt.txt\`.

\`\`\`
{{{taskPrompt}}}
\`\`\`

Remove any implicit/vague references (e.g. "etc", "...", "outros arquivos", "e tal", "among others", "all files", "any file", "related files", "necessary files", "e outros") and replace them with explicit, specific file or component names.`,
    },
    {
      name: 'guidance-manifest-fix',
      step: 3,
      kind: 'guidance',
      role: 'user',
      order: 2,
      content: `## Manifest Fix Guidance
These validators check \`manifest.files\` and \`manifest.testFile\` inside **plan.json**. To fix, update the manifest section in plan.json and save it via save_artifact.

- **TASK_SCOPE_SIZE**: Reduce the number of files in \`manifest.files\` in plan.json (split into smaller tasks if needed)
- **DELETE_DEPENDENCY_CHECK**: Files marked DELETE have importers not listed in manifest. Add those importers as MODIFY in \`manifest.files\`
- **PATH_CONVENTION**: The \`manifest.testFile\` path does not follow project conventions. Update the testFile path in plan.json
- **SENSITIVE_FILES_LOCK**: Manifest includes sensitive files (.env, prisma/schema, etc.) but dangerMode is off. Remove sensitive files from manifest or flag the task as dangerMode`,
    },
    {
      name: 'guidance-contract-clause-mapping',
      step: 3,
      kind: 'guidance',
      role: 'user',
      order: 3,
      content: `## Contract Fix Guidance
**TEST_CLAUSE_MAPPING_VALID** checks that every test has a valid \`// @clause CL-XXX\` comment matching a clause ID defined in the \`contract\` field of plan.json. To fix:
1. If clause IDs in tests don't match contract: update either the test file or the contract clauses in plan.json
2. If tests are missing \`// @clause\` tags: add them to the spec test file
3. Save both corrected plan.json (with updated contract.clauses) and the test file as needed`,
    },
    {
      name: 'guidance-test-resilience',
      step: 3,
      kind: 'guidance',
      role: 'user',
      order: 4,
      content: `## Test Resilience Fix Guidance
**TEST_RESILIENCE_CHECK**: The test file contains **fragile patterns** that depend on implementation details. You MUST replace ALL of these patterns in the spec file:

| Fragile Pattern | Replacement |
|----------------|-------------|
| \`.innerHTML\` | \`toHaveTextContent()\` or \`screen.getByText()\` |
| \`.outerHTML\` | \`toHaveTextContent()\` or specific accessible assertions |
| \`container.firstChild\` | \`screen.getByRole()\` or \`screen.getByTestId()\` |
| \`container.children\` | \`screen.getAllByRole()\` or \`within()\` for scoped queries |
| \`.querySelector()\` / \`.querySelectorAll()\` | \`screen.getByRole()\` / \`screen.getAllByRole()\` |
| \`.getElementsByClassName()\` / \`.getElementsByTagName()\` / \`.getElementById()\` | \`screen.getByRole()\` / \`screen.getByTestId()\` |
| \`.className\` | \`toHaveClass()\` or accessible assertions |
| \`.style.\` | \`toHaveStyle()\` or CSS-in-JS utilities |
| \`wrapper.find()\` / \`.dive()\` | Migrate to React Testing Library queries |
| \`toMatchSnapshot()\` / \`toMatchInlineSnapshot()\` | Explicit assertions like \`toHaveTextContent()\`, \`toBeVisible()\` |

Use ONLY resilient patterns: \`screen.getByRole()\`, \`screen.getByText()\`, \`screen.getByTestId()\`, \`userEvent.*\`, \`toBeVisible()\`, \`toBeInTheDocument()\`, \`toHaveTextContent()\`, \`toHaveAttribute()\`.`,
    },
    {
      name: 'guidance-test-quality',
      step: 3,
      kind: 'guidance',
      role: 'user',
      order: 5,
      content: `## Test Quality Fix Guidance
These validators check the **test spec file** content. You MUST:
1. Read the current spec file from the artifacts
2. Apply ALL the fixes below
3. Save the corrected spec file using \`save_artifact\` with the EXACT same filename

- **NO_DECORATIVE_TESTS**: Remove tests that only check rendering without meaningful assertions (e.g. \`expect(component).toBeDefined()\`). Every test must assert observable behavior.
- **TEST_HAS_ASSERTIONS**: Some test blocks are missing \`expect()\` calls. Add meaningful assertions to every \`it()\` / \`test()\` block.
- **TEST_COVERS_HAPPY_AND_SAD_PATH**: The test file must cover both success (happy path) and failure/error (sad path) scenarios.
- **TEST_INTENT_ALIGNMENT**: Test descriptions (\`it("should...")\`) must match what the test actually asserts. Align names with assertions.
- **TEST_SYNTAX_VALID**: The test file has syntax errors. Fix TypeScript/JavaScript syntax issues.
- **IMPORT_REALITY_CHECK**: The test file imports modules that don't exist. Fix import paths to reference real files.
- **MANIFEST_FILE_LOCK**: The test file modifies files not listed in the manifest. Only touch files declared in plan.json manifest.`,
    },
    {
      name: 'guidance-contract-schema',
      step: 3,
      kind: 'guidance',
      role: 'user',
      order: 6,
      content: `## Contract Schema Fix Guidance
**CONTRACT_SCHEMA_INVALID**: The \`contract\` object inside plan.json has fields with wrong types. The Zod schema enforces strict types. Common mistakes:

- \`assertionSurface.effects\` must be an **array of strings**, e.g. \`["effect1", "effect2"]\` — NOT an object like \`{ "key": "value" }\`
- \`assertionSurface.http.methods\` must be an **array**, e.g. \`["GET", "POST"]\`
- \`assertionSurface.http.successStatuses\` must be an **array of integers**, e.g. \`[200, 201]\`
- \`assertionSurface.ui.routes\` must be an **array of strings**
- All array fields must be actual JSON arrays \`[]\`, never objects \`{}\` or strings

**You MUST:**
1. Read the current plan.json from the artifacts above
2. Find and fix every field that has the wrong type
3. Save the corrected plan.json using \`save_artifact\` with filename \`plan.json\`

The rejection report above tells you exactly which fields failed.`,
    },
    {
      name: 'guidance-danger-mode',
      step: 3,
      kind: 'guidance',
      role: 'user',
      order: 7,
      content: `## DangerMode Note
**DANGER_MODE_EXPLICIT** failed because dangerMode is enabled but manifest has no sensitive files, or sensitive files are present without dangerMode. This setting is controlled by the user in the UI. You can fix the plan.json by setting \`"dangerMode": true\` if sensitive files are needed, or remove sensitive files from the manifest if dangerMode should stay off.`,
    },

    // ── Message Replacements (CLI mode) ───────────────────────────────────────
    {
      name: 'cli-replace-save-artifact-plan',
      step: 1,
      kind: 'cli-replace',
      role: 'user',
      order: 1,
      content: `Write each artifact file to: {{outputDir}}/`,
    },
    {
      name: 'cli-replace-critical-spec',
      step: 2,
      kind: 'cli-replace',
      role: 'user',
      order: 1,
      content: `## ⚠️ CRITICAL: You MUST write the test file
Use your Write tool to save the test file to: {{outputDir}}/`,
    },
    {
      name: 'cli-replace-reminder-spec',
      step: 2,
      kind: 'cli-replace',
      role: 'user',
      order: 2,
      content: `## REMINDER: Write the test file to {{outputDir}}/ — do NOT just output text.`,
    },
    {
      name: 'cli-replace-execute-tools',
      step: 4,
      kind: 'cli-replace',
      role: 'user',
      order: 1,
      content: `Use your Write/Edit tools to create/modify files and Bash to run tests.`,
    },
  ]

  for (const template of dynamicInstructionTemplates) {
    await prisma.promptInstruction.upsert({
      where: { name: template.name },
      create: template,
      update: {
        content: template.content,
        step: template.step,
        kind: template.kind,
        role: template.role,
        order: template.order,
      },
    })
  }

  console.log(`✓ Seeded ${dynamicInstructionTemplates.length} dynamic instruction templates`)

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
