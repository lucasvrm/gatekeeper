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

    // At this point, testFilePath should already be in the correct location
    // thanks to PathResolverService in uploadFiles
    // This validator just confirms the file is accessible and follows conventions

    // Detect test type from manifest files
    const detectedTestType = detectTestType(ctx.manifest.files)

    if (!detectedTestType) {
      return {
        passed: true,
        status: 'WARNING',
        message: 'Could not detect test type from manifest files',
        evidence: 'Unable to determine test type. Skipping convention check.',
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
    }
  },
}

function detectTestType(files: Array<{ path: string; action: string }>): string | null {
  const typePatterns: Record<string, RegExp> = {
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
