import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { prisma } from '../../../db/client.js'
import path from 'path'

export const PathConventionValidator: ValidatorDefinition = {
  code: 'PATH_CONVENTION',
  name: 'Path Convention',
  description: 'Verifica se o teste está no caminho correto de acordo com as convenções configuradas',
  gate: 0,
  order: 6,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.manifest) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No manifest provided',
      }
    }

    if (!ctx.testFilePath) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No test file path provided',
      }
    }

    // Detect test type from manifest files
    const detectedTestType = detectTestType(ctx.manifest.files)

    if (!detectedTestType) {
      return {
        passed: true,
        status: 'WARNING',
        message: 'Could not detect test type from manifest files',
        evidence: 'Unable to determine test type. No convention check performed.',
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
      }
    }

    // Resolve expected path pattern
    const testFileName = path.basename(ctx.testFilePath)
    const baseName = testFileName
      .replace(/\.spec\.(tsx?|jsx?)$/, '')
      .replace(/\.test\.(tsx?|jsx?)$/, '')

    const currentGate = ctx.gate || 0
    const expectedPattern = convention.pathPattern
      .replace(/{name}/g, baseName)
      .replace(/{gate}/g, String(currentGate))

    // Check if test file path matches expected pattern
    const projectRoot = ctx.config.get('PROJECT_ROOT') || ''
    const normalizedTestPath = ctx.testFilePath.replace(/\\/g, '/')
    const normalizedProjectRoot = projectRoot.replace(/\\/g, '/')

    // Get relative path from project root
    let relativePath = normalizedTestPath
    if (normalizedTestPath.startsWith(normalizedProjectRoot)) {
      relativePath = normalizedTestPath.slice(normalizedProjectRoot.length).replace(/^\//, '')
    }

    const normalizedExpectedPattern = expectedPattern.replace(/\\/g, '/')

    if (relativePath === normalizedExpectedPattern || normalizedTestPath.endsWith(normalizedExpectedPattern)) {
      return {
        passed: true,
        status: 'PASSED',
        message: `Test file path follows convention for "${detectedTestType}"`,
        metrics: {
          detectedType: detectedTestType,
          conventionPattern: convention.pathPattern,
          resolvedPath: expectedPattern,
        },
      }
    }

    return {
      passed: false,
      status: 'FAILED',
      message: `Test file path does not follow convention for "${detectedTestType}"`,
      evidence: `Expected: ${expectedPattern}\nActual: ${relativePath}\n\nConvention pattern: ${convention.pathPattern}`,
      metrics: {
        detectedType: detectedTestType,
        expectedPath: expectedPattern,
        actualPath: relativePath,
      },
    }
  },
}

function detectTestType(files: Array<{ path: string; action: string }>): string | null {
  const typePatterns: Record<string, RegExp> = {
    component: /\/components?\//i,
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
