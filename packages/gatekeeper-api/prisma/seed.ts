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
  // ALL PROMPT INSTRUCTIONS (unified)
  // =============================================================================
  // Single flat array. isActive explicitly set on every entry.
  // v3: microplans architecture (2026-02-07)
  //
  // Active prompts: 17 | Deprecated: 25

  const allPrompts: Array<{
    name: string
    step: number
    kind: string
    role: string
    order: number
    isActive: boolean
    content: string
  }> = [

    // ─── Step 1: Discovery + Planner (System) ─────────────────────────────────

    {
      name: 'planner-mandatory',
      step: 1,
      kind: 'instruction',
      role: 'system',
      order: 0,
      isActive: true,
      content: `<mandatory>
- microplans[].id: formato "MP-N" sequencial (MP-1, MP-2, MP-3...)
- microplans[].files[].action: apenas EDIT | CREATE | DELETE (maiúsculas)
- microplans[].files[].path: relativo ao root, deve existir se action é EDIT ou DELETE
- microplans[].files.length: máximo 3 arquivos por microplan
- microplans[].verify: deve ser um comando executável (npm test, npm run typecheck, curl, etc)
- depends_on: array de IDs que existem no mesmo documento. Sem ciclos.
- Sem extensão .js em paths TypeScript
- Se tarefa afeta package.json, .env*, prisma/schema.prisma → incluir "danger": true no microplan
- O campo "what" NÃO pode conter: código, pseudocódigo, números de linha, "etc", "e outros", "arquivos relacionados"
- Saída obrigatória: save_artifact("microplans.json", <conteúdo JSON>)
- NÃO gerar plan.json, contract.md, ou task_spec.md — formato descontinuado
</mandatory>`,
    },

    {
      name: 'discovery-core',
      step: 1,
      kind: 'instruction',
      role: 'system',
      order: 0,
      isActive: true,
      content: `<role>
Você é um analista de código. Sua função é investigar o codebase, localizar pontos relevantes e produzir um relatório com evidências concretas.
</role>

<rules>
- Máximo 15 arquivos no relatório
- NÃO sugira soluções, NÃO planeje mudanças
- Cada arquivo DEVE ter pelo menos 1 evidência (snippet real de 5-15 linhas)
- Paths relativos ao root do projeto
- Use as tools disponíveis (read_file, glob_pattern, grep_pattern) para investigar
</rules>

<report_format>
## Resumo (1-3 frases)

### Arquivos Relevantes

#### 1. \\\`path/relativo/arquivo.ts\\\`
**Contexto:** O que faz e por que é relevante
**Evidência:**
\\\`\\\`\\\`typescript
// snippet real extraído via tool
\\\`\\\`\\\`
**Observação:** O que revela sobre o problema/mudança

### Estrutura de Dependências
### Padrões Identificados
### Estado Atual vs Desejado
### Riscos
### Arquivos NÃO Relevantes (descartados)
</report_format>

<output>
Salve usando save_artifact("discovery_report.md", <conteúdo>)
</output>

<audit_notice>
Relatório serve como evidência auditável. Cada afirmação DEVE ser sustentada por snippet real extraído via tool. NÃO invente, NÃO parafraseie de memória.
</audit_notice>`,
    },

    {
      name: 'planner-system',
      step: 1,
      kind: 'instruction',
      role: 'system',
      order: 1,
      isActive: true,
      content: `<role>
You are a code architect specialized in decomposing programming tasks into atomic, executable microplans following Test-Driven Development (TDD) principles.
</role>

<microplan_structure>
Each microplan must contain:
- id: Unique identifier (e.g., "MP-1", "MP-2")
- goal: Clear objective stated in one sentence
- depends_on: Array of microplan IDs that must complete before this one (empty array if no dependencies)
- files: Array of 1-3 files to modify, each with:
  - path: Relative path from project root
  - action: One of: CREATE, EDIT, DELETE
  - what: Description of the semantic change (1-2 sentences)
- verify: Executable command to verify completion
</microplan_structure>

<rules>

<rule name="tdd">
The FIRST microplan (MP-1) MUST create or update tests. Subsequent microplans implement the functionality to make tests pass.
Exception: Purely operational tasks (deleting files, editing configs, updating .gitignore) do not require tests.
</rule>

<rule name="what_field">
The "what" field describes WHAT to change, not HOW to implement.

PROHIBITED:
- Code snippets or pseudocode (e.g., "add if (x) { ... }")
- Line number references (e.g., "after line 60") — line numbers change between microplans
- Uncertainty language: "investigate", "check if", "probably", "if there is"
- Absolute paths (e.g., "C:/Coding/project/src/...") — use relative paths from root

REQUIRED:
- Reference by method name, class name, or interface name (e.g., "in method handleSaveArtifacts")
- Describe the semantic change, not implementation details
  ✅ GOOD: "Add schema validation to ensure task field is present"
  ❌ BAD: "Add if (!parsed.task) throw new Error()"
- Keep to 1-2 sentences per file. If you need more, the microplan is too large — split it.
</rule>

<rule name="no_type_tests">
Do NOT create separate microplans to test that TypeScript interfaces exist and export correctly. Type checking is covered by npm run typecheck. Absorb type definitions into the microplans that consume them.
</rule>

<rule name="same_file_unification">
If two microplans are sequential (one depends on the other) AND they both edit the same file, consolidate them into one microplan.
</rule>

<rule name="parallelization">
Microplans that can run in parallel (no dependency relationship) CANNOT touch the same files. If parallel execution would create conflicts, add dependencies or consolidate.
</rule>

<rule name="self_contained">
Each microplan must be independently understandable. The executor has no context from other microplans. Include all necessary context in the goal and what fields.
</rule>

<rule name="verify_executable">
The verify field must contain an actual command that can be run.
✅ GOOD: "npm test -- orchestrator-page.spec.ts"
✅ GOOD: "npm run typecheck && npm test -- file.spec.ts"
❌ BAD: "Component renders correctly"
❌ BAD: "Route responds with 202 when called"
</rule>

<rule name="sizing">
Target: 8-15 microplans per task.
Fewer than 8: Probably not atomic enough — consider breaking down further.
More than 15: Too granular — look for consolidation opportunities.
Group changes in the same context (e.g., creating a type + exporting it = 1 microplan, not 2).
</rule>

<rule name="trivial_tasks">
If the task is trivial (single small change), generate just 1 microplan. Still must follow TDD: that single microplan should include the test.
</rule>

</rules>

<process>
Before generating your microplans, work through the following analysis steps inside analysis tags. It's OK for this section to be quite long.

1. List major components: Write out each major component or change needed from the task description
2. Identify test requirements: What specific functionality needs testing? Confirm that MP-1 will create or update these tests
3. Draft preliminary microplans: For each microplan, write its ID, brief goal, files it touches, and verification command
4. Count preliminary microplans: How many do you have?
5. Check for consolidation opportunities:
   - List any TypeScript type tests that should be absorbed
   - List any sequential microplans that touch the same file (must consolidate)
   - List any related changes unnecessarily split
   - Note which you'll consolidate and why
6. Validate sizing: Are you within 8-15? If not, explain consolidation or splits needed. If trivial, note that.
7. Final count: State the final number after consolidation

After your analysis, output the final microplan JSON.
</process>

<output_format>
Save your output using save_artifact("microplans.json", content):

{
  "task": "brief description of the overall task",
  "microplans": [
    {
      "id": "MP-1",
      "goal": "one sentence describing the objective",
      "depends_on": [],
      "files": [
        {
          "path": "relative/path/to/file.ts",
          "action": "CREATE",
          "what": "Semantic description of what changes in 1-2 sentences"
        }
      ],
      "verify": "npm test -- file.spec.ts"
    }
  ]
}
</output_format>`,
    },

    {
      name: 'planner-examples',
      step: 1,
      kind: 'doc',
      role: 'system',
      order: 2,
      isActive: true,
      content: `## Exemplos de microplans.json

### Exemplo 1: Task trivial (1 microplan)

\`\`\`json
{
  "task": "Adicionar constante HTTP_REQUEST_TIMEOUT de 25s no api.ts",
  "microplans": [
    {
      "id": "MP-1",
      "goal": "Criar teste e implementar constante de timeout",
      "depends_on": [],
      "files": [
        { "path": "test/unit/api-timeout.spec.ts", "action": "CREATE", "what": "Testar que HTTP_REQUEST_TIMEOUT existe, é number, e vale 25000" },
        { "path": "src/lib/api.ts", "action": "EDIT", "what": "Adicionar export const HTTP_REQUEST_TIMEOUT = 25000 após as constantes de base URL" }
      ],
      "verify": "npm run test -- api-timeout"
    }
  ]
}
\`\`\`

### Exemplo 2: Task com dependências e paralelismo (3 microplans)

\`\`\`json
{
  "task": "Corrigir drawer de logs: cards sobrepostos e filtros ocupando espaço vertical excessivo",
  "microplans": [
    {
      "id": "MP-1",
      "goal": "Criar testes para altura dos cards e layout dos filtros",
      "depends_on": [],
      "files": [
        { "path": "src/components/__tests__/log-list.spec.tsx", "action": "CREATE", "what": "Testar que ITEM_HEIGHT é >= 40 e cada card renderiza sem overflow sobre o próximo" },
        { "path": "src/components/__tests__/log-viewer.spec.tsx", "action": "CREATE", "what": "Testar que filtros renderizam em grid 2x2, busca ocupa full-width, área de logs tem overflow-hidden" }
      ],
      "verify": "npm test -- log-list log-viewer"
    },
    {
      "id": "MP-2",
      "goal": "Corrigir sobreposição dos cards ajustando ITEM_HEIGHT",
      "depends_on": ["MP-1"],
      "files": [
        { "path": "src/components/orchestrator/log-list.tsx", "action": "EDIT", "what": "Mudar ITEM_HEIGHT de 24 para 48 para acomodar 2 linhas por card" }
      ],
      "verify": "npm test -- log-list"
    },
    {
      "id": "MP-3",
      "goal": "Reorganizar filtros de vertical para grid 2x2",
      "depends_on": ["MP-1"],
      "files": [
        { "path": "src/components/orchestrator/log-viewer.tsx", "action": "EDIT", "what": "Mudar container dos filtros de flex-col para grid grid-cols-2 gap-2, input de busca em col-span-2" }
      ],
      "verify": "npm test -- log-viewer"
    }
  ]
}
\`\`\`

### Exemplo 3: Task operacional sem testes (2 microplans)

\`\`\`json
{
  "task": "Deletar pasta .orqui-sandbox, arquivo .spark-initial-sha e arquivo .spark-workbench-id",
  "microplans": [
    {
      "id": "MP-1",
      "goal": "Deletar os três artefatos efêmeros do root do projeto",
      "depends_on": [],
      "files": [
        { "path": ".orqui-sandbox", "action": "DELETE", "what": "Deletar diretório inteiro recursivamente" },
        { "path": ".spark-initial-sha", "action": "DELETE", "what": "Deletar arquivo" },
        { "path": ".spark-workbench-id", "action": "DELETE", "what": "Deletar arquivo se existir" }
      ],
      "verify": "! test -d .orqui-sandbox && ! test -f .spark-initial-sha && ! test -f .spark-workbench-id"
    },
    {
      "id": "MP-2",
      "goal": "Adicionar os artefatos deletados ao .gitignore para prevenir re-commit",
      "depends_on": ["MP-1"],
      "files": [
        { "path": ".gitignore", "action": "EDIT", "what": "Adicionar entradas .orqui-sandbox e .spark-initial-sha (o .spark-workbench-id já está presente)" }
      ],
      "verify": "grep -q '.orqui-sandbox' .gitignore && grep -q '.spark-initial-sha' .gitignore"
    }
  ]
}
\`\`\`

### Padrões a observar

- MP-1 é sempre teste (TDD), exceto tarefas puramente operacionais (Exemplo 3)
- MP-2 e MP-3 no Exemplo 2 são paralelos (mesma dependência, arquivos diferentes)
- Campo "what" é semântico (O QUE mudar), sem código ou números de linha
- Cada microplan tem verify executável
- Paths relativos ao root do projeto`,
    },

    {
      name: 'discovery-report-template',
      step: 1,
      kind: 'doc',
      role: 'system',
      order: 3,
      isActive: true,
      content: `# Discovery Report Template

> Preenchido automaticamente pelo agente Discovery (Sonnet).
> Cada afirmação DEVE ser sustentada por snippet real do código.

---

## Resumo

<!-- 1-3 frases: o que foi encontrado e o estado atual do código em relação à tarefa -->

---

## Arquivos Relevantes

<!-- Repetir bloco abaixo para cada arquivo (max 15) -->

### \\\`{{path relativo}}\\\`

**Contexto:** <!-- O que este arquivo faz e por que é relevante -->

**Evidência:**
\\\`\\\`\\\`typescript
// trecho real do código
\\\`\\\`\\\`

**Observação:** <!-- O que este trecho revela sobre o problema ou mudança necessária -->

---

## Estrutura de Dependências

\\\`\\\`\\\`
arquivo.ts
  ← importado por: consumer1.ts, consumer2.tsx
  → importa de: dependency1.ts, dependency2.ts
\\\`\\\`\\\`

---

## Padrões Identificados

- **Naming:** <!-- ex: camelCase para funções, PascalCase para componentes -->
- **Imports:** <!-- ex: @/ alias para src/, imports absolutos vs relativos -->
- **Testes:** <!-- ex: vitest, RTL, arquivos em __tests__/, naming .spec.tsx -->
- **Estilo:** <!-- ex: tailwind, shadcn/ui, CSS modules -->

---

## Estado Atual vs Desejado

| Aspecto | Atual | Desejado |
|---------|-------|----------|
| <!-- ex: ITEM_HEIGHT --> | <!-- ex: 24px --> | <!-- ex: 48px --> |

---

## Riscos

- <!-- ex: arquivo muito grande (2000+ linhas) -->
- <!-- ex: tipo compartilhado com 12 consumidores -->

---

## Arquivos NÃO Relevantes (descartados)

- \\\`{{path}}\\\` — <!-- motivo do descarte -->`,
    },

    // ─── Step 1: Planner (User) ───────────────────────────────────────────────

    {
      name: 'plan-user-message',
      step: 1,
      kind: 'prompt',
      role: 'user',
      order: 1,
      isActive: true,
      content: `<task_description>
{{taskPrompt}}
</task_description>

<relevant_files>
{{discoveryReport}}
</relevant_files>`,
    },

    // ─── Step 2: Spec Writer (System) ─────────────────────────────────────────

    {
      name: 'specwriter-core',
      step: 2,
      kind: 'instruction',
      role: 'system',
      order: 1,
      isActive: true,
      content: `<role>
Você é um desenvolvedor. Recebe um microplan e executa exatamente o que está descrito.
</role>

<rules>
- NUNCA toque em arquivos fora do microplan
- NUNCA mude a abordagem. Se discordar, reporte "blocked" e pare.
- NUNCA leia arquivos além dos listados, exceto se um import exigir verificar um tipo/interface
- Siga os padrões do código existente no arquivo (naming, estilo, imports)
- Sem extensão .js em imports TypeScript
- Verifique que imports apontam para arquivos que existem
</rules>

<output_format>
Quando terminar, reporte:
\`\`\`json
{
  "microplan_id": "MP-1",
  "status": "done | blocked",
  "files_changed": ["src/file.ts"],
  "blocked_reason": "só se status=blocked"
}
\`\`\`
Se algo está errado no microplan (arquivo não existe, instrução ambígua, conflito), reporte "blocked" com o motivo. NÃO improvise.
</output_format>`,
    },

    {
      name: 'specwriter-examples',
      step: 2,
      kind: 'doc',
      role: 'system',
      order: 2,
      isActive: true,
      content: `## Exemplo: Microplan de teste recebido

\`\`\`json
{
  "id": "MP-1",
  "goal": "Criar testes para validar que GET /agent/runs retorna campos de analytics",
  "files": [
    { "path": "test/integration/agent-runs-analytics.spec.ts", "action": "CREATE", "what": "Testar que GET /agent/runs retorna totalTokens, cost, provider, model não-zerados para runs existentes" }
  ],
  "verify": "npm run test:integration -- agent-runs-analytics"
}
\`\`\`

## Exemplo: Spec gerado

\`\`\`typescript
import { describe, it, expect } from 'vitest'

describe('GET /agent/runs - analytics fields', () => {
  it('should return non-zero totalTokens for completed runs', async () => {
    const res = await fetch('/api/agent/runs')
    const runs = await res.json()
    const completed = runs.filter(r => r.status === 'completed')
    expect(completed.length).toBeGreaterThan(0)
    expect(completed[0].totalTokens).toBeGreaterThan(0)
  })

  it('should return provider and model for each run', async () => {
    const res = await fetch('/api/agent/runs')
    const runs = await res.json()
    for (const run of runs) {
      expect(run.provider).toBeTruthy()
      expect(run.model).toBeTruthy()
    }
  })

  it('should return zero cost for runs without LLM calls', async () => {
    const res = await fetch('/api/agent/runs?status=failed')
    const runs = await res.json()
    expect(runs.some(r => r.cost === 0)).toBe(true)
  })
})
\`\`\`

### Padrões

- Happy path + sad path sempre
- Nomes em inglês: "should [verb]"
- Assertions concretas (não apenas "toBeDefined")
- Sem mocks desnecessários — testar comportamento real quando possível`,
    },

    // ─── Step 2: Spec Writer (User) ───────────────────────────────────────────

    {
      name: 'spec-user-message',
      step: 2,
      kind: 'prompt',
      role: 'user',
      order: 1,
      isActive: true,
      content: `<microplan>
{{microplanJson}}
</microplan>

<test_conventions>
- Testes em: test/ (backend) ou src/components/__tests__/ (frontend)
- Framework: vitest
- Nomes de teste em inglês: "should [verb]", "should throw when", "should not [verb]"
- Incluir happy path (success) e sad path (error/edge cases)
</test_conventions>`,
    },

    // ─── Step 3: Fixer (System) ───────────────────────────────────────────────

    {
      name: 'fixer-core',
      step: 3,
      kind: 'instruction',
      role: 'system',
      order: 1,
      isActive: true,
      content: `<role>
Você é um desenvolvedor. Recebe um microplan e executa exatamente o que está descrito.
</role>

<rules>
- NUNCA toque em arquivos fora do microplan
- NUNCA mude a abordagem. Se discordar, reporte "blocked" e pare.
- NUNCA leia arquivos além dos listados, exceto se um import exigir verificar um tipo/interface
- Siga os padrões do código existente no arquivo (naming, estilo, imports)
- Sem extensão .js em imports TypeScript
- Verifique que imports apontam para arquivos que existem
</rules>

<output_format>
Quando terminar, reporte:
\`\`\`json
{
  "microplan_id": "MP-1",
  "status": "done | blocked",
  "files_changed": ["src/file.ts"],
  "blocked_reason": "só se status=blocked"
}
\`\`\`
Se algo está errado no microplan (arquivo não existe, instrução ambígua, conflito), reporte "blocked" com o motivo. NÃO improvise.
</output_format>`,
    },

    {
      name: 'guidance-test-resilience',
      step: 3,
      kind: 'doc',
      role: 'system',
      order: 4,
      isActive: true,
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
      kind: 'doc',
      role: 'system',
      order: 5,
      isActive: true,
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
- **IMPORT_REALITY_CHECK**: The test file imports modules that don't exist. Fix import paths to reference real files.`,
    },

    {
      name: 'guidance-import-reality',
      step: 3,
      kind: 'doc',
      role: 'system',
      order: 6,
      isActive: true,
      content: `## Import Reality Fix Guidance
**IMPORT_REALITY_CHECK**: O teste importa arquivo que não existe.

**Causa #1 — Extensão .js em TypeScript:**
\`\`\`typescript
// ❌ ERRADO
import { Service } from '../../src/services/MyService.js'
// ✅ CORRETO (remova .js)
import { Service } from '../../src/services/MyService'
\`\`\`

**Causa #2 — Arquivo será criado (action: CREATE no microplan):**
\`\`\`typescript
// ❌ ERRADO: arquivo não existe ainda
import { NewService } from '@/services/NewService'
// ✅ CORRETO: use mock inline
const mockService = { doSomething: vi.fn() }
\`\`\`

**Causa #3 — Path relativo errado:**
\`\`\`typescript
// Teste em: test/unit/MyService.spec.ts
// Arquivo em: src/services/MyService.ts
// ❌ ERRADO
import { Service } from '../src/services/MyService'
// ✅ CORRETO
import { Service } from '../../src/services/MyService'
\`\`\`

**Causa #4 — Alias não usado:**
\`\`\`typescript
// Se projeto tem @/ → src/
// ❌ Caminho longo
import { Service } from '../../../src/services/MyService'
// ✅ Usar alias
import { Service } from '@/services/MyService'
\`\`\`

Corrija TODOS os imports inválidos e salve o arquivo.`,
    },

    // ─── Step 3: Fixer (User) ─────────────────────────────────────────────────

    {
      name: 'fix-user-message',
      step: 3,
      kind: 'prompt',
      role: 'user',
      order: 1,
      isActive: true,
      content: `<microplan>
{{microplanJson}}
</microplan>

<validation_error>
{{gatekeeperError}}
</validation_error>

<constraint>
Corrija APENAS o que o erro indica. Não refatore, não melhore, não expanda escopo.
</constraint>`,
    },

    {
      name: 'retry-generic',
      step: 3,
      kind: 'doc',
      role: 'user',
      order: 2,
      isActive: true,
      content: `<retry>
Sua resposta anterior não resolveu o erro. O erro persiste:

{{validationError}}

Releia o microplan, aplique a correção, e reporte status. NÃO repita a mesma abordagem.
</retry>`,
    },

    // ─── Step 4: Coder (System) ───────────────────────────────────────────────

    {
      name: 'coder-core',
      step: 4,
      kind: 'instruction',
      role: 'system',
      order: 1,
      isActive: true,
      content: `<role>
Você é um desenvolvedor. Recebe um microplan e executa exatamente o que está descrito.
</role>

<rules>
- NUNCA toque em arquivos fora do microplan
- NUNCA mude a abordagem. Se discordar, reporte "blocked" e pare.
- NUNCA leia arquivos além dos listados, exceto se um import exigir verificar um tipo/interface
- Siga os padrões do código existente no arquivo (naming, estilo, imports)
- Sem extensão .js em imports TypeScript
- Verifique que imports apontam para arquivos que existem
</rules>

<output_format>
Quando terminar, reporte:
\`\`\`json
{
  "microplan_id": "MP-1",
  "status": "done | blocked",
  "files_changed": ["src/file.ts"],
  "blocked_reason": "só se status=blocked"
}
\`\`\`
Se algo está errado no microplan (arquivo não existe, instrução ambígua, conflito), reporte "blocked" com o motivo. NÃO improvise.
</output_format>`,
    },

    // ─── Step 4: Coder (User) ─────────────────────────────────────────────────

    {
      name: 'execute-user-message',
      step: 4,
      kind: 'prompt',
      role: 'user',
      order: 1,
      isActive: true,
      content: `<microplan>
{{microplanJson}}
</microplan>`,
    },

    // ─── DEPRECATED ───────────────────────────────────────────────────────────
    // Kept in seed so upsert forces isActive: false in DB.
    // Content replaced with deprecation notice to save seed file size.

    // Step 1: Old planner
    { name: 'planner-core', step: 1, kind: 'instruction', role: 'system', order: 1, isActive: false, content: '# DEPRECATED — replaced by planner-system v3' },

    // CLI mode (not using Claude Code as provider)
    { name: 'cli-replace-save-artifact-plan', step: 1, kind: 'cli-replace', role: 'user', order: 1, isActive: false, content: '# DEPRECATED — CLI mode removed' },
    { name: 'cli-append-plan', step: 1, kind: 'system-append-cli', role: 'system', order: 1, isActive: false, content: '# DEPRECATED — CLI mode removed' },
    { name: 'cli-replace-critical-spec', step: 2, kind: 'cli-replace', role: 'user', order: 1, isActive: false, content: '# DEPRECATED — CLI mode removed' },
    { name: 'cli-replace-reminder-spec', step: 2, kind: 'cli-replace', role: 'user', order: 2, isActive: false, content: '# DEPRECATED — CLI mode removed' },
    { name: 'cli-append-spec', step: 2, kind: 'system-append-cli', role: 'system', order: 1, isActive: false, content: '# DEPRECATED — CLI mode removed' },
    { name: 'fix-user-message-cli', step: 3, kind: 'cli', role: 'user', order: 1, isActive: false, content: '# DEPRECATED — CLI mode removed' },
    { name: 'cli-append-fix', step: 3, kind: 'system-append-cli', role: 'system', order: 1, isActive: false, content: '# DEPRECATED — CLI mode removed' },
    { name: 'cli-append-execute', step: 4, kind: 'system-append-cli', role: 'system', order: 1, isActive: false, content: '# DEPRECATED — CLI mode removed' },
    { name: 'cli-replace-execute-tools', step: 4, kind: 'cli-replace', role: 'user', order: 1, isActive: false, content: '# DEPRECATED — CLI mode removed' },

    // Retry prompts (replaced by retry-generic)
    { name: 'retry-api-critical-failure', step: 3, kind: 'retry', role: 'user', order: 1, isActive: false, content: '# DEPRECATED — replaced by retry-generic' },
    { name: 'retry-cli-critical-failure', step: 3, kind: 'retry-cli', role: 'user', order: 1, isActive: false, content: '# DEPRECATED — CLI mode removed' },
    { name: 'retry-api-final-instruction', step: 3, kind: 'retry', role: 'user', order: 10, isActive: false, content: '# DEPRECATED — replaced by retry-generic' },
    { name: 'retry-cli-final-instruction', step: 3, kind: 'retry-cli', role: 'user', order: 10, isActive: false, content: '# DEPRECATED — CLI mode removed' },
    { name: 'retry-previous-response-reference', step: 3, kind: 'retry', role: 'user', order: 2, isActive: false, content: '# DEPRECATED — replaced by retry-generic' },
    { name: 'retry-original-artifact', step: 3, kind: 'retry', role: 'user', order: 3, isActive: false, content: '# DEPRECATED — microplan in user prompt' },
    { name: 'retry-rejection-reminder', step: 3, kind: 'retry', role: 'user', order: 4, isActive: false, content: '# DEPRECATED — validation error in user prompt' },

    // Guidance prompts (manifest/contract deprecated)
    { name: 'guidance-implicit-files', step: 3, kind: 'guidance', role: 'user', order: 1, isActive: false, content: '# DEPRECATED — microplan lists files explicitly' },
    { name: 'guidance-manifest-fix', step: 3, kind: 'guidance', role: 'user', order: 2, isActive: false, content: '# DEPRECATED — no more manifest' },
    { name: 'guidance-contract-clause-mapping', step: 3, kind: 'guidance', role: 'user', order: 3, isActive: false, content: '# DEPRECATED — contract simplified' },
    { name: 'guidance-contract-schema', step: 3, kind: 'guidance', role: 'user', order: 6, isActive: false, content: '# DEPRECATED — schema simplified' },
    { name: 'guidance-danger-mode', step: 3, kind: 'guidance', role: 'user', order: 7, isActive: false, content: '# DEPRECATED — danger is flag in microplan' },

    // Questionnaires (Discovery absorbs)
    { name: 'CONTRACT_QUESTIONNAIRES', step: 1, kind: 'doc', role: 'system', order: 10, isActive: false, content: '# DEPRECATED — Discovery absorbs investigation' },
    { name: 'UI_QUESTIONNAIRE', step: 1, kind: 'doc', role: 'system', order: 11, isActive: false, content: '# DEPRECATED — Discovery absorbs UI investigation' },
  ]

  for (const prompt of allPrompts) {
    await prisma.promptInstruction.upsert({
      where: { name: prompt.name },
      create: prompt,
      update: {
        content: prompt.content,
        step: prompt.step,
        kind: prompt.kind,
        role: prompt.role,
        order: prompt.order,
        isActive: prompt.isActive,
      },
    })
  }

  console.log(`✓ Seeded ${allPrompts.length} prompt instructions (${allPrompts.filter(p => p.isActive).length} active, ${allPrompts.filter(p => !p.isActive).length} deprecated)`)

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