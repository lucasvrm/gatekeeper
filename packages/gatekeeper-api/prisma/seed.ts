import { PrismaClient } from '@prisma/client'
import { AgentPhaseConfigService } from '../src/services/AgentPhaseConfigService.js'

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
      value: '20',
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
      value: '57600',
      type: 'NUMBER',
      category: 'auth',
      description: 'Tempo de expiração do token JWT em segundos (padrão: 57600 = 16 horas)',
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
    { key: 'TOKEN_BUDGET_FIT', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: 'HARD' },
    { key: 'TASK_SCOPE_SIZE', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'TASK_CLARITY_CHECK', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: 'HARD' },
    { key: 'SENSITIVE_FILES_LOCK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'DANGER_MODE_EXPLICIT', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: 'HARD' },
    { key: 'PATH_CONVENTION', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: 'HARD' },
    { key: 'DELETE_DEPENDENCY_CHECK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'TEST_SYNTAX_VALID', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'TEST_HAS_ASSERTIONS', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'TEST_COVERS_HAPPY_AND_SAD_PATH', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'TEST_FAILS_BEFORE_IMPLEMENTATION', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'NO_DECORATIVE_TESTS', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'TEST_RESILIENCE_CHECK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'MANIFEST_FILE_LOCK', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: 'HARD' },
    { key: 'NO_IMPLICIT_FILES', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: 'HARD' },
    { key: 'IMPORT_REALITY_CHECK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'TEST_INTENT_ALIGNMENT', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: 'HARD' },
    { key: 'TEST_CLAUSE_MAPPING_VALID', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'DIFF_SCOPE_ENFORCEMENT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'TEST_READ_ONLY_ENFORCEMENT', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: 'HARD' },
    { key: 'UI_COMPONENT_REGISTRY', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: 'HARD' },
    { key: 'UI_PROPS_COMPLIANCE', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: 'HARD' },
    { key: 'TASK_TEST_PASSES', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'STRICT_COMPILATION', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'STYLE_CONSISTENCY_LINT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'FULL_REGRESSION_PASS', value: 'false', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
    { key: 'PRODUCTION_BUILD_PASS', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR', failMode: null },
  ]

  for (const config of validatorConfigs) {
    await prisma.validationConfig.upsert({
      where: { ['key']: config.key },
      create: config,
      update: {
        // Only update metadata, preserve user's value setting
        type: config.type,
        category: config.category,
        failMode: config.failMode,
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

  // IMPORTANTE: seed.ts é a fonte única da verdade para AgentPhaseConfig.
  // Garantir que não há duplicatas antes de upserts (embora step seja @id,
  // esta verificação documenta a invariante).
  const service = new AgentPhaseConfigService(prisma)
  await service.removeDuplicates()

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
  // PROVIDER REGISTRY
  // =============================================================================

  const providers = [
    { name: 'anthropic',   label: 'Anthropic (API Key)', authType: 'api_key', envVarName: 'ANTHROPIC_API_KEY',   order: 1, note: null },
    { name: 'openai',      label: 'OpenAI (API Key)',    authType: 'api_key', envVarName: 'OPENAI_API_KEY',      order: 2, note: null },
    { name: 'mistral',     label: 'Mistral (API Key)',   authType: 'api_key', envVarName: 'MISTRAL_API_KEY',     order: 3, note: null },
    { name: 'claude-code', label: 'Claude Code CLI',     authType: 'cli',     envVarName: 'CLAUDE_CODE_ENABLED', order: 4, note: 'Uses Claude Code CLI (Max/Pro subscription). No API key required.' },
    { name: 'codex-cli',   label: 'Codex CLI',           authType: 'cli',     envVarName: 'CODEX_CLI_ENABLED',   order: 5, note: 'Uses OpenAI Codex CLI. Requires OPENAI_API_KEY and npm i -g @openai/codex.' },
  ]

  for (const p of providers) {
    await prisma.provider.upsert({
      where: { name: p.name },
      create: p,
      update: { label: p.label, authType: p.authType, envVarName: p.envVarName, order: p.order, note: p.note },
    })
  }

  console.log(`✓ Seeded ${providers.length} providers`)

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
//
// ⚠️ FONTE DA VERDADE: Sincronizado com banco em 2026-02-07T11:38:07.663Z
// Total: 41 prompts

  const pipelinePrompts = [
    {
        "name": "planner-examples",
        "step": 1,
        "kind": "doc",
        "order": 2,
        "content": "## Exemplos de microplans.json\n\n### Exemplo 1: Task trivial (1 microplan)\n```json\n{\n  \"task\": \"Adicionar constante HTTP_REQUEST_TIMEOUT de 25s no api.ts\",\n  \"microplans\": [\n    {\n      \"id\": \"MP-1\",\n      \"goal\": \"Criar teste e implementar constante de timeout\",\n      \"depends_on\": [],\n      \"files\": [\n        { \"path\": \"test/unit/api-timeout.spec.ts\", \"action\": \"CREATE\", \"what\": \"Testar que HTTP_REQUEST_TIMEOUT existe, é number, e vale 25000\" },\n        { \"path\": \"src/lib/api.ts\", \"action\": \"EDIT\", \"what\": \"Adicionar export const HTTP_REQUEST_TIMEOUT = 25000 após as constantes de base URL\" }\n      ],\n      \"verify\": \"npm run test -- api-timeout\"\n    }\n  ]\n}\n```\n\n### Exemplo 2: Task com dependências e paralelismo (3 microplans)\n```json\n{\n  \"task\": \"Corrigir drawer de logs: cards sobrepostos e filtros ocupando espaço vertical excessivo\",\n  \"microplans\": [\n    {\n      \"id\": \"MP-1\",\n      \"goal\": \"Criar testes para altura dos cards e layout dos filtros\",\n      \"depends_on\": [],\n      \"files\": [\n        { \"path\": \"src/components/__tests__/log-list.spec.tsx\", \"action\": \"CREATE\", \"what\": \"Testar que ITEM_HEIGHT é >= 40 e cada card renderiza sem overflow sobre o próximo\" },\n        { \"path\": \"src/components/__tests__/log-viewer.spec.tsx\", \"action\": \"CREATE\", \"what\": \"Testar que filtros renderizam em grid 2x2, busca ocupa full-width, área de logs tem overflow-hidden\" }\n      ],\n      \"verify\": \"npm test -- log-list log-viewer\"\n    },\n    {\n      \"id\": \"MP-2\",\n      \"goal\": \"Corrigir sobreposição dos cards ajustando ITEM_HEIGHT\",\n      \"depends_on\": [\"MP-1\"],\n      \"files\": [\n        { \"path\": \"src/components/orchestrator/log-list.tsx\", \"action\": \"EDIT\", \"what\": \"Mudar ITEM_HEIGHT de 24 para 48 para acomodar 2 linhas por card\" }\n      ],\n      \"verify\": \"npm test -- log-list\"\n    },\n    {\n      \"id\": \"MP-3\",\n      \"goal\": \"Reorganizar filtros de vertical para grid 2x2\",\n      \"depends_on\": [\"MP-1\"],\n      \"files\": [\n        { \"path\": \"src/components/orchestrator/log-viewer.tsx\", \"action\": \"EDIT\", \"what\": \"Mudar container dos filtros de flex-col para grid grid-cols-2 gap-2, input de busca em col-span-2\" }\n      ],\n      \"verify\": \"npm test -- log-viewer\"\n    }\n  ]\n}\n```\n\n### Padrões a observar\n\n- MP-1 é sempre teste (TDD: teste primeiro)\n- MP-2 e MP-3 são paralelos (mesma dependência, arquivos diferentes)\n- Campo \"what\" é semântico (O QUE mudar), sem código ou números de linha\n- Cada microplan tem verify executável\n- Paths relativos ao root do projeto"
      },
    {
        "name": "planner-mandatory",
        "step": 1,
        "kind": "instruction",
        "order": 0,
        "content": "<mandatory>\n- microplans[].id: formato \"MP-N\" sequencial (MP-1, MP-2, MP-3...)\n- microplans[].files[].action: apenas EDIT | CREATE | DELETE (maiúsculas)\n- microplans[].files[].path: relativo ao root, deve existir se action é EDIT ou DELETE\n- microplans[].verify: deve ser um comando executável (npm test, npm run typecheck, etc)\n- depends_on: array de IDs que existem no mesmo documento. Sem ciclos.\n- Sem extensão .js em paths TypeScript\n- Se tarefa afeta package.json, .env*, prisma/schema.prisma → incluir \"danger\": true no microplan\n- O campo task NÃO pode conter: \"etc\", \"e outros\", \"arquivos relacionados\", \"and so on\" — listar explicitamente\n- Saída obrigatória: save_artifact(\"microplans.json\", <conteúdo JSON>)\n- NÃO gerar plan.json, contract.md, ou task_spec.md — formato descontinuado\n</mandatory>"
      },
    {
        "name": "planner-core",
        "step": 1,
        "kind": "instruction",
        "order": 1,
        "content": "# System Prompt: PLANNER (Opus)\n\n```xml\n<role>\nVocê é um arquiteto de código. Sua função é decompor a tarefa em microplans.\n</role>\n\n<microplan_structure>\n- Objetivo claro em 1 frase\n- Max 3 arquivos tocados, max 4 tarefas\n- Arquivos com path exato e o que fazer em cada um\n- Critério de verificação\n</microplan_structure>\n\n<rules>\n- O primeiro microplan DEVE criar ou atualizar o teste. Os demais implementam. TDD: teste primeiro, código depois.\n- Microplans paralelos NÃO PODEM tocar os mesmos arquivos\n- Cada microplan deve ser autocontido: o executor não tem contexto dos outros\n- NÃO gere código. Descreva O QUE fazer, não COMO.\n- Se a tarefa é trivial, gere 1 microplan.\n- O campo \"what\" deve ser uma instrução de mudança CONCRETA, não uma hipótese.\n- PROIBIDO no campo \"what\": \"investigar\", \"verificar se\", \"provavelmente\", \"se houver\".\n- Se você não tem certeza do que mudar, leia o arquivo antes de gerar o microplan.\n</rules>\n\n<output_format>\n```json\n{\n  \"task\": \"descrição\",\n  \"microplans\": [\n    {\n      \"id\": \"MP-1\",\n      \"goal\": \"objetivo\",\n      \"depends_on\": [],\n      \"files\": [\n        { \"path\": \"src/file.ts\", \"action\": \"EDIT|CREATE|DELETE\", \"what\": \"mudança concreta\" }\n      ],\n      \"verify\": \"como verificar\"\n    }\n  ]\n}\n```\n</output_format>\n```"
      },
    {
        "name": "planner-system",
        "step": 1,
        "kind": "instruction",
        "order": 1,
        "content": "<role>\nVocê é um arquiteto de código. Sua função é decompor a tarefa em microplans.\n</role>\n\n<microplan_structure>\n- Objetivo claro em 1 frase\n- Max 3 arquivos tocados, max 4 tarefas\n- Arquivos com path relativo ao root do projeto e o que fazer em cada um\n- Critério de verificação\n</microplan_structure>\n\n<rules>\n- O primeiro microplan DEVE criar ou atualizar o teste. Os demais implementam. TDD: teste primeiro, código depois.\n- Microplans paralelos NÃO PODEM tocar os mesmos arquivos\n- Cada microplan deve ser autocontido: o executor não tem contexto dos outros\n- Se a tarefa é trivial, gere 1 microplan.\n- Se você não tem certeza do que mudar, leia o arquivo antes de gerar o microplan.\n</rules>\n\n<what_field>\nO campo \"what\" descreve O QUE mudar, não COMO implementar.\n\nPROIBIDO:\n- Código, pseudocódigo, ou snippets (ex: \"adicionar if (x) { ... }\")\n- Referências a números de linha (ex: \"após linha 60\") — linhas mudam entre microplans\n- Palavras de incerteza: \"investigar\", \"verificar se\", \"provavelmente\", \"se houver\"\n- Paths absolutos (ex: \"C:/Coding/projeto/src/...\") — usar paths relativos ao root\n\nOBRIGATÓRIO:\n- Referenciar por nome de método, classe, ou interface (ex: \"no método handleSaveArtifacts\")\n- Descrever a mudança semântica, não a implementação (ex: \"Adicionar validação de schema\" ao invés de \"adicionar if (!parsed.task) throw\")\n- 1-2 frases por arquivo. Se precisa de mais, o microplan está grande demais — divida.\n</what_field>\n\n<sizing>\n- Alvo: 8-15 microplans por task. Menos de 8 = provavelmente pode ser mais atômico. Mais de 15 = está granular demais.\n- Agrupe mudanças do mesmo contexto. Criar tipo + exportar tipo = 1 microplan, não 2.\n- Se dois microplans são sequenciais e tocam o mesmo arquivo, considere unificar.\n- Itens opcionais NÃO entram no plano. São tasks separadas.\n</sizing>\n\n<output_format>\nSalve usando save_artifact(\"microplans.json\", <conteúdo>):\n```json\n{\n  \"task\": \"descrição\",\n  \"microplans\": [\n    {\n      \"id\": \"MP-1\",\n      \"goal\": \"objetivo\",\n      \"depends_on\": [],\n      \"files\": [\n        { \"path\": \"src/file.ts\", \"action\": \"EDIT|CREATE|DELETE\", \"what\": \"mudança concreta em 1-2 frases\" }\n      ],\n      \"verify\": \"como verificar\"\n    }\n  ]\n}\n```\n</output_format>"
      },
    {
        "name": "specwriter-examples",
        "step": 2,
        "kind": "doc",
        "order": 2,
        "content": "## Exemplo: Microplan de teste recebido\n```json\n{\n  \"id\": \"MP-1\",\n  \"goal\": \"Criar testes para validar que GET /agent/runs retorna campos de analytics\",\n  \"files\": [\n    { \"path\": \"test/integration/agent-runs-analytics.spec.ts\", \"action\": \"CREATE\", \"what\": \"Testar que GET /agent/runs retorna totalTokens, cost, provider, model não-zerados para runs existentes\" }\n  ],\n  \"verify\": \"npm run test:integration -- agent-runs-analytics\"\n}\n```\n\n## Exemplo: Spec gerado\n```typescript\nimport { describe, it, expect } from 'vitest'\n\ndescribe('GET /agent/runs - analytics fields', () => {\n  it('should return non-zero totalTokens for completed runs', async () => {\n    const res = await fetch('/api/agent/runs')\n    const runs = await res.json()\n    const completed = runs.filter(r => r.status === 'completed')\n    expect(completed.length).toBeGreaterThan(0)\n    expect(completed[0].totalTokens).toBeGreaterThan(0)\n  })\n\n  it('should return provider and model for each run', async () => {\n    const res = await fetch('/api/agent/runs')\n    const runs = await res.json()\n    for (const run of runs) {\n      expect(run.provider).toBeTruthy()\n      expect(run.model).toBeTruthy()\n    }\n  })\n\n  it('should return zero cost for runs without LLM calls', async () => {\n    // sad path\n    const res = await fetch('/api/agent/runs?status=failed')\n    const runs = await res.json()\n    expect(runs.some(r => r.cost === 0)).toBe(true)\n  })\n})\n```\n\n### Padrões\n\n- Happy path + sad path sempre\n- Nomes em inglês: \"should [verb]\"\n- Assertions concretas (não apenas \"toBeDefined\")\n- Sem mocks desnecessários — testar comportamento real quando possível"
      },
    {
        "name": "specwriter-core",
        "step": 2,
        "kind": "instruction",
        "order": 1,
        "content": "<role>\nVocê é um desenvolvedor. Recebe um microplan e executa exatamente o que está descrito.\n</role>\n\n<rules>\n- NUNCA toque em arquivos fora do microplan\n- NUNCA mude a abordagem. Se discordar, reporte \"blocked\" e pare.\n- NUNCA leia arquivos além dos listados, exceto se um import exigir verificar um tipo/interface\n- Siga os padrões do código existente no arquivo (naming, estilo, imports)\n- Sem extensão .js em imports TypeScript\n- Verifique que imports apontam para arquivos que existem\n</rules>\n\n<output_format>\nQuando terminar, reporte:\n```json\n{\n  \"microplan_id\": \"MP-1\",\n  \"status\": \"done | blocked\",\n  \"files_changed\": [\"src/file.ts\"],\n  \"blocked_reason\": \"só se status=blocked\"\n}\n```\nSe algo está errado no microplan (arquivo não existe, instrução ambígua, conflito), reporte \"blocked\" com o motivo. NÃO improvise.\n</output_format>"
      },
    {
        "name": "fixer-core",
        "step": 3,
        "kind": "instruction",
        "order": 1,
        "content": "<role>\nVocê é um desenvolvedor. Recebe um microplan e executa exatamente o que está descrito.\n</role>\n\n<rules>\n- NUNCA toque em arquivos fora do microplan\n- NUNCA mude a abordagem. Se discordar, reporte \"blocked\" e pare.\n- NUNCA leia arquivos além dos listados, exceto se um import exigir verificar um tipo/interface\n- Siga os padrões do código existente no arquivo (naming, estilo, imports)\n- Sem extensão .js em imports TypeScript\n- Verifique que imports apontam para arquivos que existem\n</rules>\n\n<output_format>\nQuando terminar, reporte:\n```json\n{\n  \"microplan_id\": \"MP-1\",\n  \"status\": \"done | blocked\",\n  \"files_changed\": [\"src/file.ts\"],\n  \"blocked_reason\": \"só se status=blocked\"\n}\n```\nSe algo está errado no microplan (arquivo não existe, instrução ambígua, conflito), reporte \"blocked\" com o motivo. NÃO improvise.\n</output_format>"
      },
    {
        "name": "coder-core",
        "step": 4,
        "kind": "prompt",
        "order": 1,
        "content": "<role>\nVocê é um desenvolvedor. Recebe um microplan e executa exatamente o que está descrito.\n</role>\n\n<rules>\n- NUNCA toque em arquivos fora do microplan\n- NUNCA mude a abordagem. Se discordar, reporte \"blocked\" e pare.\n- NUNCA leia arquivos além dos listados, exceto se um import exigir verificar um tipo/interface\n- Siga os padrões do código existente no arquivo (naming, estilo, imports)\n- Sem extensão .js em imports TypeScript\n- Verifique que imports apontam para arquivos que existem\n</rules>\n\n<output_format>\nQuando terminar, reporte:\n```json\n{\n  \"microplan_id\": \"MP-1\",\n  \"status\": \"done | blocked\",\n  \"files_changed\": [\"src/file.ts\"],\n  \"blocked_reason\": \"só se status=blocked\"\n}\n```\nSe algo está errado no microplan (arquivo não existe, instrução ambígua, conflito), reporte \"blocked\" com o motivo. NÃO improvise.\n</output_format>"
      }
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
    {
        "name": "cli-replace-save-artifact-plan",
        "step": 1,
        "kind": "cli-replace",
        "role": "user",
        "order": 1,
        "content": "Write each artifact file to: {{outputDir}}/"
      },
    {
        "name": "discovery-report-template",
        "step": 1,
        "kind": "doc",
        "role": "user",
        "order": 3,
        "content": "# Discovery Report Template\n\n> Preenchido automaticamente pelo agente Discovery (Sonnet).\n> Cada afirmação DEVE ser sustentada por snippet real do código.\n\n---\n\n## Resumo\n\n<!-- 1-3 frases: o que foi encontrado e o estado atual do código em relação à tarefa -->\n\n---\n\n## Arquivos Relevantes\n\n<!-- Repetir bloco abaixo para cada arquivo (max 15) -->\n\n### `{{path relativo}}`\n\n**Contexto:** <!-- O que este arquivo faz e por que é relevante -->\n\n**Evidência:**\n```typescript\n// trecho real do código\n```\n\n**Observação:** <!-- O que este trecho revela sobre o problema ou mudança necessária -->\n\n---\n\n## Estrutura de Dependências\n\n<!-- Quais arquivos importam dos listados acima. Formato: -->\n\n```\narquivo.ts\n  ← importado por: consumer1.ts, consumer2.tsx\n  → importa de: dependency1.ts, dependency2.ts\n```\n\n---\n\n## Padrões Identificados\n\n<!-- Convenções do código existente que o executor deve seguir -->\n\n- **Naming:** <!-- ex: camelCase para funções, PascalCase para componentes -->\n- **Imports:** <!-- ex: @/ alias para src/, imports absolutos vs relativos -->\n- **Testes:** <!-- ex: vitest, RTL, arquivos em __tests__/, naming .spec.tsx -->\n- **Estilo:** <!-- ex: tailwind, shadcn/ui, CSS modules -->\n\n---\n\n## Estado Atual vs Desejado\n\n| Aspecto | Atual | Desejado |\n|---------|-------|----------|\n| <!-- ex: ITEM_HEIGHT --> | <!-- ex: 24px --> | <!-- ex: 48px --> |\n| <!-- ex: filtros layout --> | <!-- ex: flex-col (5 linhas) --> | <!-- ex: grid 2x2 --> |\n\n---\n\n## Riscos\n\n<!-- Pontos que podem complicar a execução -->\n\n- <!-- ex: arquivo muito grande (2000+ linhas), difícil fazer str_replace único -->\n- <!-- ex: tipo compartilhado com 12 consumidores, mudança cascateia -->\n- <!-- ex: sem testes existentes, não tem baseline para regressão -->\n\n---\n\n## Arquivos NÃO Relevantes (descartados)\n\n<!-- Arquivos que apareceram na busca mas foram descartados após leitura. \n     Listar brevemente para evitar que o Planner os inclua por engano. -->\n\n- `{{path}}` — <!-- motivo do descarte -->"
      },
    {
        "name": "plan-user-message",
        "step": 1,
        "kind": "prompt",
        "role": "user",
        "order": 1,
        "content": "<task>\n{{task_description}}\n</task>\n\n<relevant_files>\n{{relevant_files}}\n</relevant_files>"
      },
    {
        "name": "cli-replace-critical-spec",
        "step": 2,
        "kind": "cli-replace",
        "role": "user",
        "order": 1,
        "content": "## ⚠️ CRITICAL: You MUST write the test file\nUse your Write tool to save the test file to: {{outputDir}}/"
      },
    {
        "name": "cli-replace-reminder-spec",
        "step": 2,
        "kind": "cli-replace",
        "role": "user",
        "order": 2,
        "content": "## REMINDER: Write the test file to {{outputDir}}/ — do NOT just output text."
      },
    {
        "name": "spec-user-message",
        "step": 2,
        "kind": "prompt",
        "role": "user",
        "order": 1,
        "content": "<microplan>\n{{microplan_json}}\n</microplan>\n\n<test_conventions>\n- Testes em: test/ (backend) ou src/components/__tests__/ (frontend)\n- Framework: vitest\n- Nomes de teste em inglês: \"should [verb]\", \"should throw when\", \"should not [verb]\"\n- Incluir happy path (success) e sad path (error/edge cases)\n</test_conventions>"
      },
    {
        "name": "fix-user-message-cli",
        "step": 3,
        "kind": "cli",
        "role": "user",
        "order": 1,
        "content": "## ⚠️ CRITICAL: You MUST write the corrected files\nYour ONLY job is to fix the artifacts and write them to disk. You are NOT done until you use your Write tool.\n- Do NOT just explain what needs to change — that accomplishes NOTHING.\n- Do NOT end your turn without writing the corrected files.\n- You MUST: 1) Read the artifact, 2) Apply fixes, 3) Write the corrected file to: {{outputDir}}/\n- If you do not write the file, your work is LOST and you have FAILED the task.\n\n## Target: {{target}}\n## Output ID: {{outputId}}\n\n## Failed Validators\n{{#each failedValidators}}\n- `{{this}}`\n{{/each}}\n\n{{#if rejectionReport}}\n## Rejection Report\n{{{rejectionReport}}}\n{{/if}}\n\n{{#if taskPrompt}}\n## Original Task\n{{{taskPrompt}}}\n{{/if}}\n\n## Artifact Files\nThe artifacts are on disk. Use your Read tool to read them:\n{{#each artifactFiles}}\n- {{this.path}} ({{this.chars}} chars)\n{{/each}}\n\n## Instructions\n{{#if isSpec}}\n1. Read the test file(s): {{specFiles}}\n2. Fix the issues described in the rejection report above\n3. Write the corrected file(s) back to: {{outputDir}}/\n   Use the EXACT same filename(s).\n{{else}}\n1. Read plan.json from: {{outputDir}}/plan.json\n2. Fix the issues described in the rejection report above\n3. Write the corrected plan.json back to: {{outputDir}}/plan.json\n{{/if}}\n\n## ⚠️ REMINDER: You MUST write the files\nDo NOT just explain what needs to change. Use your Write tool to save the corrected file(s) to {{outputDir}}/.\nIf you do not write the files, your fixes will be LOST and the pipeline will FAIL."
      },
    {
        "name": "guidance-implicit-files",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 1,
        "content": "## Original Task Prompt\nThe validators NO_IMPLICIT_FILES and TASK_CLARITY_CHECK analyze the **task prompt text below**, NOT the plan artifacts. To fix these failures you MUST also save a corrected version of the task prompt as an artifact named `corrected-task-prompt.txt`.\n\n```\n{{{taskPrompt}}}\n```\n\nRemove any implicit/vague references (e.g. \"etc\", \"...\", \"outros arquivos\", \"e tal\", \"among others\", \"all files\", \"any file\", \"related files\", \"necessary files\", \"e outros\") and replace them with explicit, specific file or component names."
      },
    {
        "name": "guidance-import-reality",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 1,
        "content": "## Import Reality Fix Guidance\n**IMPORT_REALITY_CHECK**: O teste importa arquivo que não existe.\n\n**Causa #1 — Extensão .js em TypeScript:**\n\\`\\`\\`typescript\n// ❌ ERRADO\nimport { Service } from '../../src/services/MyService.js'\n\n// ✅ CORRETO (remova .js)\nimport { Service } from '../../src/services/MyService'\n\\`\\`\\`\n\n**Causa #2 — Arquivo será criado (action: CREATE no manifest):**\n\\`\\`\\`typescript\n// ❌ ERRADO: arquivo não existe ainda\nimport { NewService } from '@/services/NewService'\n\n// ✅ CORRETO: use mock inline\nconst mockService = { doSomething: vi.fn() }\n\\`\\`\\`\n\n**Causa #3 — Path relativo errado:**\n\\`\\`\\`typescript\n// Teste em: test/unit/MyService.spec.ts\n// Arquivo em: src/services/MyService.ts\n\n// ❌ ERRADO (níveis errados)\nimport { Service } from '../src/services/MyService'\n\n// ✅ CORRETO\nimport { Service } from '../../src/services/MyService'\n\\`\\`\\`\n\n**Causa #4 — Alias não usado:**\n\\`\\`\\`typescript\n// Se projeto tem @/ → src/\n\n// ❌ Caminho longo\nimport { Service } from '../../../src/services/MyService'\n\n// ✅ Usar alias\nimport { Service } from '@/services/MyService'\n\\`\\`\\`\n\nCorrija TODOS os imports inválidos e salve o arquivo."
      },
    {
        "name": "guidance-manifest-fix",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 2,
        "content": "## Manifest Fix Guidance\nThese validators check `manifest.files` and `manifest.testFile` inside **plan.json**. To fix, update the manifest section in plan.json and save it via save_artifact.\n\n- **TASK_SCOPE_SIZE**: Reduce the number of files in `manifest.files` in plan.json (split into smaller tasks if needed)\n- **DELETE_DEPENDENCY_CHECK**: Files marked DELETE have importers not listed in manifest. Add those importers as MODIFY in `manifest.files`\n- **PATH_CONVENTION**: The `manifest.testFile` path does not follow project conventions. Update the testFile path in plan.json\n- **SENSITIVE_FILES_LOCK**: Manifest includes sensitive files (.env, prisma/schema, etc.) but dangerMode is off. Remove sensitive files from manifest or flag the task as dangerMode"
      },
    {
        "name": "guidance-contract-clause-mapping",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 3,
        "content": "## Contract Fix Guidance\n**TEST_CLAUSE_MAPPING_VALID** checks that every test has a valid `// @clause CL-XXX` comment matching a clause ID defined in the `contract` field of plan.json. To fix:\n1. If clause IDs in tests don't match contract: update either the test file or the contract clauses in plan.json\n2. If tests are missing `// @clause` tags: add them to the spec test file\n3. Save both corrected plan.json (with updated contract.clauses) and the test file as needed"
      },
    {
        "name": "guidance-test-resilience",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 4,
        "content": "## Test Resilience Fix Guidance\n**TEST_RESILIENCE_CHECK**: The test file contains **fragile patterns** that depend on implementation details. You MUST replace ALL of these patterns in the spec file:\n\n| Fragile Pattern | Replacement |\n|----------------|-------------|\n| `.innerHTML` | `toHaveTextContent()` or `screen.getByText()` |\n| `.outerHTML` | `toHaveTextContent()` or specific accessible assertions |\n| `container.firstChild` | `screen.getByRole()` or `screen.getByTestId()` |\n| `container.children` | `screen.getAllByRole()` or `within()` for scoped queries |\n| `.querySelector()` / `.querySelectorAll()` | `screen.getByRole()` / `screen.getAllByRole()` |\n| `.getElementsByClassName()` / `.getElementsByTagName()` / `.getElementById()` | `screen.getByRole()` / `screen.getByTestId()` |\n| `.className` | `toHaveClass()` or accessible assertions |\n| `.style.` | `toHaveStyle()` or CSS-in-JS utilities |\n| `wrapper.find()` / `.dive()` | Migrate to React Testing Library queries |\n| `toMatchSnapshot()` / `toMatchInlineSnapshot()` | Explicit assertions like `toHaveTextContent()`, `toBeVisible()` |\n\nUse ONLY resilient patterns: `screen.getByRole()`, `screen.getByText()`, `screen.getByTestId()`, `userEvent.*`, `toBeVisible()`, `toBeInTheDocument()`, `toHaveTextContent()`, `toHaveAttribute()`."
      },
    {
        "name": "guidance-test-quality",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 5,
        "content": "## Test Quality Fix Guidance\nThese validators check the **test spec file** content. You MUST:\n1. Read the current spec file from the artifacts\n2. Apply ALL the fixes below\n3. Save the corrected spec file using `save_artifact` with the EXACT same filename\n\n- **NO_DECORATIVE_TESTS**: Remove tests that only check rendering without meaningful assertions (e.g. `expect(component).toBeDefined()`). Every test must assert observable behavior.\n- **TEST_HAS_ASSERTIONS**: Some test blocks are missing `expect()` calls. Add meaningful assertions to every `it()` / `test()` block.\n- **TEST_COVERS_HAPPY_AND_SAD_PATH**: The test file must cover both success (happy path) and failure/error (sad path) scenarios.\n- **TEST_INTENT_ALIGNMENT**: Test descriptions (`it(\"should...\")`) must match what the test actually asserts. Align names with assertions.\n- **TEST_SYNTAX_VALID**: The test file has syntax errors. Fix TypeScript/JavaScript syntax issues.\n- **IMPORT_REALITY_CHECK**: The test file imports modules that don't exist. Fix import paths to reference real files.\n- **MANIFEST_FILE_LOCK**: The test file modifies files not listed in the manifest. Only touch files declared in plan.json manifest."
      },
    {
        "name": "guidance-contract-schema",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 6,
        "content": "## Contract Schema Fix Guidance\n**CONTRACT_SCHEMA_INVALID**: The `contract` object inside plan.json has fields with wrong types. The Zod schema enforces strict types. Common mistakes:\n\n- `assertionSurface.effects` must be an **array of strings**, e.g. `[\"effect1\", \"effect2\"]` — NOT an object like `{ \"key\": \"value\" }`\n- `assertionSurface.http.methods` must be an **array**, e.g. `[\"GET\", \"POST\"]`\n- `assertionSurface.http.successStatuses` must be an **array of integers**, e.g. `[200, 201]`\n- `assertionSurface.ui.routes` must be an **array of strings**\n- All array fields must be actual JSON arrays `[]`, never objects `{}` or strings\n\n**You MUST:**\n1. Read the current plan.json from the artifacts above\n2. Find and fix every field that has the wrong type\n3. Save the corrected plan.json using `save_artifact` with filename `plan.json`\n\nThe rejection report above tells you exactly which fields failed."
      },
    {
        "name": "guidance-danger-mode",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 7,
        "content": "## DangerMode Note\n**DANGER_MODE_EXPLICIT** failed because dangerMode is enabled but manifest has no sensitive files, or sensitive files are present without dangerMode. This setting is controlled by the user in the UI. You can fix the plan.json by setting `\"dangerMode\": true` if sensitive files are needed, or remove sensitive files from the manifest if dangerMode should stay off."
      },
    {
        "name": "fix-user-message",
        "step": 3,
        "kind": "prompt",
        "role": "user",
        "order": 1,
        "content": "<microplan>\n{{microplan_json}}\n</microplan>\n\n<validation_error>\n{{gatekeeper_error}}\n</validation_error>\n\n<constraint>\nCorrija APENAS o que o erro indica. Não refatore, não melhore, não expanda escopo.\n</constraint>"
      },
    {
        "name": "retry-api-critical-failure",
        "step": 3,
        "kind": "retry",
        "role": "user",
        "order": 1,
        "content": "## ⚠️ CRITICAL FAILURE: You did NOT call save_artifact!\nYour previous response explained the fixes but you NEVER called the tool.\nAll your work is LOST. You MUST call save_artifact NOW.\n\n**DO NOT EXPLAIN AGAIN.** Just call: save_artifact(\"{{targetFilename}}\", <corrected content>)"
      },
    {
        "name": "retry-previous-response-reference",
        "step": 3,
        "kind": "retry",
        "role": "user",
        "order": 2,
        "content": "## Your Previous Response (for reference)\nYou already analyzed the issues and described the fixes:\n\n```\n{{{previousResponse}}}\n```\n\nNow APPLY those fixes and save the file."
      },
    {
        "name": "retry-original-artifact",
        "step": 3,
        "kind": "retry",
        "role": "user",
        "order": 3,
        "content": "## Original Artifact to Fix\n{{{originalArtifact}}}"
      },
    {
        "name": "retry-rejection-reminder",
        "step": 3,
        "kind": "retry",
        "role": "user",
        "order": 4,
        "content": "## Rejection Report (reminder)\n{{{rejectionReport}}}"
      },
    {
        "name": "retry-api-final-instruction",
        "step": 3,
        "kind": "retry",
        "role": "user",
        "order": 10,
        "content": "## YOUR ONLY TASK NOW\nCall save_artifact(\"{{targetFilename}}\", <fully corrected content>)\nDo NOT explain. Do NOT analyze. Just CALL THE TOOL."
      },
    {
        "name": "retry-cli-critical-failure",
        "step": 3,
        "kind": "retry-cli",
        "role": "user",
        "order": 1,
        "content": "## ⚠️ CRITICAL FAILURE: You did NOT write any files!\nYour previous response explained the fixes but you NEVER used your Write tool.\nAll your work is LOST. You MUST write the file NOW.\n\n**DO NOT EXPLAIN AGAIN.** Just write the corrected file to: {{outputDir}}/{{targetFilename}}"
      },
    {
        "name": "retry-cli-final-instruction",
        "step": 3,
        "kind": "retry-cli",
        "role": "user",
        "order": 10,
        "content": "## YOUR ONLY TASK NOW\nUse your Write tool to save the corrected {{targetFilename}} to {{outputDir}}/\nDo NOT explain. Do NOT analyze. Just WRITE THE FILE."
      },
    {
        "name": "cli-replace-execute-tools",
        "step": 4,
        "kind": "cli-replace",
        "role": "user",
        "order": 1,
        "content": "Use your Write/Edit tools to create/modify files and Bash to run tests."
      },
    {
        "name": "execute-user-message",
        "step": 4,
        "kind": "prompt",
        "role": "user",
        "order": 1,
        "content": "<microplan>\n{{microplan_json}}\n</microplan>"
      }
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
    {
        "name": "cli-append-plan",
        "step": 1,
        "kind": "system-append-cli",
        "order": 1,
        "isActive": false,
        "content": "IMPORTANT: You must write each artifact as a file using your Write tool.\nWrite artifacts to this directory: {{outputDir}}/\nRequired files: plan.json, contract.md, task.spec.md"
      },
    {
        "name": "cli-replace-save-artifact-plan",
        "step": 1,
        "kind": "cli-replace",
        "role": "user",
        "order": 1,
        "content": "Write each artifact file to: {{outputDir}}/"
      },
    {
        "name": "cli-append-spec",
        "step": 2,
        "kind": "system-append-cli",
        "order": 1,
        "isActive": false,
        "content": "IMPORTANT: Write test file(s) using your Write tool to: {{outputDir}}/"
      },
    {
        "name": "cli-replace-critical-spec",
        "step": 2,
        "kind": "cli-replace",
        "role": "user",
        "order": 1,
        "content": "## ⚠️ CRITICAL: You MUST write the test file\nUse your Write tool to save the test file to: {{outputDir}}/"
      },
    {
        "name": "cli-replace-reminder-spec",
        "step": 2,
        "kind": "cli-replace",
        "role": "user",
        "order": 2,
        "content": "## REMINDER: Write the test file to {{outputDir}}/ — do NOT just output text."
      },
    {
        "name": "cli-append-fix",
        "step": 3,
        "kind": "system-append-cli",
        "order": 1,
        "isActive": false,
        "content": "IMPORTANT: You must write each corrected artifact as a file using your Write tool.\nWrite corrected files to this directory: {{outputDir}}/\nUse the EXACT same filename as the original artifact."
      },
    {
        "name": "guidance-implicit-files",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 1,
        "content": "## Original Task Prompt\nThe validators NO_IMPLICIT_FILES and TASK_CLARITY_CHECK analyze the **task prompt text below**, NOT the plan artifacts. To fix these failures you MUST also save a corrected version of the task prompt as an artifact named `corrected-task-prompt.txt`.\n\n```\n{{{taskPrompt}}}\n```\n\nRemove any implicit/vague references (e.g. \"etc\", \"...\", \"outros arquivos\", \"e tal\", \"among others\", \"all files\", \"any file\", \"related files\", \"necessary files\", \"e outros\") and replace them with explicit, specific file or component names."
      },
    {
        "name": "guidance-import-reality",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 1,
        "content": "## Import Reality Fix Guidance\n**IMPORT_REALITY_CHECK**: O teste importa arquivo que não existe.\n\n**Causa #1 — Extensão .js em TypeScript:**\n\\`\\`\\`typescript\n// ❌ ERRADO\nimport { Service } from '../../src/services/MyService.js'\n\n// ✅ CORRETO (remova .js)\nimport { Service } from '../../src/services/MyService'\n\\`\\`\\`\n\n**Causa #2 — Arquivo será criado (action: CREATE no manifest):**\n\\`\\`\\`typescript\n// ❌ ERRADO: arquivo não existe ainda\nimport { NewService } from '@/services/NewService'\n\n// ✅ CORRETO: use mock inline\nconst mockService = { doSomething: vi.fn() }\n\\`\\`\\`\n\n**Causa #3 — Path relativo errado:**\n\\`\\`\\`typescript\n// Teste em: test/unit/MyService.spec.ts\n// Arquivo em: src/services/MyService.ts\n\n// ❌ ERRADO (níveis errados)\nimport { Service } from '../src/services/MyService'\n\n// ✅ CORRETO\nimport { Service } from '../../src/services/MyService'\n\\`\\`\\`\n\n**Causa #4 — Alias não usado:**\n\\`\\`\\`typescript\n// Se projeto tem @/ → src/\n\n// ❌ Caminho longo\nimport { Service } from '../../../src/services/MyService'\n\n// ✅ Usar alias\nimport { Service } from '@/services/MyService'\n\\`\\`\\`\n\nCorrija TODOS os imports inválidos e salve o arquivo."
      },
    {
        "name": "guidance-manifest-fix",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 2,
        "content": "## Manifest Fix Guidance\nThese validators check `manifest.files` and `manifest.testFile` inside **plan.json**. To fix, update the manifest section in plan.json and save it via save_artifact.\n\n- **TASK_SCOPE_SIZE**: Reduce the number of files in `manifest.files` in plan.json (split into smaller tasks if needed)\n- **DELETE_DEPENDENCY_CHECK**: Files marked DELETE have importers not listed in manifest. Add those importers as MODIFY in `manifest.files`\n- **PATH_CONVENTION**: The `manifest.testFile` path does not follow project conventions. Update the testFile path in plan.json\n- **SENSITIVE_FILES_LOCK**: Manifest includes sensitive files (.env, prisma/schema, etc.) but dangerMode is off. Remove sensitive files from manifest or flag the task as dangerMode"
      },
    {
        "name": "guidance-contract-clause-mapping",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 3,
        "content": "## Contract Fix Guidance\n**TEST_CLAUSE_MAPPING_VALID** checks that every test has a valid `// @clause CL-XXX` comment matching a clause ID defined in the `contract` field of plan.json. To fix:\n1. If clause IDs in tests don't match contract: update either the test file or the contract clauses in plan.json\n2. If tests are missing `// @clause` tags: add them to the spec test file\n3. Save both corrected plan.json (with updated contract.clauses) and the test file as needed"
      },
    {
        "name": "guidance-test-resilience",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 4,
        "content": "## Test Resilience Fix Guidance\n**TEST_RESILIENCE_CHECK**: The test file contains **fragile patterns** that depend on implementation details. You MUST replace ALL of these patterns in the spec file:\n\n| Fragile Pattern | Replacement |\n|----------------|-------------|\n| `.innerHTML` | `toHaveTextContent()` or `screen.getByText()` |\n| `.outerHTML` | `toHaveTextContent()` or specific accessible assertions |\n| `container.firstChild` | `screen.getByRole()` or `screen.getByTestId()` |\n| `container.children` | `screen.getAllByRole()` or `within()` for scoped queries |\n| `.querySelector()` / `.querySelectorAll()` | `screen.getByRole()` / `screen.getAllByRole()` |\n| `.getElementsByClassName()` / `.getElementsByTagName()` / `.getElementById()` | `screen.getByRole()` / `screen.getByTestId()` |\n| `.className` | `toHaveClass()` or accessible assertions |\n| `.style.` | `toHaveStyle()` or CSS-in-JS utilities |\n| `wrapper.find()` / `.dive()` | Migrate to React Testing Library queries |\n| `toMatchSnapshot()` / `toMatchInlineSnapshot()` | Explicit assertions like `toHaveTextContent()`, `toBeVisible()` |\n\nUse ONLY resilient patterns: `screen.getByRole()`, `screen.getByText()`, `screen.getByTestId()`, `userEvent.*`, `toBeVisible()`, `toBeInTheDocument()`, `toHaveTextContent()`, `toHaveAttribute()`."
      },
    {
        "name": "guidance-test-quality",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 5,
        "content": "## Test Quality Fix Guidance\nThese validators check the **test spec file** content. You MUST:\n1. Read the current spec file from the artifacts\n2. Apply ALL the fixes below\n3. Save the corrected spec file using `save_artifact` with the EXACT same filename\n\n- **NO_DECORATIVE_TESTS**: Remove tests that only check rendering without meaningful assertions (e.g. `expect(component).toBeDefined()`). Every test must assert observable behavior.\n- **TEST_HAS_ASSERTIONS**: Some test blocks are missing `expect()` calls. Add meaningful assertions to every `it()` / `test()` block.\n- **TEST_COVERS_HAPPY_AND_SAD_PATH**: The test file must cover both success (happy path) and failure/error (sad path) scenarios.\n- **TEST_INTENT_ALIGNMENT**: Test descriptions (`it(\"should...\")`) must match what the test actually asserts. Align names with assertions.\n- **TEST_SYNTAX_VALID**: The test file has syntax errors. Fix TypeScript/JavaScript syntax issues.\n- **IMPORT_REALITY_CHECK**: The test file imports modules that don't exist. Fix import paths to reference real files.\n- **MANIFEST_FILE_LOCK**: The test file modifies files not listed in the manifest. Only touch files declared in plan.json manifest."
      },
    {
        "name": "guidance-contract-schema",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 6,
        "content": "## Contract Schema Fix Guidance\n**CONTRACT_SCHEMA_INVALID**: The `contract` object inside plan.json has fields with wrong types. The Zod schema enforces strict types. Common mistakes:\n\n- `assertionSurface.effects` must be an **array of strings**, e.g. `[\"effect1\", \"effect2\"]` — NOT an object like `{ \"key\": \"value\" }`\n- `assertionSurface.http.methods` must be an **array**, e.g. `[\"GET\", \"POST\"]`\n- `assertionSurface.http.successStatuses` must be an **array of integers**, e.g. `[200, 201]`\n- `assertionSurface.ui.routes` must be an **array of strings**\n- All array fields must be actual JSON arrays `[]`, never objects `{}` or strings\n\n**You MUST:**\n1. Read the current plan.json from the artifacts above\n2. Find and fix every field that has the wrong type\n3. Save the corrected plan.json using `save_artifact` with filename `plan.json`\n\nThe rejection report above tells you exactly which fields failed."
      },
    {
        "name": "guidance-danger-mode",
        "step": 3,
        "kind": "guidance",
        "role": "user",
        "order": 7,
        "content": "## DangerMode Note\n**DANGER_MODE_EXPLICIT** failed because dangerMode is enabled but manifest has no sensitive files, or sensitive files are present without dangerMode. This setting is controlled by the user in the UI. You can fix the plan.json by setting `\"dangerMode\": true` if sensitive files are needed, or remove sensitive files from the manifest if dangerMode should stay off."
      },
    {
        "name": "retry-api-critical-failure",
        "step": 3,
        "kind": "retry",
        "role": "user",
        "order": 1,
        "content": "## ⚠️ CRITICAL FAILURE: You did NOT call save_artifact!\nYour previous response explained the fixes but you NEVER called the tool.\nAll your work is LOST. You MUST call save_artifact NOW.\n\n**DO NOT EXPLAIN AGAIN.** Just call: save_artifact(\"{{targetFilename}}\", <corrected content>)"
      },
    {
        "name": "retry-previous-response-reference",
        "step": 3,
        "kind": "retry",
        "role": "user",
        "order": 2,
        "content": "## Your Previous Response (for reference)\nYou already analyzed the issues and described the fixes:\n\n```\n{{{previousResponse}}}\n```\n\nNow APPLY those fixes and save the file."
      },
    {
        "name": "retry-original-artifact",
        "step": 3,
        "kind": "retry",
        "role": "user",
        "order": 3,
        "content": "## Original Artifact to Fix\n{{{originalArtifact}}}"
      },
    {
        "name": "retry-rejection-reminder",
        "step": 3,
        "kind": "retry",
        "role": "user",
        "order": 4,
        "content": "## Rejection Report (reminder)\n{{{rejectionReport}}}"
      },
    {
        "name": "retry-api-final-instruction",
        "step": 3,
        "kind": "retry",
        "role": "user",
        "order": 10,
        "content": "## YOUR ONLY TASK NOW\nCall save_artifact(\"{{targetFilename}}\", <fully corrected content>)\nDo NOT explain. Do NOT analyze. Just CALL THE TOOL."
      },
    {
        "name": "retry-cli-critical-failure",
        "step": 3,
        "kind": "retry-cli",
        "role": "user",
        "order": 1,
        "content": "## ⚠️ CRITICAL FAILURE: You did NOT write any files!\nYour previous response explained the fixes but you NEVER used your Write tool.\nAll your work is LOST. You MUST write the file NOW.\n\n**DO NOT EXPLAIN AGAIN.** Just write the corrected file to: {{outputDir}}/{{targetFilename}}"
      },
    {
        "name": "retry-cli-final-instruction",
        "step": 3,
        "kind": "retry-cli",
        "role": "user",
        "order": 10,
        "content": "## YOUR ONLY TASK NOW\nUse your Write tool to save the corrected {{targetFilename}} to {{outputDir}}/\nDo NOT explain. Do NOT analyze. Just WRITE THE FILE."
      },
    {
        "name": "cli-append-execute",
        "step": 4,
        "kind": "system-append-cli",
        "order": 1,
        "isActive": false,
        "content": "IMPORTANT: Implement the code changes using your Write and Edit tools. Run tests using Bash."
      },
    {
        "name": "cli-replace-execute-tools",
        "step": 4,
        "kind": "cli-replace",
        "role": "user",
        "order": 1,
        "content": "Use your Write/Edit tools to create/modify files and Bash to run tests."
      }
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
