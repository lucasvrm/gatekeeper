import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { prisma } from '../../../db/client.js'

export const PathConventionValidator: ValidatorDefinition = {
  code: 'PATH_CONVENTION',
  name: 'Path Convention',
  description: 'Verifica se o teste está no caminho correto de acordo com as convenções configuradas',
  gate: 0,
  order: 6,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    const typePatternsConfig = ctx.config.get('TYPE_DETECTION_PATTERNS')
    const typePatterns = getTypeDetectionPatterns(typePatternsConfig)

    if (!ctx.microplan || !ctx.microplan.files) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No microplan provided',
        context: {
          inputs: [
            { label: 'TestFilePath', value: ctx.testFilePath ?? 'none' },
            { label: 'Conventions', value: [] },
            { label: 'Type Patterns', value: Object.keys(typePatterns) },
          ],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: microplan not provided' }],
          reasoning: 'Path conventions require a microplan to infer test type.',
        },
      }
    }

    if (!ctx.testFilePath) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No test file path provided',
        context: {
          inputs: [
            { label: 'TestFilePath', value: 'none' },
            { label: 'Conventions', value: [] },
            { label: 'Type Patterns', value: Object.keys(typePatterns) },
          ],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: test file path not provided' }],
          reasoning: 'Path conventions cannot be checked without a test file path.',
        },
      }
    }

    // At this point, testFilePath should already be in the correct location
    // thanks to PathResolverService in uploadFiles
    // This validator just confirms the file is accessible and follows conventions

    // Detect test type from microplan files
    const detectedTestType = detectTestType(ctx.microplan.files, typePatterns)

    if (!detectedTestType) {
      return {
        passed: true,
        status: 'WARNING',
        message: 'Could not detect test type from microplan files',
        evidence: 'Unable to determine test type. Skipping convention check.',
        context: {
          inputs: [
            { label: 'TestFilePath', value: ctx.testFilePath },
            { label: 'Conventions', value: [] },
            { label: 'Type Patterns', value: Object.keys(typePatterns) },
          ],
          analyzed: [{ label: 'Path vs Patterns', items: ['No test type detected'] }],
          findings: [{ type: 'warning', message: 'Test type could not be detected from microplan' }],
          reasoning: 'Unable to infer test type from microplan files, so convention check was skipped.',
        },
      }
    }

    // Get test path convention for detected type
    const convention = await prisma.testPathConvention.findFirst({
      where: {
        testType: detectedTestType,
        isActive: true,
      },
    })

    if (!convention) {
      return {
        passed: true,
        status: 'WARNING',
        message: `No active convention found for test type "${detectedTestType}"`,
        evidence: `Test type "${detectedTestType}" detected but no convention configured.`,
        metrics: {
          detectedType: detectedTestType,
        },
        context: {
          inputs: [
            { label: 'TestFilePath', value: ctx.testFilePath },
            { label: 'Conventions', value: [] },
            { label: 'Type Patterns', value: Object.keys(typePatterns) },
          ],
          analyzed: [{ label: 'Path vs Patterns', items: [`No convention for ${detectedTestType}`] }],
          findings: [{ type: 'warning', message: `No active convention for test type "${detectedTestType}"` }],
          reasoning: 'Convention configuration is missing for the detected test type.',
        },
      }
    }

    // Get relative path from project root
    const normalizedTestPath = ctx.testFilePath.replace(/\\/g, '/')
    const normalizedProjectRoot = ctx.projectPath.replace(/\\/g, '/')

    let relativePath = normalizedTestPath
    if (normalizedTestPath.startsWith(normalizedProjectRoot)) {
      relativePath = normalizedTestPath.slice(normalizedProjectRoot.length).replace(/^\//, '')
    }

    // Check if path contains convention directory (e.g., /components/, /hooks/, etc.)
    const conventionDir = detectedTestType === 'component' ? '/components/' : `/${detectedTestType}s/`
    const hasConventionDir = relativePath.includes(conventionDir) || relativePath.includes(conventionDir.replace(/\//g, '\\'))

    if (hasConventionDir) {
      return {
        passed: true,
        status: 'PASSED',
        message: `Test file in correct location for "${detectedTestType}"`,
        evidence: `File path: ${relativePath}\nType: ${detectedTestType}`,
        metrics: {
          detectedType: detectedTestType,
          actualPath: relativePath,
        },
        context: {
          inputs: [
            { label: 'TestFilePath', value: ctx.testFilePath },
            { label: 'Conventions', value: [convention.pathPattern] },
            { label: 'Type Patterns', value: Object.keys(typePatterns) },
          ],
          analyzed: [{ label: 'Path vs Patterns', items: [`${relativePath} matches ${conventionDir}`] }],
          findings: [{ type: 'pass', message: 'Test file path follows convention' }],
          reasoning: `Test file path contains expected directory for "${detectedTestType}".`,
        },
      }
    }

    // If not in convention dir, might still be in artifacts (shouldn't happen, but handle gracefully)
    const isInArtifacts = /[/\\]artifacts[/\\]/.test(relativePath)
    if (isInArtifacts) {
      return {
        passed: true,
        status: 'WARNING',
        message: 'Test file still in artifacts directory (should have been moved)',
        evidence: `File was not moved to convention path. This may indicate a configuration issue.\nPath: ${relativePath}`,
        metrics: {
          detectedType: detectedTestType,
          actualPath: relativePath,
          location: 'artifacts',
        },
        context: {
          inputs: [
            { label: 'TestFilePath', value: ctx.testFilePath },
            { label: 'Conventions', value: [convention.pathPattern] },
            { label: 'Type Patterns', value: Object.keys(typePatterns) },
          ],
          analyzed: [{ label: 'Path vs Patterns', items: [`${relativePath} is in artifacts`] }],
          findings: [{ type: 'warning', message: 'Test file is still in artifacts directory' }],
          reasoning: 'Test file path indicates the file was not moved to the convention directory.',
        },
      }
    }

    // Path doesn't follow expected pattern
    return {
      passed: true,
      status: 'WARNING',
      message: `Test file path may not follow convention for "${detectedTestType}"`,
      evidence: `Actual path: ${relativePath}\nDetected type: ${detectedTestType}\nExpected directory: ${conventionDir}`,
      metrics: {
        detectedType: detectedTestType,
        actualPath: relativePath,
      },
      context: {
        inputs: [
          { label: 'TestFilePath', value: ctx.testFilePath },
          { label: 'Conventions', value: [convention.pathPattern] },
          { label: 'Type Patterns', value: Object.keys(typePatterns) },
        ],
        analyzed: [{ label: 'Path vs Patterns', items: [`${relativePath} does not include ${conventionDir}`] }],
        findings: [{ type: 'warning', message: 'Test file path may not follow convention' }],
        reasoning: 'Test file path does not include the expected convention directory.',
      },
    }
  },
}

function detectTestType(files: Array<{ path: string; action: string }>, typePatterns: Record<string, RegExp>): string | null {
  const typeCounts: Record<string, number> = {}

  for (const file of files) {
    if (file.action === 'DELETE') continue

    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(file.path)) {
        typeCounts[type] = (typeCounts[type] || 0) + 1
      }
    }
  }

  // Return the type with the most matches
  let maxCount = 0
  let detectedType: string | null = null

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count
      detectedType = type
    }
  }

  return detectedType
}

function getTypeDetectionPatterns(configValue: string | undefined): Record<string, RegExp> {
  const defaults: Record<string, RegExp> = {
    component: /\/(components?|ui|widgets?|layout|views?)\//i,
    hook: /\/hooks?\//i,
    lib: /\/lib\//i,
    util: /\/utils?\//i,
    service: /\/services?\//i,
    context: /\/contexts?\//i,
    page: /\/pages?\//i,
    store: /\/stores?\//i,
    api: /\/api\//i,
    validator: /\/validators?\//i,
  }

  if (!configValue || configValue.trim() === '') {
    return defaults
  }

  const patterns: Record<string, RegExp> = {}
  const entries = configValue.split(',').map((entry) => entry.trim()).filter(Boolean)

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(':')
    if (separatorIndex <= 0) continue
    const type = entry.slice(0, separatorIndex).trim()
    const pattern = entry.slice(separatorIndex + 1).trim()
    if (!type || !pattern) continue
    try {
      patterns[type] = new RegExp(pattern, 'i')
    } catch {
      // Ignore invalid regex
    }
  }

  for (const [type, pattern] of Object.entries(defaults)) {
    if (!patterns[type]) {
      patterns[type] = pattern
    }
  }

  return Object.keys(patterns).length > 0 ? patterns : defaults
}
