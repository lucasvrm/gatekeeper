import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

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
      description: 'Override path recorded on runs and plan.json testFilePath',
    },
    {
      key: 'ALLOW_UNTAGGED_TESTS',
      value: 'false',
      type: 'BOOLEAN',
      category: 'GATE1',
      description: 'Allow tests without @clause tags (WARNING instead of FAILED)',
    },
  ]

  for (const config of validationConfigs) {
    await prisma.validationConfig.upsert({
      where: { key: config.key },
      create: config,
      update: config,
    })
  }

  console.log(`✓ Seeded ${validationConfigs.length} validation configs`)

  const validatorConfigs = [
    { key: 'TOKEN_BUDGET_FIT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TASK_SCOPE_SIZE', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'TASK_CLARITY_CHECK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'SENSITIVE_FILES_LOCK', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
    { key: 'DANGER_MODE_EXPLICIT', value: 'true', type: 'BOOLEAN', category: 'VALIDATOR' },
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
      update: config,
    })
  }

  console.log(`✓ Seeded ${validatorConfigs.length} validator configs`)

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
